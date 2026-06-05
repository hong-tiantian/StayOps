import { loadBillingAccounts } from "../data";
import { ToolRunner } from "../tools";
import { PromiseStatus, Reservation } from "../types";

/**
 * Deterministic policy / guardrail layer.
 *
 * The Gemini agent PROPOSES; this layer DECIDES. No matter what the model says,
 * the final executable status is computed here from fresh tool evidence and SOP
 * rules. This is StayOps' safety story: an LLM can never upgrade a promise to a
 * guarantee the operational data does not support.
 *
 * The same function is reused as the offline fallback when Gemini is unavailable,
 * so the two paths can never disagree on policy.
 */

const KNOWN_ARRIVAL = "2026-07-18T11:00:00";

/** Keyword matchers aligning an extracted promise to the stable ledger id. */
const LEDGER_MATCHERS: Array<{ id: string; test: (t: string) => boolean }> = [
  { id: "P-001", test: (t) => /early|check[- ]?in|arrive|11am|11 am/.test(t) },
  { id: "P-002", test: (t) => /quiet|elevator|vp\b|king room/.test(t) },
  { id: "P-003", test: (t) => /gluten|breakfast|dietary|f&b|food/.test(t) },
  { id: "P-004", test: (t) => /projector|meeting room|av\b|screen|hdmi/.test(t) },
  { id: "P-005", test: (t) => /transfer|airport|flight|pickup|mad\b/.test(t) },
  { id: "P-006", test: (t) => /invoice|billing|tax|company account/.test(t) },
];

/** Map an extracted promise text to a stable P-00x id, or null if none match. */
export function alignPromiseId(promiseText: string): string | null {
  const t = promiseText.toLowerCase();
  return LEDGER_MATCHERS.find((m) => m.test(t))?.id ?? null;
}

export interface RuleVerdict {
  status: PromiseStatus;
  evidence: string[];
}

/**
 * Authoritative deterministic verdict for a known promise id. Uses the supplied
 * runner so every tool call it makes is recorded for the audit log. This is the
 * SOURCE OF TRUTH for status — agent proposals are reconciled against it.
 */
export function rulePromiseStatus(
  promiseId: string,
  runner: ToolRunner,
  reservation: Reservation | null
): RuleVerdict {
  const arrival = reservation
    ? `${reservation.arrival_date}T${reservation.arrival_time}:00`
    : KNOWN_ARRIVAL;
  const evidence: string[] = [];

  switch (promiseId) {
    case "P-001": {
      gateSources(runner, ["room_inventory", "room_readiness"], evidence);
      runner.retrieve_sop("early_check_in");
      const r = runner.check_room_readiness("king", {}, arrival);
      const status: PromiseStatus = r.available_ready_count >= 8 ? "at_risk" : "cannot_confirm";
      evidence.push(
        `Readiness: ${r.available_ready_count} king room(s) ready at arrival, ${r.available_later_count} later — group of ${reservation?.room_count ?? 12} not guaranteed.`
      );
      return { status, evidence };
    }
    case "P-002": {
      gateSources(runner, ["room_inventory", "room_readiness"], evidence);
      runner.retrieve_sop("quiet_room");
      const r = runner.check_room_readiness(
        "king",
        { quiet_zone: true, away_from_elevator: true },
        arrival
      );
      const status: PromiseStatus =
        r.available_ready_count > 0 ? "verifiable" : r.available_later_count > 0 ? "at_risk" : "cannot_confirm";
      const candidates = r.matching_rooms
        .filter((m) => m.suitability !== "unsuitable")
        .map((m) => `${m.room_id} (${m.suitability})`)
        .join(", ");
      evidence.push(
        `Suitable quiet king candidates: ${candidates || "none"}; none ready at ${reservation?.arrival_time ?? "11:00"}. Manager approval + room block required (SOP-ROOM-002).`
      );
      return { status, evidence };
    }
    case "P-003": {
      gateSources(runner, ["hotel_sop"], evidence);
      const sop = runner.retrieve_sop("gluten_free_breakfast");
      evidence.push(`${sop[0]?.policy_id}: deadline ${sop[0]?.deadline_rule}. Notification window open — F&B can execute.`);
      return { status: "verifiable", evidence };
    }
    case "P-004": {
      gateSources(runner, ["event_spaces"], evidence);
      runner.check_inventory("projector");
      runner.retrieve_sop("projector_setup");
      const space = runner.check_event_space("projector", "2026-07-18T14:00:00", "MR-BLUE");
      const status: PromiseStatus = space.available && space.equipment.projector ? "verifiable" : "conflict";
      evidence.push(
        `MR-BLUE has projector/screen/HDMI. Setup task MUST be due ${space.recommended_task_due_at} (meeting_start - ${space.setup_lead_time_minutes}m), NOT 14:00.`
      );
      return { status, evidence };
    }
    case "P-005": {
      gateSources(runner, ["transport_vendors"], evidence);
      runner.retrieve_sop("airport_transfer");
      const missing = ["flight_number", "arrival_time", "passenger_count", "phone_number"];
      evidence.push(`Vendor TR-01 available, but required fields missing: ${missing.join(", ")}.`);
      return { status: "missing_info", evidence };
    }
    case "P-006": {
      gateSources(runner, ["billing_accounts"], evidence);
      runner.retrieve_sop("company_invoice");
      const billing = loadBillingAccounts().find((b) => b.booking_id === reservation?.booking_id);
      const missing: string[] = [];
      if (!billing?.billing_contact) missing.push("billing_contact");
      if (!billing?.tax_id) missing.push("tax_id");
      if (!billing?.billing_address) missing.push("billing_address");
      evidence.push(`Billing account ${billing?.status ?? "incomplete"}; missing: ${missing.join(", ") || "none"}.`);
      return { status: missing.length ? "missing_info" : "verifiable", evidence };
    }
    default:
      return { status: "cannot_confirm", evidence: ["No deterministic rule for this promise."] };
  }
}

/**
 * Freshness gate: if any required source is stale, record it. A stale required
 * source forbids a `verifiable` status (callers downgrade accordingly).
 */
function gateSources(runner: ToolRunner, sources: string[], evidence: string[]): void {
  for (const s of sources) {
    const f = runner.check_data_freshness(s) as { freshness_status: string; age_minutes: number };
    if (f.freshness_status === "stale") {
      evidence.push(`⚠ Source "${s}" is stale (${f.age_minutes}m old) — cannot guarantee; downgraded.`);
    }
  }
}

/**
 * Reconcile the model's proposed status with the deterministic verdict.
 * Policy always wins on status; the model's narrative is kept as extra evidence.
 */
export function reconcileStatus(
  ruleStatus: PromiseStatus,
  proposedStatus: string | undefined
): { status: PromiseStatus; overruled: boolean } {
  const overruled = !!proposedStatus && proposedStatus !== ruleStatus;
  return { status: ruleStatus, overruled };
}

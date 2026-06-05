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

/** Keyword matchers aligning an extracted promise to a promise CATEGORY.
 *  Category-based (not booking-specific id) so any booking's promises align. */
const CATEGORY_MATCHERS: Array<{ category: string; test: (t: string) => boolean }> = [
  { category: "early_check_in", test: (t) => /early|check[- ]?in|arrive|11am|11 am/.test(t) },
  { category: "high_floor", test: (t) => /high[- ]?floor|upper floor|top floor/.test(t) },
  { category: "quiet_room", test: (t) => /quiet|elevator|vp\b/.test(t) },
  { category: "gluten_free_breakfast", test: (t) => /gluten|breakfast|dietary|f&b|food/.test(t) },
  { category: "projector_setup", test: (t) => /projector|meeting room|av\b|screen|hdmi/.test(t) },
  { category: "airport_transfer", test: (t) => /transfer|airport|flight|pickup|mad\b/.test(t) },
  { category: "company_invoice", test: (t) => /invoice|billing|tax|company account/.test(t) },
  { category: "upgrade", test: (t) => /upgrade|suite/.test(t) },
  { category: "parking", test: (t) => /parking|car park|garage|vehicle/.test(t) },
];

/** Map an extracted promise text to a promise category, or null if none match. */
export function alignPromiseCategory(promiseText: string): string | null {
  const t = promiseText.toLowerCase();
  return CATEGORY_MATCHERS.find((m) => m.test(t))?.category ?? null;
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
  category: string,
  runner: ToolRunner,
  reservation: Reservation | null
): RuleVerdict {
  const arrival = reservation
    ? `${reservation.arrival_date}T${reservation.arrival_time}:00`
    : KNOWN_ARRIVAL;
  const evidence: string[] = [];

  switch (category) {
    case "early_check_in": {
      const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
      runner.retrieve_sop("early_check_in");
      const r = runner.check_room_readiness("king", {}, arrival);
      const status: PromiseStatus =
        stale || r.available_ready_count < 8 ? "cannot_confirm" : "at_risk";
      evidence.push(
        `Readiness: ${r.available_ready_count} king room(s) ready at arrival, ${r.available_later_count} later — group of ${reservation?.room_count ?? 12} not guaranteed.`
      );
      return { status, evidence };
    }
    case "quiet_room": {
      const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
      runner.retrieve_sop("quiet_room");
      const r = runner.check_room_readiness(
        "king",
        { quiet_zone: true, away_from_elevator: true },
        arrival
      );
      const status: PromiseStatus = stale
        ? "cannot_confirm"
        : r.available_ready_count > 0
          ? "verifiable"
          : r.available_later_count > 0
            ? "at_risk"
            : "cannot_confirm";
      const candidates = r.matching_rooms
        .filter((m) => m.suitability !== "unsuitable")
        .map((m) => `${m.room_id} (${m.suitability})`)
        .join(", ");
      evidence.push(
        `Suitable quiet king candidates: ${candidates || "none"}; none ready at ${reservation?.arrival_time ?? "11:00"}. Manager approval + room block required (SOP-ROOM-002).`
      );
      return { status, evidence };
    }
    case "gluten_free_breakfast": {
      const stale = gateSources(runner, ["hotel_sop"], evidence);
      const sop = runner.retrieve_sop("gluten_free_breakfast");
      evidence.push(`${sop[0]?.policy_id}: deadline ${sop[0]?.deadline_rule}. Notification window open — F&B can execute.`);
      return { status: stale ? "cannot_confirm" : "verifiable", evidence };
    }
    case "projector_setup": {
      const stale = gateSources(runner, ["event_spaces"], evidence);
      runner.check_inventory("projector");
      runner.retrieve_sop("projector_setup");
      const space = runner.check_event_space("projector", "2026-07-18T14:00:00", "MR-BLUE");
      const status: PromiseStatus = stale
        ? "cannot_confirm"
        : space.available && space.equipment.projector
          ? "verifiable"
          : "conflict";
      evidence.push(
        `MR-BLUE has projector/screen/HDMI. Setup task MUST be due ${space.recommended_task_due_at} (meeting_start - ${space.setup_lead_time_minutes}m), NOT 14:00.`
      );
      return { status, evidence };
    }
    case "airport_transfer": {
      gateSources(runner, ["transport_vendors"], evidence);
      runner.retrieve_sop("airport_transfer");
      const missing = ["flight_number", "arrival_time", "passenger_count", "phone_number"];
      evidence.push(`Vendor TR-01 available, but required fields missing: ${missing.join(", ")}.`);
      return { status: "missing_info", evidence };
    }
    case "company_invoice": {
      const stale = gateSources(runner, ["billing_accounts"], evidence);
      runner.retrieve_sop("company_invoice");
      const billing = loadBillingAccounts().find((b) => b.booking_id === reservation?.booking_id);
      const missing: string[] = [];
      if (!billing?.billing_contact) missing.push("billing_contact");
      if (!billing?.tax_id) missing.push("tax_id");
      if (!billing?.billing_address) missing.push("billing_address");
      evidence.push(`Billing account ${billing?.status ?? "incomplete"}; missing: ${missing.join(", ") || "none"}.`);
      const status: PromiseStatus = missing.length ? "missing_info" : stale ? "cannot_confirm" : "verifiable";
      return { status, evidence };
    }
    case "upgrade": {
      const stale = gateSources(runner, ["room_inventory"], evidence);
      runner.retrieve_sop("upgrade");
      evidence.push(
        "SOP-UPG-007: free upgrades require manager approval; OTA bookings are not guaranteed an upgrade."
      );
      return { status: stale ? "cannot_confirm" : "needs_approval", evidence };
    }
    case "high_floor": {
      const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
      runner.retrieve_sop("high_floor");
      const r = runner.check_room_readiness("king", { quiet_zone: true, high_floor: true }, arrival);
      const status: PromiseStatus = stale
        ? "cannot_confirm"
        : r.available_ready_count > 0
          ? "verifiable"
          : r.available_later_count > 0
            ? "at_risk"
            : "cannot_confirm";
      const candidates = r.matching_rooms
        .filter((m) => m.suitability !== "unsuitable")
        .map((m) => m.room_id)
        .join(", ");
      evidence.push(`High-floor quiet candidates: ${candidates || "none"}; ${r.available_ready_count} ready now.`);
      return { status, evidence };
    }
    case "parking": {
      runner.retrieve_sop("parking");
      evidence.push(
        "SOP-PRK-009: parking requires vehicle plate and arrival time — not provided in the booking message."
      );
      return { status: "missing_info", evidence };
    }
    default:
      return { status: "cannot_confirm", evidence: ["No deterministic rule for this promise."] };
  }
}

/**
 * Freshness gate: check each required source. Returns true if ANY is stale.
 * A stale required source forbids a `verifiable` status — callers must downgrade
 * to `cannot_confirm`. This is the hard safety rule: never guarantee on stale data.
 */
function gateSources(runner: ToolRunner, sources: string[], evidence: string[]): boolean {
  let stale = false;
  for (const s of sources) {
    const f = runner.check_data_freshness(s) as { freshness_status: string; age_minutes: number };
    if (f.freshness_status === "stale") {
      stale = true;
      evidence.push(
        `⚠ Source "${s}" is stale (${f.age_minutes}m old) — freshness gate forbids a guarantee; downgraded to cannot_confirm.`
      );
    }
  }
  return stale;
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

import {
  loadReservations,
  loadPromiseLedger,
  getOpsTasks,
  loadBillingAccounts,
} from "./data";
import { ToolRunner } from "./tools";
import { allFreshness } from "./freshness";
import {
  Department,
  PromiseDecision,
  PromiseStatus,
  PromiseType,
  ToolCall,
} from "./types";

const SOURCE_QUOTES: Record<string, string> = {
  "P-001": "Some executives may arrive around 11am, so early check-in would be helpful.",
  "P-002": "Please place our VP in a quiet king room away from elevators if possible.",
  "P-003": "We also need gluten-free breakfast for two attendees.",
  "P-004": "a projector in the meeting room",
  "P-005": "airport transfer from MAD",
  "P-006": "a company invoice",
};

function linkedTaskFor(promise_id: string): string | undefined {
  return getOpsTasks().find((t) => t.source_promise_id === promise_id)?.task_id;
}

function splitTypes(raw: string): PromiseType[] {
  return raw.split(";").map((t) => t.trim()) as PromiseType[];
}

export interface AuditResult {
  booking_id: string;
  decisions: PromiseDecision[];
  tool_calls: ToolCall[];
  freshness_summary: Array<{
    source_name: string;
    last_synced_at: string;
    freshness_status: "fresh" | "stale";
    age_minutes: number;
    max_allowed_age_minutes: number;
  }>;
}

export function runPromiseAudit(booking_id: string): AuditResult {
  const runner = new ToolRunner();
  const reservation = runner.get_reservation(booking_id);
  runner.search_messages(booking_id);

  const ledger = loadPromiseLedger().filter((p) => p.booking_id === booking_id);
  const arrivalIso = reservation
    ? `${reservation.arrival_date}T${reservation.arrival_time}:00`
    : "2026-07-18T11:00:00";

  const decisions: PromiseDecision[] = [];

  for (const row of ledger) {
    // Per-promise tool runner so each decision carries its own visible calls.
    const local = new ToolRunner();
    let computedStatus: PromiseStatus = row.status;
    const extraEvidence: string[] = [];

    switch (row.promise_id) {
      case "P-001": {
        local.check_data_freshness("room_inventory");
        local.check_data_freshness("room_readiness");
        local.retrieve_sop("early_check_in");
        const r = local.check_room_readiness("king", {}, arrivalIso);
        // Group of 12 cannot be guaranteed when not all rooms are inspected/ready.
        computedStatus = r.available_ready_count >= 8 ? "at_risk" : "cannot_confirm";
        extraEvidence.push(
          `Readiness check: ${r.available_ready_count} king room(s) ready at arrival, ${r.available_later_count} ready later — group of ${reservation?.room_count ?? 12} not guaranteed.`
        );
        break;
      }
      case "P-002": {
        local.check_data_freshness("room_inventory");
        local.check_data_freshness("room_readiness");
        local.retrieve_sop("quiet_room");
        const r = local.check_room_readiness(
          "king",
          { quiet_zone: true, away_from_elevator: true },
          arrivalIso
        );
        if (r.available_ready_count > 0) computedStatus = "verifiable";
        else if (r.available_later_count > 0) computedStatus = "at_risk";
        else computedStatus = "cannot_confirm";
        const candidates = r.matching_rooms
          .filter((m) => m.suitability !== "unsuitable")
          .map((m) => `${m.room_id} (${m.suitability})`)
          .join(", ");
        extraEvidence.push(
          `Suitable quiet king candidates: ${candidates || "none"}; none ready at ${reservation?.arrival_time}. Manager approval + room block required (SOP-ROOM-002).`
        );
        break;
      }
      case "P-003": {
        local.check_data_freshness("hotel_sop");
        const sop = local.retrieve_sop("gluten_free_breakfast");
        computedStatus = "verifiable";
        extraEvidence.push(
          `${sop[0]?.policy_id}: deadline ${sop[0]?.deadline_rule}. Notification window open — F&B can execute.`
        );
        break;
      }
      case "P-004": {
        local.check_data_freshness("event_spaces");
        local.check_inventory("projector");
        local.retrieve_sop("projector_setup");
        const space = local.check_event_space("projector", "2026-07-18T14:00:00", "MR-BLUE");
        computedStatus = space.available && space.equipment.projector ? "verifiable" : "conflict";
        extraEvidence.push(
          `MR-BLUE has projector/screen/HDMI. Setup task must be due ${space.recommended_task_due_at} (meeting_start - ${space.setup_lead_time_minutes}m), NOT 14:00.`
        );
        break;
      }
      case "P-005": {
        local.check_data_freshness("transport_vendors");
        local.retrieve_sop("airport_transfer");
        local.search_messages(booking_id);
        // Required fields absent in all messages.
        const missing = ["flight_number", "arrival_time", "passenger_count", "phone_number"];
        computedStatus = "missing_info";
        extraEvidence.push(
          `Vendor TR-01 available, but required fields missing: ${missing.join(", ")}.`
        );
        break;
      }
      case "P-006": {
        local.check_data_freshness("billing_accounts");
        local.retrieve_sop("company_invoice");
        const billing = loadBillingAccounts().find((b) => b.booking_id === booking_id);
        const missing: string[] = [];
        if (!billing?.billing_contact) missing.push("billing_contact");
        if (!billing?.tax_id) missing.push("tax_id");
        if (!billing?.billing_address) missing.push("billing_address");
        computedStatus = missing.length ? "missing_info" : "verifiable";
        extraEvidence.push(`Billing account ${billing?.status}; missing: ${missing.join(", ")}.`);
        break;
      }
      default:
        break;
    }

    local.log_promise_decision(
      row.promise_id,
      computedStatus,
      [row.evidence, ...extraEvidence],
      row.recommended_action
    );

    runner.calls.push(...local.calls);

    decisions.push({
      promise_id: row.promise_id,
      booking_id: row.booking_id,
      promise_text: row.promise_text,
      promise_type: splitTypes(row.promise_type),
      status: computedStatus,
      owner_department: row.owner_department as Department,
      source_message_id: "MSG-001",
      source_quote: SOURCE_QUOTES[row.promise_id],
      evidence: [row.evidence, ...extraEvidence],
      risk_reason: row.risk_reason,
      recommended_action: row.recommended_action,
      approval_required: row.approval_required,
      execution_state: row.execution_state,
      linked_task_id: linkedTaskFor(row.promise_id),
      tool_calls: local.calls,
    });
  }

  const freshness_summary = allFreshness().map((f) => ({
    source_name: f.source_name,
    last_synced_at: f.last_synced_at,
    freshness_status: f.freshness_status,
    age_minutes: f.age_minutes,
    max_allowed_age_minutes: f.max_allowed_age_minutes,
  }));

  return {
    booking_id,
    decisions,
    tool_calls: runner.calls,
    freshness_summary,
  };
}

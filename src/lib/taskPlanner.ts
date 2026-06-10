import { getOpsTasks, loadEventSpaces, loadReservations } from "./data";
import { ExtraItem, InfoAnalysis, PromiseDecision, TaskPlan } from "./types";

function existingDueAt(itemId: string): string | undefined {
  return getOpsTasks().find((task) => task.source_promise_id === itemId)?.due_at || undefined;
}

/** SOP-correct due time for event/AV setup: meeting_start - setup_lead_time. */
function eventSetupDueAt(decision: PromiseDecision): string | undefined {
  const reservation = loadReservations().find((r) => r.booking_id === decision.booking_id);
  const space = loadEventSpaces().find((s) => s.space_id === reservation?.meeting_room_id);
  if (!space) return undefined;
  const start = new Date(`${space.date}T${space.start_time}:00`);
  const due = new Date(start.getTime() - space.setup_lead_time_minutes * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  // Local naive ISO (no UTC shift) — all demo times are wall-clock local.
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}:${pad(due.getSeconds())}`;
}

function recommendedDueAt(decision: PromiseDecision, extra: ExtraItem | undefined): string | undefined {
  if (extra?.domain === "event_av") {
    return eventSetupDueAt(decision) ?? existingDueAt(decision.promise_id);
  }
  return existingDueAt(decision.promise_id);
}

function followUpDescription(decision: PromiseDecision, extra: ExtraItem | undefined): string {
  if (extra?.missing_fields?.length) {
    return `Ask the guest/company for ${extra.missing_fields.join(", ")} before committing to "${decision.promise_text}".`;
  }
  return decision.recommended_action;
}

export function planTasks(infoAnalysis: InfoAnalysis, decisions: PromiseDecision[]): TaskPlan[] {
  const extraById = new Map(infoAnalysis.extra_items.map((item) => [item.item_id, item]));
  if (infoAnalysis.basic_info_status !== "complete") {
    return [
      {
        item_id: "basic_info",
        action_type: "create_follow_up",
        department: "sales",
        description: `Ask for missing basic booking fields: ${infoAnalysis.missing_basic_fields.join(", ")}.`,
        reason: "Basic stay information is incomplete, so extras should not be verified as executable promises yet.",
      },
    ];
  }

  if (infoAnalysis.extra_items.length === 0) {
    return [
      {
        item_id: "booking_summary",
        action_type: "none",
        guest_reply_draft: "Draft a safe booking confirmation summary; no special operational handoff is needed.",
        reason: "Basic stay information is complete and no extra items were found.",
      },
    ];
  }

  return decisions.map((decision) => {
    const extra = extraById.get(decision.promise_id);
    if (decision.status === "verifiable") {
      return {
        item_id: decision.promise_id,
        action_type: "create_task",
        department: decision.owner_department,
        description: decision.recommended_action,
        due_at: recommendedDueAt(decision, extra),
        reason: "Verified against available evidence and deterministic safety rules; ready for department handoff.",
      };
    }

    if (decision.status === "at_risk" && decision.approval_required) {
      return {
        item_id: decision.promise_id,
        action_type: "request_manager_approval",
        department: "manager",
        manager_prompt: decision.recommended_action,
        due_at: existingDueAt(decision.promise_id),
        reason: "Operationally possible only with manager approval and an explicit room/task lock.",
      };
    }

    if (decision.status === "needs_approval") {
      return {
        item_id: decision.promise_id,
        action_type: "request_manager_approval",
        department: "manager",
        manager_prompt: decision.recommended_action,
        reason: "The item affects value, revenue, or discretion and cannot be auto-committed.",
      };
    }

    if (decision.status === "missing_info") {
      return {
        item_id: decision.promise_id,
        action_type: "create_follow_up",
        department: decision.owner_department,
        description: followUpDescription(decision, extra),
        due_at: existingDueAt(decision.promise_id),
        reason: "Guest/company fields required by the verification route are missing.",
      };
    }

    if (decision.status === "cannot_confirm") {
      return {
        item_id: decision.promise_id,
        action_type: "draft_cautious_reply",
        department: decision.owner_department,
        guest_reply_draft: decision.recommended_action,
        reason: "Current evidence does not support a safe guarantee.",
      };
    }

    if (decision.status === "conflict") {
      return {
        item_id: decision.promise_id,
        action_type: "escalate",
        department: "manager",
        description: decision.recommended_action,
        reason: "Evidence conflicts with policy, inventory, or operational feasibility.",
      };
    }

    return {
      item_id: decision.promise_id,
      action_type: "none",
      department: decision.owner_department,
      reason: "No additional planning action is required for the current lifecycle state.",
    };
  });
}

import { getOpsTasks, loadApprovalRecords, loadPromiseLedger } from "./data";
import { ToolRunner } from "./tools";
import { PromiseLedgerRow, RecoveryTrace, ToolCall } from "./types";

export interface TraceResult extends RecoveryTrace {
  tool_calls: ToolCall[];
}

type ComplaintSignal = "quiet_room" | "projector_setup";

/**
 * Complaint trace remains deterministic for the Acme demo, but matching now starts
 * from complaint signals -> ledger rule_key -> linked tasks instead of fixed IDs.
 */
export function traceComplaint(booking_id: string, complaint_text: string): TraceResult {
  const runner = new ToolRunner();
  const tasks = getOpsTasks().filter((task) => task.booking_id === booking_id);
  const ledger = loadPromiseLedger().filter((promise) => promise.booking_id === booking_id);
  const approvals = loadApprovalRecords().filter((approval) => approval.booking_id === booking_id);

  runner.search_messages(booking_id);
  const reservation = runner.get_reservation(booking_id);

  const matched_promises: RecoveryTrace["matched_promises"] = [];
  for (const signal of complaintSignals(complaint_text)) {
    const promise = ledger.find((row) => row.category === signal);
    if (!promise) continue;

    if (signal === "quiet_room") {
      runner.check_room_readiness(
        "king",
        { quiet_zone: true, away_from_elevator: true },
        reservation ? `${reservation.arrival_date}T${reservation.arrival_time}:00` : "2026-07-18T11:00:00"
      );
      matched_promises.push(roomFailure(promise, tasks.find((task) => task.source_promise_id === promise.promise_id), approvals));
    }

    if (signal === "projector_setup") {
      const task = tasks.find((t) => t.source_promise_id === promise.promise_id);
      const space = runner.check_event_space(
        "projector",
        task?.due_at ?? "2026-07-18T14:00:00",
        reservation?.meeting_room_id || "MR-BLUE"
      );
      matched_promises.push(projectorFailure(promise, task, space.recommended_task_due_at, space.setup_lead_time_minutes));
    }
  }

  return {
    complaint_id: "CMP-001",
    booking_id,
    complaint_text,
    matched_promises,
    recovery_plan: recoveryPlanFor(matched_promises),
    guest_reply_draft:
      "Maya, I’m sorry that we failed to deliver the quiet-room placement and meeting-room readiness your team expected. " +
      "We are moving the VP to the best available quiet king room after inspection, sending technical support to MR-BLUE immediately, " +
      "and reviewing the room-blocking and event setup handoff that caused this failure.",
    postmortem_suggestions: [
      "Escalate uncompleted VIP room-blocking tasks 12 hours before arrival.",
      "Auto-calculate event setup due_at from SOP lead time (meeting_start - setup_lead_time).",
    ],
    tool_calls: runner.calls,
  };
}

function complaintSignals(complaintText: string): ComplaintSignal[] {
  const lower = complaintText.toLowerCase();
  const signals: ComplaintSignal[] = [];
  if (lower.includes("quiet") || lower.includes("elevator") || lower.includes("room")) {
    signals.push("quiet_room");
  }
  if (lower.includes("projector") || lower.includes("meeting")) {
    signals.push("projector_setup");
  }
  return signals;
}

function roomFailure(
  promise: PromiseLedgerRow,
  task: ReturnType<typeof getOpsTasks>[number] | undefined,
  approvals: ReturnType<typeof loadApprovalRecords>
): RecoveryTrace["matched_promises"][number] {
  const approval = approvals.find((record) => record.promise_id === promise.promise_id);
  return {
    promise_id: promise.promise_id,
    promise_text: promise.promise_text,
    failure_type: task?.status === "completed" ? "room_assignment_mismatch" : "task_not_completed",
    failure_point: "front_desk_room_blocking_task_not_completed",
    root_cause:
      `Manager approval ${approval?.approval_id ?? "not found"} existed for quiet-room priority, but front desk did not lock a suitable room. ` +
      `${task?.task_id ?? "TASK-103"} remains ${task?.status ?? "open"}; VP was placed in room 402 (near elevator).`,
    linked_task_id: task?.task_id ?? "TASK-103",
  };
}

function projectorFailure(
  promise: PromiseLedgerRow,
  task: ReturnType<typeof getOpsTasks>[number] | undefined,
  recommendedDueAt: string,
  setupLeadTimeMinutes: number
): RecoveryTrace["matched_promises"][number] {
  return {
    promise_id: promise.promise_id,
    promise_text: promise.promise_text,
    failure_type: task?.due_at === recommendedDueAt ? "task_not_completed" : "incorrect_due_time",
    failure_point: "events_task_due_time_set_to_meeting_start",
    root_cause:
      `Events task ${task?.task_id ?? "TASK-102"} due_at was ${task?.due_at ?? "2026-07-18T14:00:00"} (meeting start), ` +
      `but SOP-EVT-004 required ${recommendedDueAt} (meeting_start - ${setupLeadTimeMinutes}m).`,
    linked_task_id: task?.task_id ?? "TASK-102",
  };
}

function recoveryPlanFor(
  matchedPromises: RecoveryTrace["matched_promises"]
): RecoveryTrace["recovery_plan"] {
  const hasRoom = matchedPromises.some((promise) => promise.failure_point.includes("front_desk"));
  const hasProjector = matchedPromises.some((promise) => promise.failure_point.includes("events"));

  return [
    ...(hasRoom
      ? [
          {
            department: "front_desk" as const,
            action: "Offer VP immediate move to room 504 after inspection, or provide service recovery credit.",
            urgency: "immediate" as const,
          },
        ]
      : []),
    ...(hasProjector
      ? [
          {
            department: "events" as const,
            action: "Send technician to MR-BLUE immediately with projector and HDMI adapter.",
            urgency: "immediate" as const,
          },
        ]
      : []),
    {
      department: "manager",
      action: "Send apology and corrective action note to company contact.",
      urgency: "same_day",
    },
  ];
}

import { getOpsTasks, loadPromiseLedger } from "./data";
import { ToolRunner } from "./tools";
import { RecoveryTrace, ToolCall } from "./types";

export interface TraceResult extends RecoveryTrace {
  tool_calls: ToolCall[];
}

/**
 * Deterministically traces the demo complaint to its two broken promises
 * (P-002 quiet king room, P-004 projector) and the exact tasks that failed.
 */
export function traceComplaint(booking_id: string, complaint_text: string): TraceResult {
  const runner = new ToolRunner();
  const tasks = getOpsTasks();
  const ledger = loadPromiseLedger();

  runner.search_messages(booking_id);
  runner.get_reservation(booking_id);

  const lower = complaint_text.toLowerCase();
  const mentionsRoom = lower.includes("quiet") || lower.includes("elevator") || lower.includes("room");
  const mentionsProjector = lower.includes("projector") || lower.includes("meeting");

  const matched_promises: RecoveryTrace["matched_promises"] = [];

  if (mentionsRoom) {
    const task = tasks.find((t) => t.source_promise_id === "P-002");
    runner.check_room_readiness(
      "king",
      { quiet_zone: true, away_from_elevator: true },
      "2026-07-18T11:00:00"
    );
    matched_promises.push({
      promise_id: "P-002",
      promise_text:
        ledger.find((p) => p.promise_id === "P-002")?.promise_text ??
        "Quiet king room for VP away from elevators",
      failure_type: "task_not_completed",
      failure_point: "front_desk_room_blocking_task_not_completed",
      root_cause:
        "Manager approved quiet king priority (APR-001), but front desk did not lock a suitable room. " +
        `${task?.task_id ?? "TASK-103"} remains ${task?.status ?? "open"}; VP was placed in room 402 (near elevator).`,
      linked_task_id: task?.task_id ?? "TASK-103",
    });
  }

  if (mentionsProjector) {
    const task = tasks.find((t) => t.source_promise_id === "P-004");
    const space = runner.check_event_space("projector", "2026-07-18T14:00:00", "MR-BLUE");
    matched_promises.push({
      promise_id: "P-004",
      promise_text:
        ledger.find((p) => p.promise_id === "P-004")?.promise_text ?? "Projector in meeting room",
      failure_type: "incorrect_due_time",
      failure_point: "events_task_due_time_set_to_meeting_start",
      root_cause:
        `Events task ${task?.task_id ?? "TASK-102"} due_at was ${task?.due_at ?? "2026-07-18T14:00:00"} (meeting start), ` +
        `but SOP-EVT-004 required ${space.recommended_task_due_at} (meeting_start - ${space.setup_lead_time_minutes}m).`,
      linked_task_id: task?.task_id ?? "TASK-102",
    });
  }

  const trace: TraceResult = {
    complaint_id: "CMP-001",
    booking_id,
    complaint_text,
    matched_promises,
    recovery_plan: [
      {
        department: "front_desk",
        action:
          "Offer VP immediate move to room 504 after inspection, or provide service recovery credit.",
        urgency: "immediate",
      },
      {
        department: "events",
        action: "Send technician to MR-BLUE immediately with projector and HDMI adapter.",
        urgency: "immediate",
      },
      {
        department: "manager",
        action: "Send apology and corrective action note to company contact.",
        urgency: "same_day",
      },
    ],
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

  return trace;
}

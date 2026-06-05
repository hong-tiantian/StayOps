import { ToolCall } from "./types";

/**
 * Translates internal engine identifiers (tool names, failure codes) into plain
 * operator-facing language. The raw codes are still available for traceability,
 * but the product surface should read like an operations log — not source code.
 */

const TOOL_LABELS: Record<string, string> = {
  check_data_freshness: "Checked data freshness",
  get_reservation: "Loaded reservation",
  search_messages: "Read booking messages",
  check_room_readiness: "Checked room readiness",
  check_inventory: "Checked equipment availability",
  retrieve_sop: "Retrieved hotel policy (SOP)",
  check_event_space: "Checked meeting-room availability",
  create_ops_task: "Created a department task",
  log_promise_decision: "Recorded the decision",
  trace_broken_promise: "Traced the broken promise",
};

const TOOL_ICONS: Record<string, string> = {
  check_data_freshness: "🛰",
  get_reservation: "📄",
  search_messages: "✉️",
  check_room_readiness: "🛏",
  check_inventory: "📦",
  retrieve_sop: "📐",
  check_event_space: "📽",
  create_ops_task: "🧾",
  log_promise_decision: "✓",
  trace_broken_promise: "🔎",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

export function toolIcon(name: string): string {
  return TOOL_ICONS[name] ?? "•";
}

/** A short, human one-liner describing what a tool call actually did. */
export function describeCall(call: ToolCall): string {
  const input = (call.input ?? {}) as Record<string, unknown>;
  const out = (call.output ?? {}) as Record<string, unknown>;
  switch (call.tool_name) {
    case "check_data_freshness":
      return `“${input.source_name}” data is ${
        (out as any).freshness_status ?? "checked"
      } (${(out as any).age_minutes}m old, limit ${(out as any).max_allowed_age_minutes}m).`;
    case "get_reservation":
      return `Reservation ${(out as any)?.booking_id ?? input.booking_id} for ${
        (out as any)?.company_name ?? "the group"
      }.`;
    case "search_messages":
      return `Reviewed ${Array.isArray(out) ? out.length : 0} messages on the booking.`;
    case "check_room_readiness": {
      const ready = (out as any).available_ready_count ?? 0;
      const later = (out as any).available_later_count ?? 0;
      return `${ready} room(s) ready at arrival, ${later} ready later → ${(out as any).recommendation}.`;
    }
    case "check_inventory":
      return `${input.item_type}: ${(out as any).available_count} available in ${
        (out as any).location
      }.`;
    case "retrieve_sop":
      return `Found ${Array.isArray(out) ? out.length : 0} policy rule(s) for “${
        input.promise_type
      }”.`;
    case "check_event_space":
      return `${(out as any).space_id} available; recommended setup by ${(out as any).recommended_task_due_at}.`;
    case "create_ops_task":
      return `Created ${(out as any)?.task_id} for ${(out as any)?.department}.`;
    case "log_promise_decision":
      return `Logged ${input.promise_id} as “${input.status}”.`;
    case "trace_broken_promise":
      return `Traced complaint to the responsible promise(s).`;
    default:
      return "";
  }
}

const FAILURE_POINTS: Record<string, string> = {
  front_desk_room_blocking_task_not_completed:
    "Front desk never locked a suitable quiet room",
  events_task_due_time_set_to_meeting_start:
    "Projector setup was scheduled for the meeting start, not before it",
};

const FAILURE_TYPES: Record<string, string> = {
  task_not_completed: "Task not completed",
  incorrect_due_time: "Wrong due time",
};

export function failurePointLabel(code: string): string {
  return FAILURE_POINTS[code] ?? code.replace(/_/g, " ");
}

export function failureTypeLabel(code: string): string {
  return FAILURE_TYPES[code] ?? code.replace(/_/g, " ");
}

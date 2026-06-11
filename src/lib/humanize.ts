import { PromiseDecision, ToolCall } from "./types";
import { Lang } from "./i18n";

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

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
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

/* ------------------------------------------------------------------ */
/* Department labels                                                   */
/* ------------------------------------------------------------------ */

const DEPT_LABELS: Record<string, { en: string; zh: string }> = {
  front_desk: { en: "Front desk", zh: "前台" },
  housekeeping: { en: "Housekeeping", zh: "客房部" },
  fb: { en: "F&B", zh: "餐饮部" },
  events: { en: "Events", zh: "会务部" },
  sales: { en: "Sales", zh: "销售部" },
  concierge: { en: "Concierge", zh: "礼宾部" },
  manager: { en: "Manager", zh: "经理" },
  maintenance: { en: "Maintenance", zh: "工程部" },
};

export function deptLabel(dept: string, lang: Lang = "en"): string {
  return DEPT_LABELS[dept]?.[lang] ?? dept.replace(/_/g, " ");
}

/* ------------------------------------------------------------------ */
/* SOP & required-field codes → plain operator language                */
/* ------------------------------------------------------------------ */

const SOP_LABELS: Record<string, { en: string; zh: string }> = {
  "SOP-ECI-001": { en: "the early check-in policy", zh: "提前入住政策" },
  "SOP-ROOM-002": { en: "the VIP quiet-room policy", zh: "VIP 静音房政策" },
  "SOP-FB-003": { en: "the dietary-notice policy", zh: "餐饮饮食通知政策" },
  "SOP-EVT-004": { en: "the AV setup lead-time policy", zh: "投影布置提前量政策" },
  "SOP-TRN-005": { en: "the airport-transfer info policy", zh: "接送机信息政策" },
  "SOP-BIL-006": { en: "the corporate invoice policy", zh: "公司发票政策" },
  "SOP-UPG-007": { en: "the room-upgrade policy", zh: "升房审批政策" },
};

export function sopLabel(code: string, lang: Lang = "en"): string {
  return SOP_LABELS[code]?.[lang] ?? code;
}

const FIELD_LABELS: Record<string, { en: string; zh: string }> = {
  manager_approval: { en: "manager approval", zh: "经理批准" },
  revenue_manager_approval: { en: "revenue-manager approval", zh: "收益经理批准" },
  room_block: { en: "a room blocked & held", zh: "预留并锁定房间" },
  flight_number: { en: "flight number", zh: "航班号" },
  arrival_time: { en: "arrival time", zh: "到店时间" },
  passenger_count: { en: "passenger count", zh: "乘客人数" },
  phone_number: { en: "contact phone", zh: "联系电话" },
  billing_contact: { en: "billing contact", zh: "账单联系人" },
  legal_company_name: { en: "legal company name", zh: "公司注册全称" },
  tax_id: { en: "tax ID", zh: "税号" },
  billing_address: { en: "billing address", zh: "账单地址" },
  room_readiness: { en: "room-readiness data", zh: "房态数据" },
  event_space: { en: "event-space schedule", zh: "会议室排期" },
  fnb_inventory: { en: "F&B inventory", zh: "餐饮库存" },
  transport_vendor: { en: "transport vendor data", zh: "用车供应商数据" },
  // SOP deadline-rule codes that leak into evidence prose.
  service_date_minus_1_day_17_00: { en: "17:00 the day before service", zh: "服务日前一天 17:00" },
  meeting_start_minus_120_minutes: { en: "120 minutes before the meeting starts", zh: "会议开始前 120 分钟" },
  arrival_minus_1_day: { en: "the day before arrival", zh: "到店前一天" },
  departure_date: { en: "the departure date", zh: "离店日" },
};

export function fieldLabel(code: string, lang: Lang = "en"): string {
  return FIELD_LABELS[code]?.[lang] ?? code.replace(/_/g, " ");
}

/** Replace SOP codes and snake_case field tokens inside backend prose so the
    manager never reads source-code identifiers. */
export function humanizeOpsText(text: string, lang: Lang = "en"): string {
  if (!text) return text;
  let out = text.replace(/SOP-[A-Z]{2,4}-\d{3}/g, (code) => sopLabel(code, lang));
  for (const [code, labels] of Object.entries(FIELD_LABELS)) {
    out = out.replace(new RegExp(`\\b${code}\\b`, "g"), labels[lang]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Effective status — keeps lists and the detail drawer consistent     */
/* ------------------------------------------------------------------ */

/** Once the manager approves, every surface should read "approved" —
    not the pre-approval status the audit produced. */
export function effectiveStatus(d: PromiseDecision, approved: Set<string>): string {
  if (d.approval_required && approved.has(d.promise_id) && (d.status === "needs_approval" || d.status === "at_risk")) {
    return "approved";
  }
  return d.status;
}

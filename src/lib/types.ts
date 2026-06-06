export type PromiseType =
  | "confirmed_commitment"
  | "request_noted"
  | "preference"
  | "operational_requirement"
  | "commercial_requirement"
  | "missing_info_request"
  | "risk_sensitive_request";

export type PromiseStatus =
  | "verifiable"
  | "at_risk"
  | "missing_info"
  | "conflict"
  | "needs_approval"
  | "cannot_confirm"
  | "approved"
  | "task_created"
  | "completed"
  | "failed"
  | "resolved";

export type Department =
  | "front_desk"
  | "housekeeping"
  | "fb"
  | "events"
  | "sales"
  | "concierge"
  | "manager"
  | "maintenance";

export interface ToolCall {
  tool_name: string;
  input: unknown;
  output: unknown;
  called_at: string;
}

export interface PromiseDecision {
  promise_id: string;
  booking_id: string;
  promise_text: string;
  promise_type: PromiseType[];
  status: PromiseStatus;
  owner_department: Department;
  source_message_id?: string;
  source_quote?: string;
  evidence: string[];
  risk_reason: string;
  recommended_action: string;
  approval_required: boolean;
  execution_state: string;
  linked_task_id?: string;
  tool_calls: ToolCall[];
  /** True when managers have repeatedly approved this promise — learned fast-track. */
  learned_fast_track?: boolean;
}

export interface RecoveryTrace {
  complaint_id: string;
  booking_id: string;
  complaint_text: string;
  matched_promises: Array<{
    promise_id: string;
    promise_text: string;
    failure_type: string;
    failure_point: string;
    root_cause: string;
    linked_task_id?: string;
  }>;
  recovery_plan: Array<{
    department: Department;
    action: string;
    urgency: "immediate" | "same_day" | "next_day";
  }>;
  guest_reply_draft: string;
  postmortem_suggestions: string[];
}

// ---- Raw CSV row shapes ----

export interface Message {
  message_id: string;
  booking_id: string;
  channel: string;
  sender: string;
  received_at: string;
  message_type: string;
  body: string;
}

export interface Reservation {
  booking_id: string;
  company_name: string;
  arrival_date: string;
  arrival_time: string;
  departure_date: string;
  room_count: number;
  king_count: number;
  twin_count: number;
  meeting_room_id: string;
  primary_contact: string;
  status: string;
}

export interface RoomInventory {
  room_id: string;
  room_type: string;
  floor: number;
  quiet_zone: boolean;
  near_elevator: boolean;
  blocked_for_booking_id: string;
  next_arrival_booking_id: string;
}

export interface RoomReadiness {
  room_id: string;
  date: string;
  clean_status: string;
  estimated_ready_at: string;
  inspected: boolean;
  assigned_housekeeper: string;
}

export interface HousekeepingRoster {
  staff_id: string;
  staff_name: string;
  shift_start: string;
  shift_end: string;
  capacity_minutes: number;
  assigned_minutes: number;
}

export interface SopRule {
  policy_id: string;
  promise_type: string;
  rule: string;
  approval_required: boolean;
  department: Department;
  deadline_rule: string;
}

export interface EventSpace {
  space_id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  projector: boolean;
  screen: boolean;
  hdmi_adapter: boolean;
  setup_lead_time_minutes: number;
  status: string;
}

export interface BillingAccount {
  booking_id: string;
  company_name: string;
  billing_contact: string;
  tax_id: string;
  billing_address: string;
  payment_terms: string;
  status: string;
}

export interface TransportVendor {
  vendor_id: string;
  vendor_name: string;
  date: string;
  available_vehicle_count: number;
  requires_flight_number: boolean;
  requires_arrival_time: boolean;
  status: string;
}

export interface SyncStatus {
  source_name: string;
  last_synced_at: string;
  max_allowed_age_minutes: number;
}

export interface ApprovalRecord {
  approval_id: string;
  booking_id: string;
  promise_id: string;
  approved_by: string;
  approved_at: string;
  decision: string;
  notes: string;
}

export interface OpsTask {
  task_id: string;
  booking_id: string;
  source_promise_id: string;
  department: Department;
  description: string;
  due_at: string;
  status: string;
  owner: string;
  completed_at: string;
}

export interface PromiseLedgerRow {
  promise_id: string;
  booking_id: string;
  promise_text: string;
  promise_type: string;
  status: PromiseStatus;
  owner_department: Department;
  evidence: string;
  risk_reason: string;
  recommended_action: string;
  approval_required: boolean;
  execution_state: string;
  /** Promise category (early_check_in, quiet_room, upgrade, parking, ...) — drives policy rules. */
  category: string;
}

export interface FreshnessResult {
  source_name: string;
  last_synced_at: string;
  max_allowed_age_minutes: number;
  age_minutes: number;
  freshness_status: "fresh" | "stale";
}

export interface TimelineEvent {
  at: string;
  category: "promise" | "approval" | "task" | "complaint" | "recovery" | "system";
  label: string;
  detail?: string;
}

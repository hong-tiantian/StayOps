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

export type IntakeScope =
  | "individual_stay"
  | "group_stay"
  | "corporate_group"
  | "corporate_group_event"
  | "event_booking"
  | "vip_stay"
  | "long_stay"
  | "unknown";

export type BasicInfoStatus = "complete" | "missing_info" | "conflict" | "cannot_confirm";

export type ExtraItemDomain =
  | "arrival_exception"
  | "room_preference"
  | "fb_requirement"
  | "event_av"
  | "transport"
  | "commercial"
  | "exception_value"
  | "maintenance_service"
  | "lost_and_found"
  | "other";

export type ExtraItemClarity = "clear" | "unclear" | "missing_required_fields";

export type VerificationRoute =
  | "self_verifiable"
  | "needs_human_approval"
  | "missing_guest_info"
  | "cannot_confirm_yet"
  | "conflict_with_policy_or_inventory";

export type RuleKey =
  | "early_check_in"
  | "quiet_room"
  | "gluten_free_breakfast"
  | "projector_setup"
  | "airport_transfer"
  | "company_invoice"
  | "upgrade"
  | "high_floor"
  | "parking"
  | "long_stay_discount"
  | "lost_and_found"
  | "maintenance";

export type TaskPlanAction =
  | "none"
  | "create_task"
  | "create_follow_up"
  | "request_manager_approval"
  | "draft_cautious_reply"
  | "escalate";

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
  /** Case-memory entries this decision drew on — the "learned from N past cases" provenance. */
  learning_provenance?: Array<{
    scenario: string;
    lesson: string;
    source: string;
    similarity: number;
  }>;
  /** Status the Gemini/ADK agent proposed BEFORE policy adjudication (absent on rules-only path). */
  agent_proposed_status?: string;
  /** True when the deterministic safety gate overrode the agent's proposed status. */
  policy_overruled?: boolean;
}

export interface InfoAnalysis {
  booking_id: string;
  source_channel?: string;
  intake_scope: IntakeScope;
  basic_info_status: BasicInfoStatus;
  basic_info: Record<string, unknown>;
  missing_basic_fields: string[];
  extra_items: ExtraItem[];
}

export interface ExtraItem {
  item_id: string;
  text: string;
  source_message_id?: string;
  source_quote?: string;
  domain: ExtraItemDomain;
  subtype?: string;
  clarity: ExtraItemClarity;
  required_fields: string[];
  missing_fields: string[];
  verification_route?: VerificationRoute;
  rule_key?: string;
}

export interface TaskPlan {
  item_id: string;
  action_type: TaskPlanAction;
  department?: Department;
  description?: string;
  due_at?: string;
  guest_reply_draft?: string;
  manager_prompt?: string;
  reason: string;
}

export interface AgentTraceStage {
  stage_id:
    | "info_analysis"
    | "verification_agent"
    | "decision_rules"
    | "task_planning"
    | "evaluation_recovery"
    | "arize_monitoring";
  label: string;
  status: "complete" | "pending" | "fallback" | "not_run";
  summary: string;
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
  /** Compatibility field: internal rule key (early_check_in, quiet_room, upgrade, parking, ...) used by policy rules. */
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

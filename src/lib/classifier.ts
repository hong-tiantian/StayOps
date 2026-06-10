import { loadPromiseLedger, getOpsTasks } from "./data";
import { ToolRunner } from "./tools";
import { allFreshness } from "./freshness";
import { runPromiseAgent, AgentProposal } from "./agent/promiseAgent";
import { rulePromiseStatus, alignPromiseRuleKey, reconcileStatus } from "./agent/policy";
import { isFastTrack } from "./learning/feedbackStore";
import { adkConfigured, runAdkAgent } from "./agent/adkClient";
import { analyzeBookingInfo } from "./infoAnalysis";
import { planTasks } from "./taskPlanner";
import {
  AgentTraceStage,
  Department,
  ExtraItem,
  InfoAnalysis,
  Message,
  PromiseDecision,
  PromiseStatus,
  PromiseType,
  Reservation,
  TaskPlan,
  ToolCall,
} from "./types";

/**
 * Promise audit orchestration.
 *
 * LLM/ADK reads the actual messages and proposes extracted promises. The
 * deterministic policy remains the final safety gate, but the ledger is no
 * longer the source of which promises exist.
 */

const DEFAULT_INTAKE_BOOKING_ID = "INTAKE-UNMAPPED";

function linkedTaskFor(promise_id: string): string | undefined {
  return getOpsTasks().find((t) => t.source_promise_id === promise_id)?.task_id;
}

function splitTypes(raw: string): PromiseType[] {
  return raw.split(";").map((t) => t.trim()).filter(Boolean) as PromiseType[];
}

export interface AuditResult {
  booking_id: string;
  reasoning_source: "adk" | "gemini" | "rules";
  info_analysis: InfoAnalysis;
  agent_trace: AgentTraceStage[];
  decisions: PromiseDecision[];
  task_plan: TaskPlan[];
  tool_calls: ToolCall[];
  freshness_summary: Array<{
    source_name: string;
    last_synced_at: string;
    freshness_status: "fresh" | "stale";
    age_minutes: number;
    max_allowed_age_minutes: number;
  }>;
}

interface DecisionSeed {
  promise_id: string;
  booking_id: string;
  promise_text: string;
  promise_type: string;
  owner_department: string;
  evidence: string;
  risk_reason: string;
  recommended_action: string;
  approval_required: boolean;
  execution_state: string;
  category: string;
}

const DEFAULT_SEEDS: Record<string, Omit<DecisionSeed, "promise_id" | "booking_id" | "promise_text" | "category">> = {
  early_check_in: {
    promise_type: "request_noted",
    owner_department: "front_desk",
    evidence: "Guest requested arrival before standard check-in.",
    risk_reason: "Room readiness is uncertain before official check-in.",
    recommended_action: "Reply that early arrival is noted but cannot be guaranteed",
    approval_required: true,
    execution_state: "not_created",
  },
  quiet_room: {
    promise_type: "preference;risk_sensitive_request",
    owner_department: "front_desk",
    evidence: "Guest requested a quiet room constraint.",
    risk_reason: "Limited quiet-zone inventory and room blocking required.",
    recommended_action: "Manager approval and room-blocking task",
    approval_required: true,
    execution_state: "task_created",
  },
  gluten_free_breakfast: {
    promise_type: "operational_requirement",
    owner_department: "fb",
    evidence: "Guest requested gluten-free breakfast.",
    risk_reason: "Deadline sensitive",
    recommended_action: "Create F&B notification task",
    approval_required: false,
    execution_state: "completed",
  },
  projector_setup: {
    promise_type: "operational_requirement",
    owner_department: "events",
    evidence: "Guest requested meeting-room AV equipment.",
    risk_reason: "Setup deadline must precede meeting start.",
    recommended_action: "Create events setup task due before meeting start",
    approval_required: false,
    execution_state: "task_created",
  },
  airport_transfer: {
    promise_type: "missing_info_request;operational_requirement",
    owner_department: "concierge",
    evidence: "Guest requested airport transport.",
    risk_reason: "Cannot book transfer without required flight and contact details",
    recommended_action: "Ask guest for flight number, arrival time, passenger count, phone",
    approval_required: false,
    execution_state: "follow_up_created",
  },
  company_invoice: {
    promise_type: "commercial_requirement",
    owner_department: "sales",
    evidence: "Guest requested company billing.",
    risk_reason: "Cannot issue company invoice without required billing details",
    recommended_action: "Ask company for billing details",
    approval_required: false,
    execution_state: "follow_up_created",
  },
  upgrade: {
    promise_type: "preference",
    owner_department: "front_desk",
    evidence: "Guest requested an upgrade.",
    risk_reason: "Free upgrade is a giveaway requiring manager discretion",
    recommended_action: "Escalate to manager for upgrade decision",
    approval_required: true,
    execution_state: "not_created",
  },
  high_floor: {
    promise_type: "preference",
    owner_department: "front_desk",
    evidence: "Guest requested a high-floor room.",
    risk_reason: "High-floor quiet rooms are subject to availability",
    recommended_action: "Check high-floor readiness and assign a suitable room",
    approval_required: false,
    execution_state: "not_created",
  },
  parking: {
    promise_type: "missing_info_request",
    owner_department: "front_desk",
    evidence: "Guest asked about parking.",
    risk_reason: "Cannot reserve parking without arrival and vehicle details",
    recommended_action: "Ask guest for vehicle plate and arrival time",
    approval_required: false,
    execution_state: "follow_up_created",
  },
  long_stay_discount: {
    promise_type: "commercial_requirement",
    owner_department: "sales",
    evidence: "Guest requested a long-stay discount.",
    risk_reason: "Discount is a revenue giveaway needing manager discretion",
    recommended_action: "Escalate to revenue manager with occupancy forecast",
    approval_required: true,
    execution_state: "not_created",
  },
  lost_and_found: {
    promise_type: "request_noted",
    owner_department: "front_desk",
    evidence: "Guest requested a lost-item search.",
    risk_reason: "Item must be located before any confirmation",
    recommended_action: "Front desk checks log and storage; dispatch housekeeping if needed",
    approval_required: false,
    execution_state: "not_created",
  },
  maintenance: {
    promise_type: "operational_requirement",
    owner_department: "maintenance",
    evidence: "Guest reported a maintenance issue.",
    risk_reason: "Subject to technician availability",
    recommended_action: "Create maintenance ticket for on-call technician",
    approval_required: false,
    execution_state: "not_created",
  },
};

function seedForExtraItem(extraItem: ExtraItem, bookingId: string): DecisionSeed {
  const ruleKey = extraItem.rule_key ?? "unknown";
  const existing = loadPromiseLedger().find((p) => p.booking_id === bookingId && p.category === ruleKey);
  if (existing) {
    return {
      promise_id: existing.promise_id,
      booking_id: existing.booking_id,
      promise_text: extraItem.text || existing.promise_text,
      promise_type: existing.promise_type,
      owner_department: existing.owner_department,
      evidence: existing.evidence,
      risk_reason: existing.risk_reason,
      recommended_action: existing.recommended_action,
      approval_required: existing.approval_required,
      execution_state: existing.execution_state,
      category: existing.category,
    };
  }

  const fallback = DEFAULT_SEEDS[ruleKey] ?? {
    promise_type: "request_noted",
    owner_department: "manager",
    evidence: "Guest message contains an extra item that needs review.",
    risk_reason: "No deterministic verifier is available for this item.",
    recommended_action: "Manager reviews before making any commitment.",
    approval_required: true,
    execution_state: "not_created",
  };

  return {
    promise_id: extraItem.item_id,
    booking_id: bookingId,
    promise_text: extraItem.text,
    category: ruleKey,
    ...fallback,
  };
}

function applyBasicInfoGate(status: PromiseStatus, infoAnalysis: InfoAnalysis): PromiseStatus {
  if (infoAnalysis.basic_info_status === "complete") return status;
  if (status !== "verifiable") return status;
  if (infoAnalysis.basic_info_status === "conflict") return "conflict";
  if (infoAnalysis.basic_info_status === "cannot_confirm") return "cannot_confirm";
  return "missing_info";
}

function buildDecision(
  row: DecisionSeed,
  status: PromiseStatus,
  evidence: string[],
  tool_calls: ToolCall[],
  proposal?: AgentProposal,
  extraItem?: ExtraItem,
  overruled?: boolean
): PromiseDecision {
  const fast = isFastTrack(row.promise_id);
  const finalEvidence = fast
    ? [...evidence, "Learned: managers have fast-tracked this promise before; suggest pre-approval."]
    : evidence;

  return {
    promise_id: row.promise_id,
    booking_id: row.booking_id,
    promise_text: row.promise_text,
    promise_type: splitTypes(row.promise_type),
    status,
    owner_department: row.owner_department as Department,
    source_message_id: extraItem?.source_message_id || proposal?.source_message_id,
    source_quote: proposal?.source_quote || extraItem?.source_quote,
    evidence: finalEvidence,
    risk_reason: row.risk_reason,
    recommended_action: row.recommended_action,
    approval_required: row.approval_required,
    execution_state: row.execution_state,
    linked_task_id: linkedTaskFor(row.promise_id),
    tool_calls,
    learned_fast_track: fast,
    agent_proposed_status: proposal?.proposed_status,
    policy_overruled: overruled ?? false,
  };
}

function freshnessSummary() {
  return allFreshness().map((f) => ({
    source_name: f.source_name,
    last_synced_at: f.last_synced_at,
    freshness_status: f.freshness_status,
    age_minutes: f.age_minutes,
    max_allowed_age_minutes: f.max_allowed_age_minutes,
  }));
}

async function runAgentAudit(booking_id: string, messageOverride?: Message[]): Promise<AuditResult> {
  const intake = new ToolRunner();
  const reservation = intake.get_reservation(booking_id);
  const messages = messageOverride ?? intake.search_messages(booking_id);
  const agent = await runPromiseAgent(messages, reservation);
  return assembleFromProposals(booking_id, reservation, messages, agent.proposals, "gemini", agent.runner.calls, intake.calls);
}

function assembleFromProposals(
  booking_id: string,
  reservation: Reservation | null,
  messages: Message[],
  proposals: AgentProposal[],
  source: "gemini" | "adk",
  agentToolCalls: ToolCall[],
  intakeCalls: ToolCall[]
): AuditResult {
  const infoAnalysis = analyzeBookingInfo(booking_id, reservation, messages, proposals);
  const extraByRuleKey = new Map(infoAnalysis.extra_items.map((item) => [item.rule_key, item]));
  const proposalByRuleKey = new Map<string, AgentProposal>();

  for (const proposal of proposals) {
    const ruleKey = proposal.rule_key || alignPromiseRuleKey(`${proposal.promise_text}\n${proposal.source_quote ?? ""}`);
    if (ruleKey && !proposalByRuleKey.has(ruleKey)) proposalByRuleKey.set(ruleKey, proposal);
  }

  const policyCalls: ToolCall[] = [];
  const decisions = infoAnalysis.extra_items.map((extraItem) => {
    const row = seedForExtraItem(extraItem, booking_id);
    const ruleKey = extraItem.rule_key ?? row.category;
    const proposal = proposalByRuleKey.get(ruleKey);
    const policyRunner = new ToolRunner();
    const verdict = rulePromiseStatus(ruleKey, policyRunner, reservation);
    policyCalls.push(...policyRunner.calls);

    const gatedStatus = applyBasicInfoGate(verdict.status, infoAnalysis);
    const { overruled } = reconcileStatus(gatedStatus, proposal?.proposed_status);
    const evidence = [row.evidence, ...verdict.evidence];

    if (gatedStatus !== verdict.status) {
      evidence.push(
        `Basic-info gate: ${infoAnalysis.basic_info_status}; missing fields: ${infoAnalysis.missing_basic_fields.join(", ") || "none"}.`
      );
    }

    if (proposal) {
      if (overruled) {
        evidence.push(
          `Policy guardrail: agent proposed "${proposal.proposed_status}" -> policy set "${gatedStatus}" from fresh evidence.`
        );
      }
      for (const item of proposal.evidence ?? []) evidence.push(`AI: ${item}`);
    }

    return buildDecision(row, gatedStatus, evidence, policyRunner.calls, proposal, extraByRuleKey.get(ruleKey), overruled);
  });
  const taskPlan = planTasks(infoAnalysis, decisions);

  return {
    booking_id,
    reasoning_source: source,
    info_analysis: infoAnalysis,
    agent_trace: buildAgentTrace(source, infoAnalysis, decisions, taskPlan),
    decisions,
    task_plan: taskPlan,
    tool_calls: [...intakeCalls, ...agentToolCalls, ...policyCalls],
    freshness_summary: freshnessSummary(),
  };
}

async function runAdkAudit(booking_id: string, messageOverride?: Message[]): Promise<AuditResult> {
  const intake = new ToolRunner();
  const reservation = intake.get_reservation(booking_id);
  const messages = messageOverride ?? intake.search_messages(booking_id);
  const adk = await runAdkAgent(booking_id, messages);
  return assembleFromProposals(booking_id, reservation, messages, adk.proposals, "adk", adk.tool_calls, intake.calls);
}

export function runDeterministicAudit(booking_id: string, messageOverride?: Message[]): AuditResult {
  const intake = new ToolRunner();
  const reservation = intake.get_reservation(booking_id);
  const messages = messageOverride ?? intake.search_messages(booking_id);
  const infoAnalysis = analyzeBookingInfo(booking_id, reservation, messages);
  const extraByRuleKey = new Map(infoAnalysis.extra_items.map((item) => [item.rule_key, item]));
  const allCalls: ToolCall[] = [...intake.calls];

  const decisions = infoAnalysis.extra_items.map((extraItem) => {
    const row = seedForExtraItem(extraItem, booking_id);
    const ruleKey = extraItem.rule_key ?? row.category;
    const policyRunner = new ToolRunner();
    const verdict = rulePromiseStatus(ruleKey, policyRunner, reservation);
    allCalls.push(...policyRunner.calls);

    const gatedStatus = applyBasicInfoGate(verdict.status, infoAnalysis);
    const evidence = [row.evidence, ...verdict.evidence];
    if (gatedStatus !== verdict.status) {
      evidence.push(
        `Basic-info gate: ${infoAnalysis.basic_info_status}; missing fields: ${infoAnalysis.missing_basic_fields.join(", ") || "none"}.`
      );
    }

    return buildDecision(row, gatedStatus, evidence, policyRunner.calls, undefined, extraByRuleKey.get(ruleKey));
  });
  const taskPlan = planTasks(infoAnalysis, decisions);

  return {
    booking_id,
    reasoning_source: "rules",
    info_analysis: infoAnalysis,
    agent_trace: buildAgentTrace("rules", infoAnalysis, decisions, taskPlan),
    decisions,
    task_plan: taskPlan,
    tool_calls: allCalls,
    freshness_summary: freshnessSummary(),
  };
}

function buildAgentTrace(
  source: AuditResult["reasoning_source"],
  infoAnalysis: InfoAnalysis,
  decisions: PromiseDecision[],
  taskPlan: TaskPlan[]
): AgentTraceStage[] {
  const approvalCount = taskPlan.filter((plan) => plan.action_type === "request_manager_approval").length;
  const followUpCount = taskPlan.filter((plan) => plan.action_type === "create_follow_up").length;
  const taskCount = taskPlan.filter((plan) => plan.action_type === "create_task").length;

  return [
    {
      stage_id: "info_analysis",
      label: "Info Analysis",
      status: "complete",
      summary: `${infoAnalysis.intake_scope}; basic info ${infoAnalysis.basic_info_status}; ${infoAnalysis.extra_items.length} extra item(s) extracted.`,
    },
    {
      stage_id: "verification_agent",
      label: "Verification Agent",
      status: source === "rules" ? "fallback" : "complete",
      summary:
        source === "adk"
          ? "ADK / Agent Builder path proposed evidence-backed results."
          : source === "gemini"
            ? "In-app Gemini loop proposed evidence-backed results."
            : "Agent unavailable; deterministic tools and rules produced the audit.",
    },
    {
      stage_id: "decision_rules",
      label: "Decision Rules / Safety Gate",
      status: "complete",
      summary: `${decisions.length} decision(s) adjudicated; final executable statuses come from deterministic policy.`,
    },
    {
      stage_id: "task_planning",
      label: "Task Planning Agent",
      status: "complete",
      summary: `${taskCount} task handoff(s), ${approvalCount} manager review request(s), ${followUpCount} follow-up(s).`,
    },
    {
      stage_id: "evaluation_recovery",
      label: "Evaluation & Recovery",
      status: "pending",
      summary: "Runs when a complaint is submitted; traces complaint signals to ledger items and linked tasks.",
    },
    {
      stage_id: "arize_monitoring",
      label: "Arize Monitoring / Audit",
      status: "pending",
      summary: "Phoenix tracing/self-review is observational only; it does not change business decisions.",
    },
  ];
}

const auditCache = new Map<string, AuditResult>();

export function clearAuditCache(): void {
  auditCache.clear();
}

export async function runPromiseAudit(booking_id: string, opts?: { force?: boolean }): Promise<AuditResult> {
  if (!opts?.force) {
    const cached = auditCache.get(booking_id);
    if (cached) return cached;
  }

  if (adkConfigured()) {
    try {
      const result = await runAdkAudit(booking_id);
      auditCache.set(booking_id, result);
      return result;
    } catch (err) {
      console.warn("[StayOps] ADK (Agent Builder) unavailable, falling back to in-app loop:", err);
    }
  }

  try {
    const result = await runAgentAudit(booking_id);
    auditCache.set(booking_id, result);
    return result;
  } catch (err) {
    console.warn("[StayOps] Gemini agent unavailable, using deterministic fallback:", err);
    return runDeterministicAudit(booking_id);
  }
}

type MessageLike = Message | {
  body_text?: string;
  body?: string;
  booking_id?: string;
  channel?: string;
  source?: string;
  sender?: string;
  received_at?: string;
  subject?: string;
  message_id?: string;
  message_type?: string;
};

export async function runPromiseAuditFromMessages(
  messages: MessageLike[],
  opts?: { booking_id?: string }
): Promise<AuditResult> {
  const bookingId = opts?.booking_id ?? messages.find((message) => message.booking_id)?.booking_id ?? DEFAULT_INTAKE_BOOKING_ID;
  const normalized: Message[] = messages.map((message, index) => ({
    message_id: message.message_id ?? `INTAKE-MSG-${String(index + 1).padStart(3, "0")}`,
    booking_id: bookingId,
    channel: message.channel ?? ("source" in message ? message.source : undefined) ?? "manual_paste",
    sender: message.sender ?? "unknown",
    received_at: message.received_at ?? new Date().toISOString(),
    message_type: message.message_type ?? "booking_request",
    body: message.body ?? ("body_text" in message ? message.body_text : undefined) ?? "",
  }));

  if (adkConfigured()) {
    try {
      return await runAdkAudit(bookingId, normalized);
    } catch (err) {
      console.warn("[StayOps] ADK (Agent Builder) unavailable for intake messages, falling back to in-app loop:", err);
    }
  }

  try {
    return await runAgentAudit(bookingId, normalized);
  } catch (err) {
    console.warn("[StayOps] Gemini agent unavailable for intake messages, using deterministic fallback:", err);
    return runDeterministicAudit(bookingId, normalized);
  }
}

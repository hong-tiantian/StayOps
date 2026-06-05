import { loadReservations, loadPromiseLedger, getOpsTasks } from "./data";
import { ToolRunner } from "./tools";
import { allFreshness } from "./freshness";
import { runPromiseAgent, AgentProposal } from "./agent/promiseAgent";
import { rulePromiseStatus, alignPromiseId, reconcileStatus } from "./agent/policy";
import { isFastTrack } from "./learning/feedbackStore";
import { Department, PromiseDecision, PromiseStatus, PromiseType, ToolCall } from "./types";

/**
 * Promise audit orchestration.
 *
 * Two paths share one deterministic policy (`rulePromiseStatus`) so they can
 * never disagree on the final executable status:
 *
 *   runAgentAudit  — Gemini function-calling agent extracts promises and gathers
 *                    evidence; the policy layer adjudicates the final status.
 *   runDeterministicAudit — offline fallback when Gemini is unavailable.
 *
 * `runPromiseAudit` tries the agent first and falls back automatically.
 */

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
  reasoning_source: "gemini" | "rules";
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

interface LedgerRow {
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

/** Build a PromiseDecision from a ledger row + an authoritative status verdict. */
function buildDecision(
  row: LedgerRow,
  status: PromiseStatus,
  evidence: string[],
  tool_calls: ToolCall[],
  proposal?: AgentProposal
): PromiseDecision {
  // Learning reflux: if managers have repeatedly approved this promise, surface
  // it as a fast-track suggestion on the next audit (status still set by policy).
  const fast = isFastTrack(row.promise_id);
  const finalEvidence = fast
    ? [...evidence, "💡 Learned: managers have fast-tracked this promise before — suggest pre-approval."]
    : evidence;
  return {
    promise_id: row.promise_id,
    booking_id: row.booking_id,
    promise_text: row.promise_text,
    promise_type: splitTypes(row.promise_type),
    status,
    owner_department: row.owner_department as Department,
    source_message_id: "MSG-001",
    source_quote: proposal?.source_quote || SOURCE_QUOTES[row.promise_id],
    evidence: finalEvidence,
    risk_reason: row.risk_reason,
    recommended_action: row.recommended_action,
    approval_required: row.approval_required,
    execution_state: row.execution_state,
    linked_task_id: linkedTaskFor(row.promise_id),
    tool_calls,
    learned_fast_track: fast,
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

/**
 * Agent path: Gemini autonomously extracts promises and gathers evidence; the
 * deterministic policy layer then decides the final status for each known promise.
 */
async function runAgentAudit(booking_id: string): Promise<AuditResult> {
  const intake = new ToolRunner();
  const reservation = intake.get_reservation(booking_id);
  const messages = intake.search_messages(booking_id);

  const agent = await runPromiseAgent(messages, reservation);

  // Index agent proposals by the stable ledger id they align to.
  const proposalById = new Map<string, AgentProposal>();
  for (const p of agent.proposals) {
    const id = alignPromiseId(p.promise_text);
    if (id && !proposalById.has(id)) proposalById.set(id, p);
  }

  const ledger = loadPromiseLedger().filter((p) => p.booking_id === booking_id);
  const decisions: PromiseDecision[] = ledger.map((row) => {
    const proposal = proposalById.get(row.promise_id);
    const policyRunner = new ToolRunner();
    const verdict = rulePromiseStatus(row.category, policyRunner, reservation);
    const { overruled } = reconcileStatus(verdict.status, proposal?.proposed_status);

    const evidence = [row.evidence, ...verdict.evidence];
    if (proposal) {
      if (overruled) {
        evidence.push(
          `Policy guardrail: agent proposed "${proposal.proposed_status}" → policy set "${verdict.status}" from fresh evidence.`
        );
      }
      for (const e of proposal.evidence ?? []) evidence.push(`AI: ${e}`);
    }
    return buildDecision(row, verdict.status, evidence, policyRunner.calls, proposal);
  });

  // Top-level log shows the agent's real function-calling exploration.
  const tool_calls = [...intake.calls, ...agent.runner.calls];
  return { booking_id, reasoning_source: "gemini", decisions, tool_calls, freshness_summary: freshnessSummary() };
}

/** Offline fallback: pure deterministic audit using the same policy verdicts. */
export function runDeterministicAudit(booking_id: string): AuditResult {
  const intake = new ToolRunner();
  const reservation = intake.get_reservation(booking_id);
  intake.search_messages(booking_id);

  const ledger = loadPromiseLedger().filter((p) => p.booking_id === booking_id);
  const allCalls: ToolCall[] = [...intake.calls];

  const decisions: PromiseDecision[] = ledger.map((row) => {
    const policyRunner = new ToolRunner();
    const verdict = rulePromiseStatus(row.category, policyRunner, reservation);
    allCalls.push(...policyRunner.calls);
    return buildDecision(row, verdict.status, [row.evidence, ...verdict.evidence], policyRunner.calls);
  });

  return { booking_id, reasoning_source: "rules", decisions, tool_calls: allCalls, freshness_summary: freshnessSummary() };
}

/** Caches successful agent audits so repeated demo runs return instantly. */
const auditCache = new Map<string, AuditResult>();

/** Clear cached audits — called when demo state changes (e.g. stale toggle). */
export function clearAuditCache(): void {
  auditCache.clear();
}

/**
 * Entry point. Returns a cached agent result when available; otherwise tries the
 * Gemini agent and, on any failure (no credentials, network, rate limit, bad
 * output), falls back to the deterministic audit so the demo never breaks.
 * Pass `{ force: true }` to bypass the cache and re-run the agent.
 */
export async function runPromiseAudit(
  booking_id: string,
  opts?: { force?: boolean }
): Promise<AuditResult> {
  if (!opts?.force) {
    const cached = auditCache.get(booking_id);
    if (cached) return cached;
  }
  try {
    const result = await runAgentAudit(booking_id);
    auditCache.set(booking_id, result); // cache only successful agent runs
    return result;
  } catch (err) {
    console.warn("[StayOps] Gemini agent unavailable, using deterministic fallback:", err);
    return runDeterministicAudit(booking_id);
  }
}

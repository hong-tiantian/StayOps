import fs from "fs";
import path from "path";
import type { AuditResult } from "@/lib/classifier";
import type { TraceResult } from "@/lib/recovery";
import type { AuditTraceSummary } from "@/lib/evaluation/phoenixTrace";
import { DEMO_NOW } from "@/lib/freshness";

export type PromiseExpectation = {
  label: string;
  expected_status: string;
  required_tools: string[];
  approval_required: boolean;
  forbid_statuses: string[];
  evidence_must_mention: string[];
};

export type ExpectedFailure = {
  promise_id: string;
  failure_type: string;
  expected_due_at?: string;
  observed_due_at?: string;
  root_cause_must_mention: string[];
};

export type EvalCaseMetadata = {
  source_type: string;
  complaint_text: string;
  must_match_promises: string[];
  expected_failures: ExpectedFailure[];
  required_global_tools: string[];
};

export type BookingEvalCase = {
  case: EvalCaseMetadata;
  expectations: Record<string, PromiseExpectation>;
};

type GoldenBooking = Record<string, PromiseExpectation | EvalCaseMetadata | unknown>;
type GoldenFile = Record<string, GoldenBooking | unknown>;

type RatioMetric = {
  passed: number;
  total: number;
};

export interface DemoMetricsResult {
  booking_id: string;
  evaluated_at: string;
  reasoning_source: AuditResult["reasoning_source"];
  golden_source: string;
  case_source_type: string;
  overall_passed: boolean;
  extraction_recall: RatioMetric;
  classification_accuracy: RatioMetric;
  approval_compliance: RatioMetric;
  policy_override_rate: RatioMetric;
  unsafe_overpromise_count: number;
  missing_info_recall: RatioMetric;
  human_control_coverage: RatioMetric;
  evidence_coverage: RatioMetric;
  tool_call_coverage: RatioMetric;
  global_tool_coverage: RatioMetric;
  complaint_trace: {
    expected_match_coverage: RatioMetric;
    expected_failure_coverage: RatioMetric;
    matched_promise_ids: string[];
    missing_promise_ids: string[];
  };
  expected_failures: Array<{
    promise_id: string;
    failure_type: string;
    passed: boolean;
  }>;
  arize_trace_present: boolean;
  phoenix_trace_id: string | null;
  phoenix_trace_url: string | null;
  latency_ms: number;
  manual_lookup_sources_checked: number;
  cost_estimate_usd: null;
  business_impact_basis: {
    latency: "measured_app_request";
    manual_lookup_sources_checked: "measured_tool_names";
    cost_estimate_usd: "unavailable";
  };
  per_promise: Array<{
    promise_id: string;
    label: string;
    expected_status: string;
    actual_status: string | null;
    status_ok: boolean;
    overpromise: boolean;
    forbidden_status_ok: boolean;
    approval_required_ok: boolean;
    evidence_ok: boolean;
    required_tools_ok: boolean;
  }>;
}

export const ACME_BOOKING_ID = "BKG-2026-0718-ACME";

export function loadGoldens(): GoldenFile {
  const fullPath = path.join(process.cwd(), "evals", "goldens.json");
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as GoldenFile;
}

export function listGoldenBookingIds(): string[] {
  return Object.keys(loadGoldens()).filter((key) => !key.startsWith("_"));
}

export function loadBookingEvalCase(booking_id: string): BookingEvalCase {
  const raw = loadGoldens()[booking_id];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`golden_booking_not_found:${booking_id}`);
  }

  const booking = raw as GoldenBooking;
  return {
    case: assertCaseMetadata(booking_id, booking._case),
    expectations: Object.fromEntries(
      Object.entries(booking)
        .filter(([promiseId]) => !promiseId.startsWith("_"))
        .map(([promiseId, value]) => [promiseId, assertPromiseExpectation(booking_id, promiseId, value)])
    ),
  };
}

export function loadBookingExpectations(booking_id: string): Record<string, PromiseExpectation> {
  return loadBookingEvalCase(booking_id).expectations;
}

function assertCaseMetadata(booking_id: string, value: unknown): EvalCaseMetadata {
  const item = value as Partial<EvalCaseMetadata>;
  if (
    !item ||
    typeof item !== "object" ||
    typeof item.source_type !== "string" ||
    typeof item.complaint_text !== "string" ||
    !Array.isArray(item.must_match_promises) ||
    !Array.isArray(item.expected_failures) ||
    !Array.isArray(item.required_global_tools)
  ) {
    throw new Error(`invalid_golden_case:${booking_id}`);
  }

  return {
    source_type: item.source_type,
    complaint_text: item.complaint_text,
    must_match_promises: item.must_match_promises.map(String),
    expected_failures: item.expected_failures.map((failure, index) =>
      assertExpectedFailure(booking_id, index, failure)
    ),
    required_global_tools: item.required_global_tools.map(String),
  };
}

function assertExpectedFailure(booking_id: string, index: number, value: unknown): ExpectedFailure {
  const item = value as Partial<ExpectedFailure>;
  if (
    !item ||
    typeof item !== "object" ||
    typeof item.promise_id !== "string" ||
    typeof item.failure_type !== "string"
  ) {
    throw new Error(`invalid_golden_expected_failure:${booking_id}:${index}`);
  }

  return {
    promise_id: item.promise_id,
    failure_type: item.failure_type,
    expected_due_at: typeof item.expected_due_at === "string" ? item.expected_due_at : undefined,
    observed_due_at: typeof item.observed_due_at === "string" ? item.observed_due_at : undefined,
    root_cause_must_mention: Array.isArray(item.root_cause_must_mention)
      ? item.root_cause_must_mention.map(String)
      : [],
  };
}

function assertPromiseExpectation(booking_id: string, promiseId: string, value: unknown): PromiseExpectation {
  const item = value as Partial<PromiseExpectation> & { forbid_verifiable?: boolean };
  if (
    !item ||
    typeof item !== "object" ||
    typeof item.label !== "string" ||
    typeof item.expected_status !== "string" ||
    !Array.isArray(item.required_tools) ||
    typeof item.approval_required !== "boolean" ||
    !Array.isArray(item.evidence_must_mention)
  ) {
    throw new Error(`invalid_golden_expectation:${booking_id}:${promiseId}`);
  }

  const forbidStatuses = Array.isArray(item.forbid_statuses)
    ? item.forbid_statuses.map(String)
    : item.forbid_verifiable
      ? ["verifiable"]
      : [];

  return {
    label: item.label,
    expected_status: item.expected_status,
    required_tools: item.required_tools.map(String),
    approval_required: item.approval_required,
    forbid_statuses: forbidStatuses,
    evidence_must_mention: item.evidence_must_mention.map(String),
  };
}

export function computeBookingMetrics(input: {
  audit: AuditResult;
  complaintTrace: TraceResult;
  evalCase: EvalCaseMetadata;
  expectations: Record<string, PromiseExpectation>;
  phoenixTrace?: AuditTraceSummary | null;
  latency_ms: number;
}): DemoMetricsResult {
  const decisionById = new Map(input.audit.decisions.map((decision) => [decision.promise_id, decision]));
  const globalToolNames = new Set(input.audit.tool_calls.map((call) => call.tool_name));
  const extractedItemIds = new Set(input.audit.info_analysis.extra_items.map((item) => item.item_id));
  const expectedPromiseIds = Object.keys(input.expectations);
  const extractionRecall = {
    passed: expectedPromiseIds.filter((promiseId) => extractedItemIds.has(promiseId)).length,
    total: expectedPromiseIds.length,
  };
  const proposedDecisions = input.audit.decisions.filter((decision) => decision.agent_proposed_status);
  const policyOverrideRate = {
    passed: proposedDecisions.filter((decision) => decision.policy_overruled).length,
    total: proposedDecisions.length,
  };

  let statusPassed = 0;
  let unsafeOverpromiseCount = 0;
  let missingInfoPassed = 0;
  let missingInfoTotal = 0;
  let approvalPassed = 0;
  let humanControlPassed = 0;
  let humanControlTotal = 0;
  let evidencePassed = 0;
  let toolCoveragePassed = 0;

  const perPromise = Object.entries(input.expectations).map(([promiseId, expected]) => {
    const decision = decisionById.get(promiseId);
    const actualStatus = decision?.status ?? null;
    const decisionToolNames = new Set((decision?.tool_calls ?? []).map((call) => call.tool_name));
    const statusOk = actualStatus === expected.expected_status;
    const forbiddenStatusHit = actualStatus !== null && expected.forbid_statuses.includes(actualStatus);
    const overpromise = expected.forbid_statuses.includes("verifiable") && actualStatus === "verifiable";
    const approvalRequiredOk = decision?.approval_required === expected.approval_required;
    const evidenceText = [decision?.source_quote ?? "", ...(decision?.evidence ?? [])].join("\n");
    const evidenceOk =
      Boolean(decision?.source_quote) &&
      (decision?.evidence.length ?? 0) > 0 &&
      decisionToolNames.size > 0 &&
      expected.evidence_must_mention.every((term) => evidenceText.includes(term));
    const requiredToolsOk = expected.required_tools.every((tool) => decisionToolNames.has(tool));

    if (statusOk) statusPassed++;
    if (approvalRequiredOk) approvalPassed++;
    if (overpromise) unsafeOverpromiseCount++;
    if (evidenceOk) evidencePassed++;
    if (requiredToolsOk) toolCoveragePassed++;
    if (expected.expected_status === "missing_info") {
      missingInfoTotal++;
      if (actualStatus === "missing_info") missingInfoPassed++;
    }
    if (expected.approval_required || expected.expected_status === "at_risk" || expected.expected_status === "needs_approval") {
      humanControlTotal++;
      if (
        decision?.approval_required ||
        actualStatus === "cannot_confirm" ||
        actualStatus === "at_risk" ||
        actualStatus === "needs_approval" ||
        actualStatus === "conflict"
      ) {
        humanControlPassed++;
      }
    }

    return {
      promise_id: promiseId,
      label: expected.label,
      expected_status: expected.expected_status,
      actual_status: actualStatus,
      status_ok: statusOk,
      overpromise,
      forbidden_status_ok: !forbiddenStatusHit,
      approval_required_ok: approvalRequiredOk,
      evidence_ok: evidenceOk,
      required_tools_ok: requiredToolsOk,
    };
  });

  const matchedPromiseIds = input.complaintTrace.matched_promises.map((promise) => promise.promise_id);
  const matchedByPromiseId = new Map(
    input.complaintTrace.matched_promises.map((promise) => [promise.promise_id, promise])
  );
  const missingPromiseIds = input.evalCase.must_match_promises.filter((promiseId) => !matchedByPromiseId.has(promiseId));
  const expectedFailures = input.evalCase.expected_failures.map((expected) => {
    const actual = matchedByPromiseId.get(expected.promise_id);
    const rootCause = actual?.root_cause ?? "";
    const passed = Boolean(
      actual &&
        actual.failure_type === expected.failure_type &&
        (!expected.expected_due_at || rootCause.includes(expected.expected_due_at)) &&
        (!expected.observed_due_at || rootCause.includes(expected.observed_due_at)) &&
        expected.root_cause_must_mention.every((term) => rootCause.includes(term))
    );

    return {
      promise_id: expected.promise_id,
      failure_type: expected.failure_type,
      passed,
    };
  });

  const expectedMatchCoverage = {
    passed: input.evalCase.must_match_promises.length - missingPromiseIds.length,
    total: input.evalCase.must_match_promises.length,
  };
  const expectedFailureCoverage = {
    passed: expectedFailures.filter((failure) => failure.passed).length,
    total: expectedFailures.length,
  };
  const globalToolCoverage = {
    passed: input.evalCase.required_global_tools.filter((tool) => globalToolNames.has(tool)).length,
    total: input.evalCase.required_global_tools.length,
  };

  const total = expectedPromiseIds.length;
  const overallPassed =
    extractionRecall.passed === extractionRecall.total &&
    statusPassed === total &&
    approvalPassed === total &&
    unsafeOverpromiseCount === 0 &&
    missingInfoPassed === missingInfoTotal &&
    humanControlPassed === humanControlTotal &&
    evidencePassed === total &&
    toolCoveragePassed === total &&
    globalToolCoverage.passed === globalToolCoverage.total &&
    expectedMatchCoverage.passed === expectedMatchCoverage.total &&
    expectedFailureCoverage.passed === expectedFailureCoverage.total;

  return {
    booking_id: input.audit.booking_id,
    evaluated_at: DEMO_NOW,
    reasoning_source: input.audit.reasoning_source,
    golden_source: "evals/goldens.json",
    case_source_type: input.evalCase.source_type,
    overall_passed: overallPassed,
    extraction_recall: extractionRecall,
    classification_accuracy: { passed: statusPassed, total },
    approval_compliance: { passed: approvalPassed, total },
    policy_override_rate: policyOverrideRate,
    unsafe_overpromise_count: unsafeOverpromiseCount,
    missing_info_recall: { passed: missingInfoPassed, total: missingInfoTotal },
    human_control_coverage: { passed: humanControlPassed, total: humanControlTotal },
    evidence_coverage: { passed: evidencePassed, total },
    tool_call_coverage: { passed: toolCoveragePassed, total },
    global_tool_coverage: globalToolCoverage,
    complaint_trace: {
      expected_match_coverage: expectedMatchCoverage,
      expected_failure_coverage: expectedFailureCoverage,
      matched_promise_ids: matchedPromiseIds,
      missing_promise_ids: missingPromiseIds,
    },
    expected_failures: expectedFailures,
    arize_trace_present: Boolean(input.phoenixTrace),
    phoenix_trace_id: input.phoenixTrace?.trace_id ?? null,
    phoenix_trace_url: input.phoenixTrace?.phoenix_url ?? null,
    latency_ms: input.latency_ms,
    manual_lookup_sources_checked: globalToolNames.size,
    cost_estimate_usd: null,
    business_impact_basis: {
      latency: "measured_app_request",
      manual_lookup_sources_checked: "measured_tool_names",
      cost_estimate_usd: "unavailable",
    },
    per_promise: perPromise,
  };
}

export function computeAcmeMetrics(input: {
  audit: AuditResult;
  complaintTrace: TraceResult;
  phoenixTrace?: AuditTraceSummary | null;
  latency_ms: number;
}): DemoMetricsResult {
  const evalCase = loadBookingEvalCase(ACME_BOOKING_ID);
  return computeBookingMetrics({
    ...input,
    evalCase: evalCase.case,
    expectations: evalCase.expectations,
  });
}

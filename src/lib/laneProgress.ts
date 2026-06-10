import { PromiseDecision, RecoveryTrace, TaskPlan, ToolCall } from "./types";

export type CellStatus = "complete" | "active" | "alert" | "override" | "pending";

export const STAGE_COUNT = 6;

export function laneHasStaleTool(d: PromiseDecision): boolean {
  return (d.tool_calls ?? []).some((c: ToolCall) => {
    if (c.tool_name !== "check_data_freshness") return false;
    const out = (c.output ?? {}) as { freshness_status?: string };
    return out.freshness_status === "stale";
  });
}

/** Real per-stage status for one promise lane (intake → recovery). */
export function laneCellStatuses(
  d: PromiseDecision,
  plan: TaskPlan | undefined,
  matched: boolean,
  approved?: Set<string>
): CellStatus[] {
  const stale = laneHasStaleTool(d);
  const blocked = d.status === "cannot_confirm" || d.status === "conflict";
  const needsApproval = d.approval_required && !(approved?.has(d.promise_id) ?? false);
  return [
    "complete", // intake
    "complete", // extract
    stale ? "alert" : "complete", // verify
    d.policy_overruled ? "override" : blocked ? "alert" : "complete", // safety gate
    matched ? "alert" : needsApproval ? "active" : plan && plan.action_type !== "none" ? "complete" : "pending", // handoff
    matched ? "alert" : "pending", // recovery
  ];
}

export function summarize(statuses: CellStatus[]) {
  const done = statuses.filter((s) => s === "complete" || s === "override").length;
  const alerts = statuses.filter((s) => s === "alert").length;
  const active = statuses.filter((s) => s === "active").length;
  return { done, alerts, active, pct: Math.round((done / STAGE_COUNT) * 100) };
}

export function matchedFor(trace: RecoveryTrace | null, promiseId: string) {
  return trace?.matched_promises.find((m) => m.promise_id === promiseId) ?? null;
}

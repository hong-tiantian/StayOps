import { NextResponse } from "next/server";
import { getOpsTasks, loadApprovalRecords, loadPromiseLedger } from "@/lib/data";
import { getDb } from "@/lib/store/db";
import { recordFeedback } from "@/lib/learning/feedbackStore";

export const dynamic = "force-dynamic";

function addApproval(promise_id: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO runtime_approvals (promise_id, at) VALUES (?, ?)")
    .run(promise_id, new Date().toISOString());
}

function listRuntimeApprovals(): string[] {
  return (getDb().prepare("SELECT promise_id FROM runtime_approvals").all() as Array<{ promise_id: string }>).map(
    (r) => r.promise_id
  );
}

function listHistoricalApprovals(): string[] {
  return loadApprovalRecords()
    .filter((record) => record.decision === "approved")
    .map((record) => record.promise_id);
}

function approvalState() {
  const runtime_approved = listRuntimeApprovals();
  const historical_trace_approved = listHistoricalApprovals();
  return {
    // Backward-compatible display set for the current UI.
    approved: Array.from(new Set([...historical_trace_approved, ...runtime_approved])),
    historical_trace_approved,
    runtime_approved,
  };
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ promise_id: string }> }
) {
  const { promise_id } = await params;
  addApproval(promise_id);

  // Feed the self-improvement loop: record the manager's approval.
  const row = loadPromiseLedger().find((p) => p.promise_id === promise_id);
  recordFeedback({
    promise_id,
    promise_text: row?.promise_text,
    prior_status: row?.status,
    decision: "approved",
  });

  // Display (do not recreate or complete) the existing source task.
  // TASK-103 for P-002 is intentionally left open to drive the complaint demo.
  const linkedTask = getOpsTasks().find((t) => t.source_promise_id === promise_id) ?? null;

  return NextResponse.json({
    promise_id,
    status: "approved",
    approval_scope: "runtime_manager_decision",
    linked_task: linkedTask,
    approval_state: approvalState(),
    note:
      promise_id === "P-002"
        ? "Front desk room-blocking task TASK-103 displayed and kept OPEN (room not yet locked)."
        : "Approval recorded.",
  });
}

export async function GET() {
  return NextResponse.json(approvalState());
}

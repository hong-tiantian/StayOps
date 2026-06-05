import { NextResponse } from "next/server";
import { getOpsTasks, loadApprovalRecords, loadPromiseLedger } from "@/lib/data";
import { recordFeedback } from "@/lib/learning/feedbackStore";

export const dynamic = "force-dynamic";

// In-memory overlay of runtime approvals (seeded from approval_records.csv).
const g = globalThis as unknown as { __stayops_approvals__?: Set<string> };
function approvedSet(): Set<string> {
  if (!g.__stayops_approvals__) {
    g.__stayops_approvals__ = new Set(loadApprovalRecords().map((a) => a.promise_id));
  }
  return g.__stayops_approvals__;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ promise_id: string }> }
) {
  const { promise_id } = await params;
  approvedSet().add(promise_id);

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
    linked_task: linkedTask,
    note:
      promise_id === "P-002"
        ? "Front desk room-blocking task TASK-103 displayed and kept OPEN (room not yet locked)."
        : "Approval recorded.",
  });
}

export async function GET() {
  return NextResponse.json({ approved: Array.from(approvedSet()) });
}

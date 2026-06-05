import { NextResponse } from "next/server";
import { getOpsTasks, loadPromiseLedger } from "@/lib/data";
import { getDb } from "@/lib/store/db";
import { recordFeedback } from "@/lib/learning/feedbackStore";

export const dynamic = "force-dynamic";

function addApproval(promise_id: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO approvals (promise_id, at) VALUES (?, ?)")
    .run(promise_id, new Date().toISOString());
}

function listApprovals(): string[] {
  return (getDb().prepare("SELECT promise_id FROM approvals").all() as Array<{ promise_id: string }>).map(
    (r) => r.promise_id
  );
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
    linked_task: linkedTask,
    note:
      promise_id === "P-002"
        ? "Front desk room-blocking task TASK-103 displayed and kept OPEN (room not yet locked)."
        : "Approval recorded.",
  });
}

export async function GET() {
  return NextResponse.json({ approved: listApprovals() });
}

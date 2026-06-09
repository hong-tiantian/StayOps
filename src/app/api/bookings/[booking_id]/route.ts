import { NextResponse } from "next/server";
import { loadReservations, loadApprovalRecords } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ booking_id: string }> }
) {
  const { booking_id } = await params;
  const reservation = loadReservations().find((r) => r.booking_id === booking_id);
  if (!reservation) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  const approvals = loadApprovalRecords().filter((a) => a.booking_id === booking_id);
  return NextResponse.json({
    reservation,
    // Backward-compatible field for existing consumers.
    approvals,
    approval_context: {
      historical_trace_approvals: approvals,
      runtime_manager_approvals: [],
      note:
        "CSV approval_records are historical trace evidence for the complaint demo. Runtime manager approvals are recorded through /api/promises/:promise_id/approve.",
    },
  });
}

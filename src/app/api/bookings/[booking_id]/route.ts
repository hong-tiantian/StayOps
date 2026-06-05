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
  return NextResponse.json({ reservation, approvals });
}

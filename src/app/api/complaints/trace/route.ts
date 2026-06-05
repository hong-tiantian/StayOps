import { NextResponse } from "next/server";
import { traceComplaint } from "@/lib/recovery";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { booking_id?: string; complaint_text?: string };
  const booking_id = body.booking_id ?? "BKG-2026-0718-ACME";
  const complaint_text =
    body.complaint_text ??
    "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.";
  const trace = traceComplaint(booking_id, complaint_text);
  return NextResponse.json(trace);
}

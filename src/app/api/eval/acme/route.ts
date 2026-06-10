import { NextResponse } from "next/server";
import { rejectEvalRequest } from "@/lib/evaluation/access";
import { runBookingEval } from "@/lib/evaluation/runEval";
import { ACME_BOOKING_ID } from "@/lib/evaluation/metrics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rejected = rejectEvalRequest(req);
  if (rejected) return rejected;
  return NextResponse.json(await runBookingEval(ACME_BOOKING_ID));
}

export async function POST(req: Request) {
  const rejected = rejectEvalRequest(req);
  if (rejected) return rejected;
  return NextResponse.json(await runBookingEval(ACME_BOOKING_ID));
}

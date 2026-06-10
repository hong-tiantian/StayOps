import { NextResponse } from "next/server";
import { rejectEvalRequest } from "@/lib/evaluation/access";
import { runBookingEval } from "@/lib/evaluation/runEval";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ booking_id: string }> }) {
  const rejected = rejectEvalRequest(_req);
  if (rejected) return rejected;
  const { booking_id } = await params;
  return handleEval(booking_id);
}

export async function POST(req: Request, { params }: { params: Promise<{ booking_id: string }> }) {
  const rejected = rejectEvalRequest(req);
  if (rejected) return rejected;
  const { booking_id } = await params;
  return handleEval(booking_id);
}

async function handleEval(booking_id: string) {
  try {
    return NextResponse.json(await runBookingEval(booking_id));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("golden_booking_not_found:")) {
      return NextResponse.json({ error: "golden_booking_not_found", booking_id }, { status: 404 });
    }
    if (err instanceof Error && err.message.startsWith("invalid_golden_expectation:")) {
      return NextResponse.json({ error: "invalid_golden_expectation", detail: err.message }, { status: 422 });
    }
    if (err instanceof Error && err.message.startsWith("invalid_golden_case:")) {
      return NextResponse.json({ error: "invalid_golden_case", detail: err.message }, { status: 422 });
    }
    if (err instanceof Error && err.message.startsWith("invalid_golden_expected_failure:")) {
      return NextResponse.json({ error: "invalid_golden_expected_failure", detail: err.message }, { status: 422 });
    }
    throw err;
  }
}

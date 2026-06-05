import { NextResponse } from "next/server";
import { runPromiseAudit } from "@/lib/classifier";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ booking_id: string }> }
) {
  const { booking_id } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await runPromiseAudit(booking_id, { force });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { runPromiseAudit } from "@/lib/classifier";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ booking_id: string }> }
) {
  const { booking_id } = await params;
  const result = runPromiseAudit(booking_id);
  return NextResponse.json(result);
}

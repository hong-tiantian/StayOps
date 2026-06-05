import { NextResponse } from "next/server";
import { loadMessages } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ booking_id: string }> }
) {
  const { booking_id } = await params;
  const messages = loadMessages().filter((m) => m.booking_id === booking_id);
  return NextResponse.json({ messages });
}

import { NextResponse } from "next/server";
import { searchGmailThreads } from "@/lib/intake/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  return NextResponse.json(await searchGmailThreads(query));
}

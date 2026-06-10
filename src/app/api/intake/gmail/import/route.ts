import { NextResponse } from "next/server";
import { loadGmailThread } from "@/lib/intake/gmail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { thread_id?: string };
  if (!body.thread_id) {
    return NextResponse.json({ ok: false, source: "gmail", error: "thread_id_required" }, { status: 400 });
  }
  return NextResponse.json(await loadGmailThread(body.thread_id));
}

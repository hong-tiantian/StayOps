import { NextRequest, NextResponse } from "next/server";
import { draftGuestReply } from "@/lib/reply/draftReply";
import type { PromiseDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/reply/draft
 * Body: { decisions, guest_text, guest_name?, subject? }
 * Stateless on purpose: the intake panel already holds the audit result, so it
 * posts the decisions back instead of re-running the audit.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      decisions?: PromiseDecision[];
      guest_text?: string;
      guest_name?: string;
      subject?: string;
    };
    if (!Array.isArray(body.decisions) || body.decisions.length === 0 || !body.guest_text?.trim()) {
      return NextResponse.json({ ok: false, error: "decisions and guest_text required" }, { status: 400 });
    }
    const draft = await draftGuestReply({
      decisions: body.decisions,
      guest_text: body.guest_text,
      guest_name: body.guest_name,
      subject: body.subject,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    console.warn("[StayOps] reply draft failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

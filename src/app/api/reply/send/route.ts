import { NextRequest, NextResponse } from "next/server";
import { sendGuestReply } from "@/lib/reply/gmailSend";
import { lintReplyDraft } from "@/lib/reply/draftReply";
import type { PromiseDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/reply/send — human-approved send.
 * Body: { to, subject, body, thread_id?, decisions? }
 *
 * Server-side guardrail: even though the UI ran the lint, the send endpoint
 * re-lints against the decisions. A manager can override edited-in guarantees
 * only by explicitly passing allow_flagged: true.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as {
      to?: string;
      subject?: string;
      body?: string;
      thread_id?: string;
      decisions?: PromiseDecision[];
      allow_flagged?: boolean;
    };
    const to = payload.to?.trim();
    const subject = payload.subject?.trim();
    const body = payload.body?.trim();
    if (!to || !subject || !body) {
      return NextResponse.json({ ok: false, error: "to, subject and body required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.replace(/^.*<|>$/g, ""))) {
      return NextResponse.json({ ok: false, error: "invalid recipient address" }, { status: 400 });
    }

    if (Array.isArray(payload.decisions) && payload.decisions.length > 0 && !payload.allow_flagged) {
      const flags = lintReplyDraft(body, payload.decisions);
      if (flags.length > 0) {
        return NextResponse.json({ ok: false, error: "overpromise_lint_failed", lint_flags: flags }, { status: 422 });
      }
    }

    const result = await sendGuestReply({ to, subject, body, thread_id: payload.thread_id });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

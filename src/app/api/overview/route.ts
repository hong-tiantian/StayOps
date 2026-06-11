import { NextResponse } from "next/server";
import { loadReservations } from "@/lib/data";
import { runDeterministicAudit } from "@/lib/classifier";
import { PromiseDecision } from "@/lib/types";

export const dynamic = "force-dynamic";

/* Portfolio overview — one fast deterministic audit per booking so the
   dashboard can rank ALL bookings by urgency without paying a Gemini call
   each (the rules path runs in milliseconds). Read-only: never writes to
   any ledger, so the Acme demo flow is untouched. */

const SEVERITY: Record<string, number> = {
  conflict: 4,
  failed: 4,
  cannot_confirm: 3,
  needs_approval: 2,
  at_risk: 2,
  missing_info: 1,
};

function severity(d: PromiseDecision): number {
  const base = SEVERITY[d.status] ?? 0;
  return d.approval_required && base < 2 ? 2 : base;
}

export async function GET() {
  const bookings = loadReservations().map((r) => {
    const audit = runDeterministicAudit(r.booking_id);
    const decisions = audit.decisions;

    const blocked = decisions.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status)).length;
    const risk = decisions.filter((d) => ["at_risk", "needs_approval"].includes(d.status)).length;
    const missing = decisions.filter((d) => d.status === "missing_info").length;
    const safe = decisions.filter((d) => ["verifiable", "completed", "resolved", "approved", "task_created"].includes(d.status)).length;
    const pendingApproval = decisions.filter((d) => d.approval_required).length;

    // Deterministic urgency: what's broken weighs most, then what needs the
    // manager, then what needs the guest. The safety gate's own verdicts
    // drive the ranking — no extra model call.
    const urgency = blocked * 3 + risk * 2 + pendingApproval + missing;

    const topIssue = [...decisions].sort((a, b) => severity(b) - severity(a))[0];

    return {
      booking_id: r.booking_id,
      company_name: r.company_name,
      arrival_date: r.arrival_date,
      counts: { total: decisions.length, safe, risk, missing, blocked },
      decisions,
      pending_approval: pendingApproval,
      urgency,
      // "urgent" pins red only when something is actually un-promisable;
      // risk/missing show as an amber "watch" tier so red keeps meaning.
      urgent: blocked > 0,
      watch: blocked === 0 && (risk > 0 || missing > 0 || pendingApproval > 0),
      top_issue:
        topIssue && severity(topIssue) > 0
          ? { promise_text: topIssue.promise_text, status: topIssue.status }
          : null,
    };
  });

  bookings.sort((a, b) => b.urgency - a.urgency || a.arrival_date.localeCompare(b.arrival_date));

  return NextResponse.json({ bookings });
}

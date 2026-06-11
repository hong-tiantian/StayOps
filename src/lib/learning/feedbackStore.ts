import { getDb } from "../store/db";
import { mirrorFeedback } from "../store/pgMirror";

/**
 * Self-improvement loop — manager feedback capture + learned preferences,
 * persisted in SQLite so learning survives restarts.
 *
 * Every manager decision (approve / reject) on an agent recommendation is
 * recorded. We aggregate those decisions into "learned preferences" that the
 * dashboard surfaces and that the next audit can fast-track.
 */

export interface FeedbackEvent {
  promise_id: string;
  promise_text?: string;
  prior_status?: string;
  decision: "approved" | "rejected";
  at: string;
}

export function recordFeedback(e: Omit<FeedbackEvent, "at">): void {
  const at = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO feedback (promise_id, promise_text, prior_status, decision, at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(e.promise_id, e.promise_text ?? null, e.prior_status ?? null, e.decision, at);
  mirrorFeedback({
    promise_id: e.promise_id,
    promise_text: e.promise_text ?? null,
    prior_status: e.prior_status ?? null,
    decision: e.decision,
    at,
  });
}

export interface LearnedPreference {
  promise_id: string;
  promise_text?: string;
  approvals: number;
  rejections: number;
  hint: string;
}

/** Aggregate recorded decisions into per-promise learned preferences. */
export function learnedPreferences(): LearnedPreference[] {
  const rows = getDb()
    .prepare("SELECT promise_id, promise_text, decision FROM feedback")
    .all() as Array<{ promise_id: string; promise_text: string | null; decision: string }>;

  const byId = new Map<string, LearnedPreference>();
  for (const r of rows) {
    const cur =
      byId.get(r.promise_id) ??
      { promise_id: r.promise_id, promise_text: r.promise_text ?? undefined, approvals: 0, rejections: 0, hint: "" };
    if (r.decision === "approved") cur.approvals++;
    else cur.rejections++;
    cur.promise_text = cur.promise_text ?? r.promise_text ?? undefined;
    byId.set(r.promise_id, cur);
  }
  for (const p of byId.values()) {
    p.hint =
      p.approvals >= 2
        ? `Approved ${p.approvals}× by managers → fast-track candidate next time`
        : p.rejections > p.approvals
          ? "Usually rejected → keep escalating"
          : "Mixed signal → keep manager in the loop";
  }
  return [...byId.values()].sort((a, b) => b.approvals - a.approvals);
}

export function feedbackSummary() {
  const total = (getDb().prepare("SELECT COUNT(*) AS c FROM feedback").get() as { c: number }).c;
  const learned = learnedPreferences();
  return { total_decisions: total, learned_count: learned.length, learned };
}

/** A promise is "fast-track" learned if managers approved it >= 2 times. */
export function isFastTrack(promise_id: string): boolean {
  return learnedPreferences().some((p) => p.promise_id === promise_id && p.approvals >= 2);
}

/**
 * Self-improvement loop — manager feedback capture + learned preferences.
 *
 * Every manager decision (approve / reject) on an agent recommendation is
 * recorded. We aggregate those decisions into "learned preferences" that the
 * dashboard surfaces and that the next audit can fast-track. This is the visible
 * minimum of the agent learning from how the hotel actually overrides it.
 *
 * Stored on globalThis so it survives HMR within a running server (demo-scoped).
 */

export interface FeedbackEvent {
  promise_id: string;
  promise_text?: string;
  prior_status?: string;
  decision: "approved" | "rejected";
  at: string;
}

const g = globalThis as unknown as { __stayops_feedback__?: FeedbackEvent[] };

function store(): FeedbackEvent[] {
  if (!g.__stayops_feedback__) g.__stayops_feedback__ = [];
  return g.__stayops_feedback__;
}

export function recordFeedback(e: Omit<FeedbackEvent, "at">): void {
  store().push({ ...e, at: new Date().toISOString() });
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
  const byId = new Map<string, LearnedPreference>();
  for (const e of store()) {
    const cur =
      byId.get(e.promise_id) ??
      { promise_id: e.promise_id, promise_text: e.promise_text, approvals: 0, rejections: 0, hint: "" };
    if (e.decision === "approved") cur.approvals++;
    else cur.rejections++;
    cur.promise_text = cur.promise_text ?? e.promise_text;
    byId.set(e.promise_id, cur);
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
  const learned = learnedPreferences();
  return {
    total_decisions: store().length,
    learned_count: learned.length,
    learned,
  };
}

/** A promise is "fast-track" learned if managers approved it >= 2 times. */
export function isFastTrack(promise_id: string): boolean {
  return learnedPreferences().some((p) => p.promise_id === promise_id && p.approvals >= 2);
}

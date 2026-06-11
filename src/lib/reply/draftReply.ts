import { GEMINI_MODEL, generateWithRetry } from "../gemini";
import { Type } from "@google/genai";
import { getActiveHotel } from "../hotel/hotelStore";
import type { PromiseDecision } from "../types";

/**
 * Guest reply drafting — the closed loop.
 *
 * The agent does not just classify silently: for every audit it drafts the
 * outgoing guest email, mapped from the adjudicated statuses (never from raw
 * model enthusiasm). A deterministic overpromise linter then scans the draft;
 * if it guarantees anything the audit did not verify, the draft is regenerated
 * once with the violations called out, and any residual flags are surfaced to
 * the manager. A human clicks Send — the agent never emails a guest alone.
 */

export interface ReplyDraft {
  subject: string;
  body: string;
  per_promise_stance: Array<{ promise_id: string; stance: string }>;
  lint_flags: string[];
  regenerated: boolean;
  hotel_name: string;
}

const STANCE_RULES: Record<string, string> = {
  verifiable: "Confirm it plainly — evidence supports it.",
  completed: "Confirm it is done.",
  resolved: "Confirm it is resolved.",
  approved: "Confirm it — the manager approved.",
  task_created: "Say it is scheduled and who owns it.",
  at_risk: "Say it is NOTED and prioritised, give the honest constraint and a concrete fallback. No guarantee.",
  needs_approval: "Say it is with the manager and when the guest will hear back (within 24h). No guarantee.",
  missing_info: "Ask precisely for the missing details — list them.",
  cannot_confirm: "Decline politely with the policy reason; offer the nearest alternative the hotel CAN do.",
  conflict: "Acknowledge the conflict transparently and state what is being done to resolve it.",
  failed: "Apologise, own it, state the recovery step.",
};

const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    per_promise_stance: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          promise_id: { type: Type.STRING },
          stance: { type: Type.STRING },
        },
        required: ["promise_id", "stance"],
      },
    },
  },
  required: ["subject", "body"],
};

/** Phrases that constitute a written guarantee. */
const GUARANTEE_PATTERNS = [
  /\bguarantee[ds]?\b/i,
  /\bI (?:can |hereby )?confirm\b.*\b(?:will|is) (?:be )?(?:ready|guaranteed|included)\b/i,
  /\bdefinitely\b/i,
  /\bwe promise\b/i,
  /\brest assured\b.*\bwill\b/i,
  /\b(?:will|shall) (?:absolutely|certainly)\b/i,
];

const NEGATED_GUARANTEE_PATTERNS = [
  /\b(?:cannot|can't|can not|unable to|not able to)\s+guarantee\b/i,
  /\b(?:no|without)\s+guarantee\b/i,
  /\bnot\s+guaranteed\b/i,
];

const RISKY_STATUSES = new Set(["at_risk", "needs_approval", "missing_info", "cannot_confirm", "conflict", "failed"]);

/** Tokens worth checking proximity for, per decision. */
function topicTokens(d: PromiseDecision): string[] {
  return d.promise_text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 4)
    .slice(0, 6);
}

/**
 * Deterministic overpromise lint: flag any guarantee-sounding sentence that
 * shares topic words with a promise the audit did NOT verify.
 */
export function lintReplyDraft(body: string, decisions: PromiseDecision[]): string[] {
  const flags: string[] = [];
  const sentences = body.split(/(?<=[.!?])\s+/);
  const risky = decisions.filter((d) => RISKY_STATUSES.has(d.status));

  for (const sentence of sentences) {
    if (!GUARANTEE_PATTERNS.some((p) => p.test(sentence))) continue;
    if (NEGATED_GUARANTEE_PATTERNS.some((p) => p.test(sentence))) continue;
    for (const d of risky) {
      const tokens = topicTokens(d);
      if (tokens.some((t) => sentence.toLowerCase().includes(t))) {
        flags.push(
          `Sentence "${sentence.trim().slice(0, 90)}…" sounds like a guarantee, but "${d.promise_text.slice(0, 60)}" is ${d.status}.`
        );
        break;
      }
    }
  }
  return flags;
}

function decisionBlock(decisions: PromiseDecision[]): string {
  return decisions
    .map((d) => {
      const rule = STANCE_RULES[d.status] ?? "Be honest and make no commitment.";
      return `- [${d.promise_id}] "${d.promise_text}" → status ${d.status}${d.approval_required ? " (manager approval required)" : ""}. Stance: ${rule}`;
    })
    .join("\n");
}

export async function draftGuestReply(input: {
  decisions: PromiseDecision[];
  guest_text: string;
  guest_name?: string;
  subject?: string;
}): Promise<ReplyDraft> {
  const hotel = getActiveHotel();
  const persona = hotel.persona;

  const systemPrompt =
    `You write outgoing guest emails for ${hotel.name}. Voice: ${persona.voice}. ` +
    `Sign as "${persona.signature}". You are bound by the audited statuses below — they are the ` +
    `ONLY source of what may be confirmed. Statuses like at_risk/needs_approval/missing_info/` +
    `cannot_confirm must NEVER be written as guarantees. Keep it warm, specific and short ` +
    `(under 180 words). Address every promise item. Ask for missing details in one clear list. ` +
    `Operational facts you may cite: front desk ${persona.front_desk_hours}; check-in ${persona.check_in_window}; ` +
    `late arrivals: ${persona.late_arrival_policy}; parking: ${persona.parking_summary}; pets: ${persona.pet_policy_summary}.`;

  const userPrompt =
    `GUEST EMAIL (reply to this):\n${input.guest_text.slice(0, 3000)}\n\n` +
    `AUDITED PROMISE ITEMS:\n${decisionBlock(input.decisions)}\n\n` +
    `Write the reply email now. Subject line should reference the stay${input.subject ? ` (original subject: ${input.subject})` : ""}.`;

  const generate = async (extra?: string) => {
    const res = await generateWithRetry({
      model: GEMINI_MODEL,
      contents: `${userPrompt}${extra ? `\n\nREVISION REQUIRED — your previous draft violated these audit constraints:\n${extra}\nRewrite without those guarantees.` : ""}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: DRAFT_SCHEMA,
        temperature: 0.4,
      },
    });
    return JSON.parse((res.text ?? "{}").trim()) as {
      subject?: string;
      body?: string;
      per_promise_stance?: Array<{ promise_id: string; stance: string }>;
    };
  };

  let draft = await generate();
  let flags = lintReplyDraft(draft.body ?? "", input.decisions);
  let regenerated = false;

  if (flags.length > 0) {
    regenerated = true;
    draft = await generate(flags.map((f) => `- ${f}`).join("\n"));
    flags = lintReplyDraft(draft.body ?? "", input.decisions);
  }

  return {
    subject: draft.subject ?? "About your upcoming stay",
    body: draft.body ?? "",
    per_promise_stance: draft.per_promise_stance ?? [],
    lint_flags: flags,
    regenerated,
    hotel_name: hotel.name,
  };
}

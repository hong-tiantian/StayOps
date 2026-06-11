import { getActiveHotel, type Hotel } from "./hotelStore";
import { retrieveHotelSop, formatSopContext, type SopHit } from "./sopRetrieval";
import { retrieveSimilarCases, formatCaseContext, type CaseHit } from "../learning/caseMemory";
import { keywordScore, keywordTokens } from "./embeddings";
import type { Message } from "../types";

/**
 * Audit context — everything the agent should know that is NOT in the guest
 * email: which hotel it is operating, the hotel's retrieved SOP passages, and
 * similar past cases from case memory. This is TRUSTED context (system-side),
 * unlike the guest thread which stays untrusted.
 */

export interface AuditContext {
  hotel: Hotel;
  sop_hits: SopHit[];
  case_hits: CaseHit[];
  /** Single trusted prompt block, ready to prepend to the agent run. */
  prompt_block: string;
  retrieval_method: "embedding" | "keyword" | "none";
}

function personaBlock(hotel: Hotel): string {
  const p = hotel.persona;
  return [
    `You are operating ${hotel.name} (${hotel.brand_style}).`,
    `Front desk hours: ${p.front_desk_hours}.`,
    `Check-in: ${p.check_in_window}.`,
    `Late arrivals: ${p.late_arrival_policy}.`,
    `Pets: ${p.pet_policy_summary}.`,
    `Parking: ${p.parking_summary}.`,
    `Upgrades: ${p.upgrade_authority}.`,
  ].join("\n");
}

/** Build the retrieval query from the guest thread (bounded length). */
function retrievalQuery(messages: Message[]): string {
  return messages
    .filter((m) => m.message_type !== "complaint")
    .map((m) => m.body)
    .join("\n")
    .slice(0, 2000);
}

export async function buildAuditContext(messages: Message[]): Promise<AuditContext> {
  const hotel = getActiveHotel();
  const query = retrievalQuery(messages);

  const [sopHits, caseHits] = await Promise.all([
    query ? retrieveHotelSop(hotel.hotel_id, query, 5) : Promise.resolve([]),
    query ? retrieveSimilarCases(query, 3) : Promise.resolve([]),
  ]);

  const parts = [
    `=== HOTEL PERSONA (trusted operational context) ===\n${personaBlock(hotel)}`,
    `=== RETRIEVED SOP ===\n${formatSopContext(hotel.name, sopHits)}`,
  ];
  const caseBlock = formatCaseContext(caseHits);
  if (caseBlock) parts.push(`=== CASE MEMORY ===\n${caseBlock}`);

  const method = sopHits[0]?.method ?? caseHits[0]?.method ?? "none";

  return {
    hotel,
    sop_hits: sopHits,
    case_hits: caseHits,
    prompt_block: parts.join("\n\n"),
    retrieval_method: method,
  };
}

/**
 * Deterministic grounding for a novel (outside-the-rule-library) item: match
 * it against the SOP passages already retrieved for this audit. A covering
 * policy upgrades the verdict from a blind cannot_confirm to needs_approval
 * with the policy cited — still never verifiable without a human.
 */
export function groundNovelItem(
  itemText: string,
  context: AuditContext | undefined
): { status: "needs_approval" | "cannot_confirm"; evidence: string[] } {
  if (!context || context.sop_hits.length === 0) {
    return {
      status: "cannot_confirm",
      evidence: ["No SOP passage covers this request — escalate to the manager before any commitment."],
    };
  }
  const tokens = keywordTokens(itemText);
  const itemLower = itemText.toLowerCase();
  const isPetLike = /\b(cat|cats|dog|dogs|pet|pets|animal|animals)\b/.test(itemLower);
  const best = context.sop_hits
    .map((hit) => {
      const policyLower = `${hit.doc_title}\n${hit.chunk_text}`.toLowerCase();
      const synonymBoost =
        isPetLike && /\b(cat|cats|dog|dogs|pet|pets|animal|animals)\b/.test(policyLower) ? 0.16 : 0;
      return { hit, overlap: keywordScore(tokens, hit.chunk_text) + synonymBoost };
    })
    .sort((a, b) => b.overlap - a.overlap)[0];

  if (best && best.overlap >= 0.06) {
    const policyText = best.hit.chunk_text.toLowerCase();
    const explicitDenial =
      /\bnot permitted\b/.test(policyText) ||
      /\bno pets\b/.test(policyText) ||
      /\bdo not confirm\b/.test(policyText) ||
      /\bmust not\b/.test(policyText) ||
      /\bnever\b.*\b(?:confirm|guarantee|promise)\b/.test(policyText);

    if (explicitDenial) {
      return {
        status: "cannot_confirm",
        evidence: [
          `SOP denial (${context.hotel.name} / "${best.hit.doc_title}"): ${best.hit.chunk_text.slice(0, 220)}…`,
          "Novel request — retrieved hotel policy explicitly blocks written confirmation.",
        ],
      };
    }

    return {
      status: "needs_approval",
      evidence: [
        `SOP grounding (${context.hotel.name} / "${best.hit.doc_title}"): ${best.hit.chunk_text.slice(0, 220)}…`,
        "Novel request — policy located, but a human must approve before any guest-facing commitment.",
      ],
    };
  }
  return {
    status: "cannot_confirm",
    evidence: [
      `No SOP passage at ${context.hotel.name} covers this request — escalate to the manager before any commitment.`,
    ],
  };
}

import { loadBillingAccounts, loadMessages, loadPromiseLedger } from "./data";
import { alignPromiseRuleKey } from "./agent/policy";
import {
  ExtraItem,
  ExtraItemDomain,
  InfoAnalysis,
  IntakeScope,
  Message,
  Reservation,
  VerificationRoute,
} from "./types";

interface RuleMeta {
  domain: ExtraItemDomain;
  subtype?: string;
  default_text: string;
  required_fields: string[];
  missing_fields: string[];
  verification_route: VerificationRoute;
}

export interface InfoAnalysisProposal {
  promise_text?: string;
  source_quote?: string;
  source_message_id?: string;
  rule_key?: string;
}

const RULE_META: Record<string, RuleMeta> = {
  early_check_in: {
    domain: "arrival_exception",
    subtype: "early_check_in",
    default_text: "Early check-in request",
    required_fields: [],
    missing_fields: [],
    verification_route: "cannot_confirm_yet",
  },
  quiet_room: {
    domain: "room_preference",
    subtype: "quiet_room",
    default_text: "Quiet room preference",
    required_fields: ["manager_approval", "room_block"],
    missing_fields: ["manager_approval", "room_block"],
    verification_route: "needs_human_approval",
  },
  gluten_free_breakfast: {
    domain: "fb_requirement",
    subtype: "gluten_free",
    default_text: "Gluten-free breakfast requirement",
    required_fields: ["attendee_count"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  projector_setup: {
    domain: "event_av",
    subtype: "projector",
    default_text: "Projector setup requirement",
    required_fields: ["meeting_room", "meeting_start"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  airport_transfer: {
    domain: "transport",
    subtype: "airport_transfer",
    default_text: "Airport transfer request",
    required_fields: ["flight_number", "arrival_time", "passenger_count", "phone_number"],
    missing_fields: ["flight_number", "arrival_time", "passenger_count", "phone_number"],
    verification_route: "missing_guest_info",
  },
  company_invoice: {
    domain: "commercial",
    subtype: "company_invoice",
    default_text: "Company invoice request",
    required_fields: ["billing_contact", "tax_id", "billing_address"],
    missing_fields: ["billing_contact", "tax_id", "billing_address"],
    verification_route: "missing_guest_info",
  },
  upgrade: {
    domain: "exception_value",
    subtype: "upgrade",
    default_text: "Room upgrade request",
    required_fields: ["manager_approval"],
    missing_fields: ["manager_approval"],
    verification_route: "needs_human_approval",
  },
  high_floor: {
    domain: "room_preference",
    subtype: "high_floor",
    default_text: "High-floor room preference",
    required_fields: [],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  parking: {
    domain: "transport",
    subtype: "parking",
    default_text: "Parking request",
    required_fields: ["vehicle_plate", "arrival_time"],
    missing_fields: ["vehicle_plate", "arrival_time"],
    verification_route: "missing_guest_info",
  },
  long_stay_discount: {
    domain: "commercial",
    subtype: "payment_terms",
    default_text: "Long-stay discount request",
    required_fields: ["revenue_manager_approval"],
    missing_fields: ["revenue_manager_approval"],
    verification_route: "needs_human_approval",
  },
  lost_and_found: {
    domain: "lost_and_found",
    subtype: "lost_item_search",
    default_text: "Lost-and-found search request",
    required_fields: ["item_description", "last_known_location"],
    missing_fields: [],
    verification_route: "cannot_confirm_yet",
  },
  maintenance: {
    domain: "maintenance_service",
    subtype: "repair_request",
    default_text: "Maintenance repair request",
    required_fields: ["issue_description"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
};

const RULE_QUOTE_TESTS: Record<string, RegExp[]> = {
  early_check_in: [/\bearly check[- ]?in\b/i, /\barriv\w*\b[^.!?;,\n]*\b11\s*(?:am|a\.m\.)\b/i],
  quiet_room: [/\bquiet\b[^.!?;,\n]*\b(?:king|room)\b/i, /\baway from (?:the )?elevators?\b/i, /\bvp\b[^.!?;,\n]*\broom\b/i],
  gluten_free_breakfast: [/\bgluten[- ]?free\b/i, /\bdietary\b[^.!?;,\n]*\bbreakfast\b/i],
  projector_setup: [/\bprojector\b/i, /\b(?:screen|hdmi|a\/v|av)\b/i],
  airport_transfer: [/\bairport transfer\b/i, /\btransfer\b[^.!?;,\n]*\b(?:airport|mad)\b/i, /\bpick\s?up\b[^.!?;,\n]*\bairport\b/i],
  company_invoice: [/\binvoice\b/i, /\bbilling\b/i, /\btax (?:id|details)\b/i],
  upgrade: [/\bupgrade\b/i, /\bsuite\b/i],
  high_floor: [/\bhigh[- ]?floor\b/i, /\bupper floor\b/i, /\btop floor\b/i],
  parking: [/\bparking\b/i, /\bcar park\b/i, /\bgarage\b/i, /\bvehicle\b/i],
  long_stay_discount: [/\blong[- ]?stay\b/i, /\bmonthly rate\b/i, /\bdiscount\b/i],
  lost_and_found: [/\bleft\b[^.!?;,\n]*(?:charger|item|phone)\b/i, /\blost and found\b/i, /\bforgot\b/i],
  maintenance: [/\bair ?conditioning\b/i, /\bnot cooling\b/i, /\brepair\b/i, /\bfix\b/i, /\bmaintenance\b/i, /\bnot working\b/i],
};

function inferScope(reservation: Reservation | null): IntakeScope {
  if (!reservation) return "unknown";
  if (reservation.room_count > 1 && reservation.meeting_room_id) return "corporate_group_event";
  if (reservation.room_count > 1 && reservation.company_name) return "corporate_group";
  if (reservation.room_count > 1) return "group_stay";
  return "individual_stay";
}

function missingBasicFields(reservation: Reservation | null): string[] {
  if (!reservation) return ["reservation"];
  const missing: string[] = [];
  if (!reservation.arrival_date) missing.push("arrival_date");
  if (!reservation.departure_date) missing.push("departure_date");
  if (!reservation.room_count) missing.push("room_count");
  if (!reservation.primary_contact) missing.push("primary_contact");
  if (reservation.room_count > 1 && (!reservation.king_count || !reservation.twin_count)) missing.push("room_mix");
  if (reservation.room_count > 1 && reservation.company_name && !reservation.meeting_room_id) missing.push("meeting_room");
  return missing;
}

function fragmentsFor(message: Message): string[] {
  return message.body
    .split(/(?<=[.!?])\s+|;\s+|,\s+(?:and\s+)?/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function quoteFor(ruleKey: string, messages: Message[]): Pick<ExtraItem, "source_message_id" | "source_quote"> {
  const tests = RULE_QUOTE_TESTS[ruleKey];
  if (!tests) return {};

  for (const message of messages) {
    for (const fragment of fragmentsFor(message)) {
      if (tests.some((test) => test.test(fragment))) {
        return { source_message_id: message.message_id, source_quote: fragment };
      }
    }
  }

  return {};
}

function findQuoteInMessages(quote: string | undefined, messages: Message[]): Pick<ExtraItem, "source_message_id" | "source_quote"> {
  const trimmed = quote?.trim();
  if (!trimmed) return {};

  for (const message of messages) {
    if (message.body.toLowerCase().includes(trimmed.toLowerCase())) {
      return { source_message_id: message.message_id, source_quote: trimmed };
    }
  }

  return {};
}

function refinedMeta(ruleKey: string, bookingId: string): RuleMeta {
  const meta = RULE_META[ruleKey] ?? {
    domain: "other" as const,
    required_fields: [],
    missing_fields: [],
    verification_route: "cannot_confirm_yet" as const,
  };

  if (ruleKey !== "company_invoice") return meta;

  const billing = loadBillingAccounts().find((b) => b.booking_id === bookingId);
  const missing = [
    !billing?.billing_contact ? "billing_contact" : null,
    !billing?.tax_id ? "tax_id" : null,
    !billing?.billing_address ? "billing_address" : null,
  ].filter((v): v is string => Boolean(v));

  return { ...meta, missing_fields: missing, verification_route: missing.length ? "missing_guest_info" : "self_verifiable" };
}

function stableItemId(ruleKey: string, bookingId: string, index: number): string {
  const existing = loadPromiseLedger().find((p) => p.booking_id === bookingId && p.category === ruleKey);
  return existing?.promise_id ?? `ITEM-${String(index + 1).padStart(3, "0")}`;
}

function toExtraItem(
  ruleKey: string,
  bookingId: string,
  index: number,
  messages: Message[],
  proposal?: InfoAnalysisProposal
): ExtraItem {
  const meta = refinedMeta(ruleKey, bookingId);
  const proposalQuote = findQuoteInMessages(proposal?.source_quote, messages);
  const fallbackQuote = quoteFor(ruleKey, messages);
  const quote = proposalQuote.source_quote || fallbackQuote.source_quote || proposal?.source_quote?.trim();
  const sourceMessageId =
    proposalQuote.source_message_id ||
    fallbackQuote.source_message_id ||
    proposal?.source_message_id;

  return {
    item_id: stableItemId(ruleKey, bookingId, index),
    text: proposal?.promise_text?.trim() || quote || meta.default_text,
    source_message_id: sourceMessageId,
    source_quote: quote,
    domain: meta.domain,
    subtype: meta.subtype,
    clarity: meta.missing_fields.length ? "missing_required_fields" : "clear",
    required_fields: meta.required_fields,
    missing_fields: meta.missing_fields,
    verification_route: meta.verification_route,
    rule_key: ruleKey,
  };
}

/**
 * A proposal outside the 12-key rule library is NOT dropped: it becomes a
 * `novel_N` item that carries the agent's own extraction. The policy layer
 * still caps novel items at needs_approval/cannot_confirm, so keeping them
 * never creates an unverified guarantee — it only stops silent data loss.
 */
function toNovelExtraItem(
  ruleKey: string,
  messages: Message[],
  proposal: InfoAnalysisProposal,
  text: string
): ExtraItem {
  const quote = findQuoteInMessages(proposal.source_quote, messages);
  return {
    item_id: ruleKey.toUpperCase().replace("_", "-"),
    text,
    source_message_id: quote.source_message_id ?? proposal.source_message_id,
    source_quote: quote.source_quote ?? proposal.source_quote?.trim(),
    domain: "other",
    subtype: "novel_request",
    clarity: "unclear",
    required_fields: ["manager_review"],
    missing_fields: ["manager_review"],
    verification_route: "needs_human_approval",
    rule_key: ruleKey,
  };
}

function extraItemsFromProposals(
  bookingId: string,
  messages: Message[],
  proposals: InfoAnalysisProposal[]
): ExtraItem[] {
  const seen = new Set<string>();
  const seenNovelTexts = new Set<string>();
  const items: ExtraItem[] = [];
  let novelCount = 0;

  for (const proposal of proposals) {
    const declared = proposal.rule_key ?? "";
    // The agent's explicit "other" means "no library key fits" — respect that
    // instead of regex-forcing a wrong bucket. Regex alignment only backstops
    // proposals that arrived without any rule_key at all.
    const ruleKey =
      (declared && declared !== "other" && RULE_META[declared] ? declared : "") ||
      (declared === "other"
        ? ""
        : alignPromiseRuleKey(`${proposal.promise_text ?? ""}\n${proposal.source_quote ?? ""}`) ?? "");

    if (ruleKey && RULE_META[ruleKey]) {
      if (seen.has(ruleKey)) continue;
      seen.add(ruleKey);
      items.push(toExtraItem(ruleKey, bookingId, items.length, messages, proposal));
      continue;
    }

    const text = (proposal.promise_text ?? proposal.source_quote ?? "").trim();
    if (!text) continue;
    const normalized = text.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if (seenNovelTexts.has(normalized)) continue;
    seenNovelTexts.add(normalized);
    novelCount += 1;
    items.push(toNovelExtraItem(`novel_${novelCount}`, messages, proposal, text));
  }

  return items;
}

function extraItemsFromMessages(bookingId: string, messages: Message[]): ExtraItem[] {
  const items: ExtraItem[] = [];
  for (const ruleKey of Object.keys(RULE_META)) {
    const quote = quoteFor(ruleKey, messages);
    if (!quote.source_quote) continue;
    items.push(toExtraItem(ruleKey, bookingId, items.length, messages, { source_quote: quote.source_quote }));
  }
  return items;
}

function novelItemsFromMessages(existing: ExtraItem[], messages: Message[]): ExtraItem[] {
  const hasPet = existing.some((item) =>
    `${item.text} ${item.source_quote ?? ""}`.toLowerCase().match(/\b(cat|cats|dog|dogs|pet|pets|animal|animals)\b/)
  );
  if (hasPet) return [];

  for (const message of messages) {
    for (const fragment of fragmentsFor(message)) {
      if (/\b(?:bring|have|travel(?:ling)? with|come with)\b/i.test(fragment) &&
          /\b(cat|cats|dog|dogs|pet|pets|animal|animals)\b/i.test(fragment)) {
        return [
          {
            item_id: "NOVEL-PET",
            text: fragment,
            source_message_id: message.message_id,
            source_quote: fragment,
            domain: "other",
            subtype: "pet_policy",
            clarity: "unclear",
            required_fields: ["hotel_pet_policy"],
            missing_fields: ["hotel_pet_policy"],
            verification_route: "needs_human_approval",
            rule_key: "novel_pet",
          },
        ];
      }
    }
  }
  return [];
}

function mergeExtraItems(primary: ExtraItem[], secondary: ExtraItem[]): ExtraItem[] {
  const byKey = new Set(primary.map((item) => item.rule_key).filter(Boolean));
  const byText = new Set(primary.map((item) => item.text.toLowerCase().replace(/\s+/g, " ").slice(0, 80)));
  const merged = [...primary];
  for (const item of secondary) {
    const key = item.rule_key;
    const text = item.text.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
    if ((key && byKey.has(key)) || byText.has(text)) continue;
    byKey.add(key);
    byText.add(text);
    merged.push(item);
  }
  return merged;
}

export function analyzeBookingInfo(
  bookingId: string,
  reservation: Reservation | null,
  messageOverride?: Message[],
  proposals: InfoAnalysisProposal[] = []
): InfoAnalysis {
  const messages = messageOverride ?? loadMessages().filter((m) => m.booking_id === bookingId);
  const missing = missingBasicFields(reservation);
  const basicComplete = missing.length === 0;
  const nonComplaintMessages = messages.filter((m) => m.message_type !== "complaint");
  const proposedItems = extraItemsFromProposals(bookingId, nonComplaintMessages, proposals);
  const messageItems = extraItemsFromMessages(bookingId, nonComplaintMessages);
  const mergedItems = mergeExtraItems(proposedItems, messageItems);
  const extractedItems = mergeExtraItems(mergedItems, novelItemsFromMessages(mergedItems, nonComplaintMessages));

  return {
    booking_id: bookingId,
    source_channel: messages.find((m) => m.message_type === "booking_request")?.channel ?? messages[0]?.channel,
    intake_scope: inferScope(reservation),
    basic_info_status: basicComplete ? "complete" : "missing_info",
    basic_info: {
      company_name: reservation?.company_name,
      arrival_date: reservation?.arrival_date,
      arrival_time: reservation?.arrival_time,
      departure_date: reservation?.departure_date,
      room_count: reservation?.room_count,
      room_mix: reservation ? { king: reservation.king_count, twin: reservation.twin_count } : undefined,
      meeting_room_id: reservation?.meeting_room_id,
      primary_contact: reservation?.primary_contact,
    },
    missing_basic_fields: missing,
    extra_items: extractedItems,
  };
}

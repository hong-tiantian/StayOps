import { loadBillingAccounts, loadMessages, loadPromiseLedger } from "./data";
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
  required_fields: string[];
  missing_fields: string[];
  verification_route: VerificationRoute;
}

const RULE_META: Record<string, RuleMeta> = {
  early_check_in: {
    domain: "arrival_exception",
    subtype: "early_check_in",
    required_fields: [],
    missing_fields: [],
    verification_route: "cannot_confirm_yet",
  },
  quiet_room: {
    domain: "room_preference",
    subtype: "quiet_room",
    required_fields: ["manager_approval", "room_block"],
    missing_fields: ["manager_approval", "room_block"],
    verification_route: "needs_human_approval",
  },
  gluten_free_breakfast: {
    domain: "fb_requirement",
    subtype: "gluten_free",
    required_fields: ["attendee_count"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  projector_setup: {
    domain: "event_av",
    subtype: "projector",
    required_fields: ["meeting_room", "meeting_start"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  airport_transfer: {
    domain: "transport",
    subtype: "airport_transfer",
    required_fields: ["flight_number", "arrival_time", "passenger_count", "phone_number"],
    missing_fields: ["flight_number", "arrival_time", "passenger_count", "phone_number"],
    verification_route: "missing_guest_info",
  },
  company_invoice: {
    domain: "commercial",
    subtype: "company_invoice",
    required_fields: ["billing_contact", "tax_id", "billing_address"],
    missing_fields: ["billing_contact", "tax_id", "billing_address"],
    verification_route: "missing_guest_info",
  },
  upgrade: {
    domain: "exception_value",
    subtype: "upgrade",
    required_fields: ["manager_approval"],
    missing_fields: ["manager_approval"],
    verification_route: "needs_human_approval",
  },
  high_floor: {
    domain: "room_preference",
    subtype: "high_floor",
    required_fields: [],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
  parking: {
    domain: "transport",
    subtype: "parking",
    required_fields: ["vehicle_plate", "arrival_time"],
    missing_fields: ["vehicle_plate", "arrival_time"],
    verification_route: "missing_guest_info",
  },
  long_stay_discount: {
    domain: "commercial",
    subtype: "payment_terms",
    required_fields: ["revenue_manager_approval"],
    missing_fields: ["revenue_manager_approval"],
    verification_route: "needs_human_approval",
  },
  lost_and_found: {
    domain: "lost_and_found",
    subtype: "lost_item_search",
    required_fields: ["item_description", "last_known_location"],
    missing_fields: [],
    verification_route: "cannot_confirm_yet",
  },
  maintenance: {
    domain: "maintenance_service",
    subtype: "repair_request",
    required_fields: ["issue_description"],
    missing_fields: [],
    verification_route: "self_verifiable",
  },
};

const QUOTE_PATTERNS: Record<string, RegExp> = {
  early_check_in: /Some executives may arrive around 11am, so early check-in would be helpful/i,
  quiet_room: /Please place our VP in a quiet king room away from elevators if possible/i,
  gluten_free_breakfast: /We also need gluten-free breakfast for two attendees/i,
  projector_setup: /a projector in the meeting room/i,
  airport_transfer: /airport transfer from MAD/i,
  company_invoice: /a company invoice/i,
  upgrade: /free upgrade to a suite/i,
  high_floor: /high-floor quiet room/i,
  parking: /parking available/i,
  long_stay_discount: /long-stay discount for the monthly rate/i,
  lost_and_found: /left a phone charger in my room during my last visit/i,
  maintenance: /air conditioning in my room isn't cooling/i,
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

function quoteFor(ruleKey: string, messages: Message[]): Pick<ExtraItem, "source_message_id" | "source_quote"> {
  const pattern = QUOTE_PATTERNS[ruleKey];
  if (!pattern) return {};

  for (const message of messages) {
    const match = message.body.match(pattern);
    if (match?.[0]) {
      return { source_message_id: message.message_id, source_quote: match[0] };
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

export function analyzeBookingInfo(bookingId: string, reservation: Reservation | null): InfoAnalysis {
  const messages = loadMessages().filter((m) => m.booking_id === bookingId);
  const ledger = loadPromiseLedger().filter((p) => p.booking_id === bookingId);
  const missing = missingBasicFields(reservation);
  const basicComplete = missing.length === 0;

  const extraItems: ExtraItem[] = basicComplete
    ? ledger.map((row) => {
        const meta = refinedMeta(row.category, bookingId);
        return {
          item_id: row.promise_id,
          text: row.promise_text,
          ...quoteFor(row.category, messages),
          domain: meta.domain,
          subtype: meta.subtype,
          clarity: meta.missing_fields.length ? "missing_required_fields" : "clear",
          required_fields: meta.required_fields,
          missing_fields: meta.missing_fields,
          verification_route: meta.verification_route,
          rule_key: row.category,
        };
      })
    : [];

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
    extra_items: extraItems,
  };
}

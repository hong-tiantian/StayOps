import { runPromiseAuditFromMessages, type AuditResult } from "@/lib/classifier";
import type { IntakeMessage } from "@/lib/intake/types";

export interface AuditFromIntakeRequest {
  intake_id?: string;
  booking_id?: string;
  messages?: IntakeMessage[];
  body_text?: string;
  source?: IntakeMessage["source"];
  sender?: string;
  subject?: string;
  received_at?: string;
}

export interface AuditFromIntakeResult {
  ok: true;
  intake_id: string;
  mapped_booking_id: string;
  mapping_reason: string;
  intake_messages: IntakeMessage[];
  audit: AuditResult;
}

export function normalizeAuditFromIntakeRequest(body: AuditFromIntakeRequest): IntakeMessage[] {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    return body.messages.map((message) => ({
      ...message,
      body_text: message.body_text.trim(),
    }));
  }

  if (typeof body.body_text === "string" && body.body_text.trim()) {
    return [
      {
        source: body.source ?? "manual_paste",
        sender: body.sender,
        subject: body.subject,
        received_at: body.received_at,
        body_text: body.body_text.trim(),
      },
    ];
  }

  return [];
}

export function mapIntakeToBooking(messages: IntakeMessage[], requestedBookingId?: string): {
  booking_id: string;
  reason: string;
} {
  if (requestedBookingId) {
    return {
      booking_id: requestedBookingId,
      reason: "booking_id supplied by caller",
    };
  }

  const haystack = messages
    .map((message) => `${message.subject ?? ""}\n${message.sender ?? ""}\n${message.body_text}`)
    .join("\n")
    .toLowerCase();
  if (matchesAcmeDemoBooking(haystack)) {
    return {
      booking_id: syntheticIntakeBookingId(haystack),
      reason: "intake content resembles the Acme demo case, but intake audits use an isolated context and do not touch the Acme main flow",
    };
  }

  return {
    booking_id: syntheticIntakeBookingId(haystack),
    reason: "unmapped intake was audited in a new isolated booking context",
  };
}

function syntheticIntakeBookingId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `INTAKE-${hash.toString(16).padStart(8, "0").toUpperCase()}`;
}

function matchesAcmeDemoBooking(haystack: string): boolean {
  const hasCompany = haystack.includes("acme robotics") || /\bacme\b/.test(haystack);
  const hasArrivalDate =
    haystack.includes("july 18") ||
    haystack.includes("jul 18") ||
    haystack.includes("07/18") ||
    haystack.includes("18 july");
  const hasStayWindow =
    hasArrivalDate &&
    (haystack.includes("july 20") ||
      haystack.includes("jul 20") ||
      haystack.includes("07/20") ||
      haystack.includes("20 july"));
  const hasMeetingClue =
    haystack.includes("mr-blue") ||
    haystack.includes("meeting room") ||
    haystack.includes("projector") ||
    haystack.includes("presentation");
  const hasRoomClue =
    haystack.includes("quiet") ||
    haystack.includes("king room") ||
    haystack.includes("king rooms") ||
    haystack.includes("12 rooms");
  const hasOpsClue =
    haystack.includes("breakfast") ||
    haystack.includes("airport") ||
    haystack.includes("transfer") ||
    haystack.includes("invoice") ||
    haystack.includes("billing");

  return (hasCompany && (hasStayWindow || hasMeetingClue || hasRoomClue)) || (hasArrivalDate && hasMeetingClue && hasOpsClue);
}

export async function auditFromIntake(body: AuditFromIntakeRequest): Promise<AuditFromIntakeResult> {
  const messages = normalizeAuditFromIntakeRequest(body);
  if (messages.length === 0) {
    throw new Error("intake_message_required");
  }

  const mapping = mapIntakeToBooking(messages, body.booking_id);
  const audit = await runPromiseAuditFromMessages(messages, { booking_id: mapping.booking_id });

  return {
    ok: true,
    intake_id: body.intake_id ?? `INTAKE-${Date.now()}`,
    mapped_booking_id: mapping.booking_id,
    mapping_reason: mapping.reason,
    intake_messages: messages,
    audit,
  };
}

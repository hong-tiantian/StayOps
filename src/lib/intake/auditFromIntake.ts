import { runPromiseAudit, type AuditResult } from "@/lib/classifier";
import { ACME_BOOKING_ID } from "@/lib/evaluation/metrics";
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
  if (
    haystack.includes("acme robotics") ||
    haystack.includes("bkg-2026-0718-acme") ||
    (haystack.includes("projector") && haystack.includes("quiet king"))
  ) {
    return {
      booking_id: ACME_BOOKING_ID,
      reason: "intake content matched the Acme demo booking",
    };
  }

  return {
    booking_id: ACME_BOOKING_ID,
    reason: "first version only supports the Acme demo booking; unmapped intake fell back to Acme",
  };
}

export async function auditFromIntake(body: AuditFromIntakeRequest): Promise<AuditFromIntakeResult> {
  const messages = normalizeAuditFromIntakeRequest(body);
  if (messages.length === 0) {
    throw new Error("intake_message_required");
  }

  const mapping = mapIntakeToBooking(messages, body.booking_id);
  const audit = await runPromiseAudit(mapping.booking_id, { force: true });

  return {
    ok: true,
    intake_id: body.intake_id ?? `INTAKE-${Date.now()}`,
    mapped_booking_id: mapping.booking_id,
    mapping_reason: mapping.reason,
    intake_messages: messages,
    audit,
  };
}

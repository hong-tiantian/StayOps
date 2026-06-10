import type { IntakeMessage } from "@/lib/intake/types";

export function normalizeManualPaste(input: {
  body_text: string;
  sender?: string;
  subject?: string;
  received_at?: string;
}): IntakeMessage {
  return {
    source: "manual_paste",
    sender: input.sender,
    subject: input.subject,
    received_at: input.received_at,
    body_text: input.body_text.trim(),
  };
}

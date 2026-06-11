import { getGmailAccessToken, gmailReadonlyConfigured } from "../intake/gmail";

/**
 * Gmail send — the last step of the reply loop. Only ever called from the
 * /api/reply/send route after a human clicked Send on a reviewed draft.
 *
 * Requires the gmail.send scope on the stored refresh token. Tokens issued
 * before the scope was added fail with insufficient permissions; the route
 * degrades to copy/mailto so the demo never hard-blocks.
 */

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface SendResult {
  ok: boolean;
  message_id?: string;
  thread_id?: string;
  status: "sent" | "not_configured" | "insufficient_scope" | "api_error";
  reason?: string;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMime(to: string, subject: string, body: string): string {
  // RFC 2047 encode the subject so non-ASCII survives.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  return [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body, "utf8").toString("base64"),
  ].join("\r\n");
}

export async function sendGuestReply(input: {
  to: string;
  subject: string;
  body: string;
  thread_id?: string;
}): Promise<SendResult> {
  if (!gmailReadonlyConfigured()) {
    return { ok: false, status: "not_configured", reason: "Gmail OAuth env vars are not set." };
  }
  try {
    const accessToken = await getGmailAccessToken();
    const payload: Record<string, string> = { raw: toBase64Url(buildMime(input.to, input.subject, input.body)) };
    if (input.thread_id) payload.threadId = input.thread_id;

    const res = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      threadId?: string;
      error?: { message?: string; status?: string };
    };
    if (!res.ok) {
      const insufficient = res.status === 403 || /insufficient/i.test(data.error?.message ?? "");
      return {
        ok: false,
        status: insufficient ? "insufficient_scope" : "api_error",
        reason: insufficient
          ? "The stored refresh token lacks gmail.send — reconnect Gmail to grant it."
          : data.error?.message ?? `gmail_http_${res.status}`,
      };
    }
    return { ok: true, status: "sent", message_id: data.id, thread_id: data.threadId };
  } catch (err) {
    return { ok: false, status: "api_error", reason: err instanceof Error ? err.message : "send failed" };
  }
}

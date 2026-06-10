import type { GmailAdapterResult, GmailThreadSummary, IntakeMessage } from "@/lib/intake/types";

type GmailHeader = { name: string; value: string };
type GmailBody = { data?: string };
type GmailPayload = {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: GmailBody;
  parts?: GmailPayload[];
};

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
}

const REQUIRED_ENV = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REDIRECT_URI", "GMAIL_REFRESH_TOKEN"];

export function gmailReadonlyConfigured(): boolean {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}

export async function searchGmailThreads(_query: string): Promise<GmailAdapterResult<GmailThreadSummary[]>> {
  if (!gmailReadonlyConfigured()) {
    return gmailUnavailable();
  }
  return {
    ok: false,
    source: "gmail",
    status: "not_implemented",
    reason: "Gmail OAuth credentials are present, but live Gmail API fetch is intentionally gated until the demo mailbox is confirmed.",
    required_env: REQUIRED_ENV,
  };
}

export async function loadGmailThread(_threadId: string): Promise<GmailAdapterResult<IntakeMessage[]>> {
  if (!gmailReadonlyConfigured()) {
    return gmailUnavailable();
  }
  return {
    ok: false,
    source: "gmail",
    status: "not_implemented",
    reason: "Gmail OAuth credentials are present, but live Gmail API import is intentionally gated until the demo mailbox is confirmed.",
    required_env: REQUIRED_ENV,
  };
}

export function normalizeGmailMessage(raw: GmailMessage): IntakeMessage {
  const headers = raw.payload?.headers ?? [];
  const from = header(headers, "from");
  const to = header(headers, "to");
  const cc = header(headers, "cc");
  const subject = header(headers, "subject");
  const date = header(headers, "date");
  const body = decodeBestBody(raw.payload) || raw.snippet || "";

  return {
    source: "gmail",
    external_id: raw.id,
    thread_id: raw.threadId,
    sender: from,
    recipients: splitRecipients([to, cc].filter(Boolean).join(",")),
    subject,
    received_at: raw.internalDate ? new Date(Number(raw.internalDate)).toISOString() : date,
    body_text: removeObviousQuotedReply(body),
  };
}

function gmailUnavailable(): GmailAdapterResult<never> {
  return {
    ok: false,
    source: "gmail",
    status: "not_configured",
    reason: "Gmail readonly OAuth is not configured. Manual paste and seeded CSV intake remain available.",
    required_env: REQUIRED_ENV,
  };
}

function header(headers: GmailHeader[], name: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function splitRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function decodeBestBody(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return stripHtml(decodeBase64Url(html.body.data));
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(decoded) : decoded;
  }
  return "";
}

function findPart(payload: GmailPayload, mimeType: string): GmailPayload | undefined {
  if (payload.mimeType === mimeType) return payload;
  for (const part of payload.parts ?? []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return undefined;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function removeObviousQuotedReply(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^On .+ wrote:$/.test(trimmed)) break;
    if (/^From:\s/i.test(trimmed) && kept.length > 0) break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

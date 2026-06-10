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
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailReadonlyConfigured(): boolean {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}

export async function searchGmailThreads(query: string): Promise<GmailAdapterResult<GmailThreadSummary[]>> {
  if (!gmailReadonlyConfigured()) {
    return gmailUnavailable();
  }
  try {
    const accessToken = await getGmailAccessToken();
    const search = new URLSearchParams({
      q: query || "[STAYOPS DEMO]",
      maxResults: "10",
    });
    const listed = await gmailFetch<{ threads?: Array<{ id: string }> }>(`${GMAIL_API}/threads?${search}`, accessToken);
    const summaries = await Promise.all((listed.threads ?? []).map((thread) => loadThreadSummary(thread.id, accessToken)));
    return { ok: true, source: "gmail", data: summaries };
  } catch (err) {
    return gmailFailure(err);
  }
}

export async function loadGmailThread(threadId: string): Promise<GmailAdapterResult<IntakeMessage[]>> {
  if (!gmailReadonlyConfigured()) {
    return gmailUnavailable();
  }
  try {
    const accessToken = await getGmailAccessToken();
    const thread = await gmailFetch<{ messages?: GmailMessage[] }>(
      `${GMAIL_API}/threads/${encodeURIComponent(threadId)}?format=full`,
      accessToken
    );
    return { ok: true, source: "gmail", data: (thread.messages ?? []).map(normalizeGmailMessage) };
  } catch (err) {
    return gmailFailure(err);
  }
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

async function getGmailAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID ?? "",
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
      refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new GmailAuthError(data.error_description ?? data.error ?? `oauth_token_http_${response.status}`);
  }
  return data.access_token;
}

async function loadThreadSummary(threadId: string, accessToken: string): Promise<GmailThreadSummary> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const headerName of ["Subject", "From", "Date"]) {
    params.append("metadataHeaders", headerName);
  }
  const thread = await gmailFetch<{ id: string; snippet?: string; messages?: GmailMessage[] }>(
    `${GMAIL_API}/threads/${encodeURIComponent(threadId)}?${params}`,
    accessToken
  );
  const latest = [...(thread.messages ?? [])].sort((a, b) => Number(b.internalDate ?? 0) - Number(a.internalDate ?? 0))[0];
  const headers = latest?.payload?.headers ?? [];
  return {
    thread_id: thread.id,
    subject: header(headers, "subject"),
    sender: header(headers, "from"),
    received_at: latest?.internalDate ? new Date(Number(latest.internalDate)).toISOString() : header(headers, "date"),
    snippet: thread.snippet ?? latest?.snippet,
  };
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new GmailApiError(data.error?.message ?? `gmail_http_${response.status}`);
  }
  return data;
}

function gmailFailure(err: unknown): GmailAdapterResult<never> {
  const isAuth = err instanceof GmailAuthError;
  return {
    ok: false,
    source: "gmail",
    status: isAuth ? "auth_error" : "api_error",
    reason: err instanceof Error ? err.message : "Gmail API request failed.",
    required_env: REQUIRED_ENV,
  };
}

class GmailAuthError extends Error {}
class GmailApiError extends Error {}

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

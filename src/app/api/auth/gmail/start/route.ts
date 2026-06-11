import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

// readonly: intake search/import · send: agent-drafted, manager-approved replies
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        ok: false,
        error: "gmail_oauth_not_configured",
        required_env: ["GMAIL_CLIENT_ID", "GMAIL_REDIRECT_URI"],
      },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("stayops_gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/api/auth/gmail",
    maxAge: 10 * 60,
  });
  return response;
}

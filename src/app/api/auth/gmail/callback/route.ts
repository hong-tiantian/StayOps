import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return tokenResponse({ ok: false, error }, 400);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get("stayops_gmail_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return tokenResponse({ ok: false, error: "invalid_oauth_state" }, 400);
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return tokenResponse(
      {
        ok: false,
        error: "gmail_oauth_not_configured",
        required_env: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REDIRECT_URI"],
      },
      503
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok) {
    return tokenResponse(
      {
        ok: false,
        error: data.error ?? "gmail_token_exchange_failed",
        reason: data.error_description,
      },
      400
    );
  }

  const body =
    process.env.GMAIL_OAUTH_SHOW_TOKEN === "true"
      ? {
          ok: true,
          message: "Copy GMAIL_REFRESH_TOKEN into .env.local or Cloud Run env vars. Do not commit it.",
          refresh_token: data.refresh_token,
          scope: data.scope,
        }
      : {
          ok: true,
          message:
            "Gmail OAuth succeeded. Set GMAIL_OAUTH_SHOW_TOKEN=true only during local setup if you need to display the refresh token.",
          refresh_token_present: Boolean(data.refresh_token),
          scope: data.scope,
        };

  return tokenResponse(body, 200);
}

function tokenResponse(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.cookies.delete("stayops_gmail_oauth_state");
  return response;
}

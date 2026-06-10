import { NextResponse } from "next/server";

export function rejectEvalRequest(req: Request): NextResponse | null {
  if (req.method === "GET") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && process.env.EVAL_API_ENABLED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const token = process.env.EVAL_API_TOKEN;
  if (isProduction && !token) {
    return NextResponse.json({ error: "eval_api_token_not_configured" }, { status: 503 });
  }

  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

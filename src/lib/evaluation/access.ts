import { NextResponse } from "next/server";

export function rejectEvalRequest(req: Request): NextResponse | null {
  if (req.method === "GET") {
    return NextResponse.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && process.env.EVAL_API_ENABLED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Token is optional. If EVAL_API_TOKEN is set, the endpoint is locked to
  // callers presenting it (CLI/CI use). If it is unset, the eval runs open so
  // the hosted demo's Judge-view eval card works from the browser.
  const token = process.env.EVAL_API_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

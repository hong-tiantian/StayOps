import { NextResponse } from "next/server";
import { toggleStale } from "@/lib/freshness";
import { clearAuditCache } from "@/lib/classifier";

export const dynamic = "force-dynamic";

/**
 * Demo control: flip a data source between fresh and stale. Clears the audit
 * cache so the next audit re-runs and the freshness gate can downgrade promises
 * live — the visible proof that "stale data ⇒ no guarantee".
 */
export async function POST(req: Request) {
  const { source } = (await req.json()) as { source?: string };
  if (!source) {
    return NextResponse.json({ error: "missing source" }, { status: 400 });
  }
  const stale = toggleStale(source);
  clearAuditCache();
  return NextResponse.json({ source, stale });
}

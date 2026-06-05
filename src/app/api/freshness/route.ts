import { NextResponse } from "next/server";
import { allFreshness, DEMO_NOW } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const sources = allFreshness();
  const all_fresh = sources.every((s) => s.freshness_status === "fresh");
  return NextResponse.json({ demo_now: DEMO_NOW, all_fresh, sources });
}

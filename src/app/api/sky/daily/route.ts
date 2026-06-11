import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/sky/daily — proxy for Bing's daily photography archive.
 *
 * Bing's homepage images are professional nature/travel photography (the
 * closest freely-hotlinkable thing to a "photo of the day" feed) but the
 * JSON endpoint has no CORS headers, so the browser can't fetch it directly.
 * We fetch server-side, cache in-process for 12h, and return plain image
 * URLs. Failures return an empty list — the curated pools always work.
 */

const ARCHIVE_URL = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US";
const CACHE_MS = 12 * 60 * 60 * 1000;

let cache: { at: number; images: string[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ ok: true, images: cache.images, cached: true });
  }
  try {
    const res = await fetch(ARCHIVE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (StayOps demo)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`bing_http_${res.status}`);
    const data = (await res.json()) as { images?: Array<{ urlbase?: string }> };
    const images = (data.images ?? [])
      .map((i) => i.urlbase)
      .filter((u): u is string => Boolean(u))
      .map((u) => `https://www.bing.com${u}_1920x1080.jpg`);
    cache = { at: Date.now(), images };
    return NextResponse.json({ ok: true, images });
  } catch (err) {
    console.warn("[StayOps] Bing daily archive unavailable:", err);
    return NextResponse.json({ ok: true, images: [], degraded: true });
  }
}

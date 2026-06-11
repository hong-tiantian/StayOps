import { NextRequest, NextResponse } from "next/server";
import { addSopDoc, getHotel, listSopDocs } from "@/lib/hotel/hotelStore";
import { clearAuditCache } from "@/lib/classifier";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ hotel_id: string }> };

/** GET /api/hotels/:hotel_id/sop — list this hotel's SOP documents. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { hotel_id } = await params;
  if (!getHotel(hotel_id)) {
    return NextResponse.json({ ok: false, error: "unknown hotel" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, hotel_id, docs: listSopDocs(hotel_id) });
}

/**
 * POST /api/hotels/:hotel_id/sop — onboard a new SOP document.
 * Body: { title, text }. Chunked immediately; embedded lazily on first
 * retrieval, so upload stays fast even when the embedding endpoint is slow.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { hotel_id } = await params;
  if (!getHotel(hotel_id)) {
    return NextResponse.json({ ok: false, error: "unknown hotel" }, { status: 404 });
  }
  const body = (await req.json()) as { title?: string; text?: string };
  const title = body.title?.trim();
  const text = body.text?.trim();
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "title and text required" }, { status: 400 });
  }
  if (text.length > 60_000) {
    return NextResponse.json({ ok: false, error: "document too large (60k chars max)" }, { status: 413 });
  }
  const doc = addSopDoc(hotel_id, title, text, "upload");
  clearAuditCache();
  return NextResponse.json({ ok: true, doc_id: doc.doc_id, title: doc.title, chunks: listSopDocs(hotel_id).find((d) => d.doc_id === doc.doc_id)?.chunk_count ?? 0 });
}

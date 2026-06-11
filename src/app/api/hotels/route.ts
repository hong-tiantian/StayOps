import { NextRequest, NextResponse } from "next/server";
import { listHotels, getActiveHotelId, setActiveHotelId } from "@/lib/hotel/hotelStore";
import { clearAuditCache } from "@/lib/classifier";

export const dynamic = "force-dynamic";

/** GET /api/hotels — all hotel personas plus which one is active. */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, active_hotel_id: getActiveHotelId(), hotels: listHotels() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/** POST /api/hotels — switch the active hotel. Body: { hotel_id }. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { hotel_id?: string };
    if (!body.hotel_id) {
      return NextResponse.json({ ok: false, error: "hotel_id required" }, { status: 400 });
    }
    setActiveHotelId(body.hotel_id);
    clearAuditCache(); // decisions are persona-dependent — stale audits would lie
    return NextResponse.json({ ok: true, active_hotel_id: body.hotel_id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}

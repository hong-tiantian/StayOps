import { NextResponse } from "next/server";
import { loadReservations } from "@/lib/data";

export const dynamic = "force-dynamic";

/** List all bookings for the UI booking selector. */
export async function GET() {
  const bookings = loadReservations().map((r) => ({
    booking_id: r.booking_id,
    company_name: r.company_name,
    arrival_date: r.arrival_date,
  }));
  return NextResponse.json({ bookings });
}

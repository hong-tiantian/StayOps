import { Reservation } from "@/lib/types";

export default function BookingHeader({ reservation }: { reservation: Reservation | null }) {
  if (!reservation) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card text-sm text-gray-400">
        Loading booking…
      </div>
    );
  }
  const items: Array<[string, string]> = [
    ["Booking ID", reservation.booking_id],
    ["Company", reservation.company_name],
    ["Stay", `${reservation.arrival_date} → ${reservation.departure_date}`],
    ["Arrival", reservation.arrival_time],
    ["Rooms", `${reservation.room_count} (${reservation.king_count} king / ${reservation.twin_count} twin)`],
    ["Meeting room", reservation.meeting_room_id],
    ["Primary contact", reservation.primary_contact],
    ["Status", reservation.status],
  ];
  return (
    <div className="card lift p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Booking Context</h2>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          {reservation.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-400">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

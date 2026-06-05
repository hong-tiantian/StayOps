import { Reservation } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

export default function BookingHeader({ reservation, lang }: { reservation: Reservation | null; lang: Lang }) {
  const t = ui[lang];
  if (!reservation) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card text-sm text-gray-400">
        {t.booking.loading}
      </div>
    );
  }
  const items: Array<[string, string]> = [
    [t.booking.id, reservation.booking_id],
    [t.booking.company, reservation.company_name],
    [t.booking.stay, `${reservation.arrival_date} → ${reservation.departure_date}`],
    [t.booking.arrival, reservation.arrival_time],
    [t.booking.rooms, `${reservation.room_count} (${reservation.king_count} ${t.booking.king} / ${reservation.twin_count} ${t.booking.twin})`],
    [t.booking.meetingRoom, reservation.meeting_room_id],
    [t.booking.contact, reservation.primary_contact],
    [t.booking.status, reservation.status],
  ];
  return (
    <div className="card lift p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-950">{t.booking.title}</h2>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {reservation.status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase text-slate-400">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

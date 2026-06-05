import { Message } from "@/lib/types";

const CHANNEL_LABEL: Record<string, string> = {
  sales_email: "Sales email",
  sales_note: "Internal sales note",
  guest_email: "Guest email",
  complaint: "Complaint",
};

export default function BookingEmailPanel({ messages }: { messages: Message[] }) {
  return (
    <div className="card lift p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Corporate Booking Thread
      </h2>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.message_id}
            className={`rounded-lg border p-3 ${
              m.message_type === "complaint"
                ? "border-red-200 bg-red-50"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-600 border border-gray-200">
                {m.message_id}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${
                  m.message_type === "complaint"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {CHANNEL_LABEL[m.channel] ?? m.channel}
              </span>
              <span>{m.sender}</span>
              <span className="text-gray-400">
                {m.received_at.replace("T", " ").replace("Z", "")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{m.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

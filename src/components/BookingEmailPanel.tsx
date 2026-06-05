import { Message } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

const CHANNEL_LABEL: Record<string, string> = {
  sales_email: "Sales email",
  sales_note: "Internal sales note",
  guest_email: "Guest email",
  complaint: "Complaint",
};

export default function BookingEmailPanel({ messages, lang }: { messages: Message[]; lang: Lang }) {
  const t = ui[lang];
  return (
    <div className="card lift p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-950">
        {t.messages.title}
      </h2>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.message_id}
            className={`rounded-2xl border p-3 ${
              m.message_type === "complaint"
                ? "border-rose-200 bg-rose-50"
                : "border-slate-200/70 bg-slate-50/80"
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-600 border border-slate-200">
                {m.message_id}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 font-medium ${
                  m.message_type === "complaint"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {t.messages[m.channel as keyof typeof t.messages] ?? CHANNEL_LABEL[m.channel] ?? m.channel}
              </span>
              <span>{m.sender}</span>
              <span className="text-slate-400">
                {m.received_at.replace("T", " ").replace("Z", "")}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{m.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

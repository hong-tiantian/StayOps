"use client";

import { useState } from "react";
import { RecoveryTrace, ToolCall } from "@/lib/types";
import ToolCallLog from "./ToolCallLog";
import { failurePointLabel, failureTypeLabel } from "@/lib/humanize";
import { Lang, ui } from "@/lib/i18n";

const DEFAULT_COMPLAINT =
  "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.";

const URGENCY_STYLE: Record<string, string> = {
  immediate: "bg-red-100 text-red-700",
  same_day: "bg-amber-100 text-amber-700",
  next_day: "bg-blue-100 text-blue-700",
};

export default function ComplaintRecovery({
  trace,
  toolCalls,
  onTrace,
  busy,
  lang,
}: {
  trace: RecoveryTrace | null;
  toolCalls: ToolCall[];
  onTrace: (text: string) => void;
  busy: boolean;
  lang: Lang;
}) {
  const t = ui[lang];
  const [text, setText] = useState(DEFAULT_COMPLAINT);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card lift p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">{t.recovery.complaint}</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-gray-200 p-2 text-sm text-gray-700 focus:border-slate-400 focus:outline-none"
          />
          <button
            onClick={() => onTrace(text)}
            disabled={busy}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? t.recovery.tracing : t.recovery.trace}
          </button>
        </div>

        {trace && (
          <>
            <Card title={t.recovery.matched}>
              <ul className="space-y-1 text-sm">
                {trace.matched_promises.map((m) => (
                  <li key={m.promise_id} className="flex items-center gap-2">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px]">
                      {m.promise_id}
                    </span>
                    <span className="text-gray-700">{m.promise_text}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={t.recovery.broken}>
              <div className="space-y-2">
                {trace.matched_promises.map((m) => (
                  <div
                    key={m.promise_id}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs"
                  >
                    <div className="font-medium text-red-800">
                      {m.promise_id} — {failureTypeLabel(m.failure_type)}
                    </div>
                    <div className="text-red-600">
                      {t.recovery.where}: {failurePointLabel(m.failure_point)}
                    </div>
                    <div className="mt-1 text-red-700">{m.root_cause}</div>
                    {m.linked_task_id && (
                      <div className="mt-1 text-[10px] text-red-500">
                        {t.recovery.linkedTask}: {m.linked_task_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-4">
        {trace ? (
          <>
            <Card title={t.recovery.actions}>
              <ol className="space-y-2 text-sm">
                {trace.recovery_plan.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {p.department}
                    </span>
                    <span className="flex-1 text-gray-700">{p.action}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        URGENCY_STYLE[p.urgency] ?? "bg-gray-100"
                      }`}
                    >
                      {p.urgency}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card title={t.recovery.reply}>
              <p className="rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
                {trace.guest_reply_draft}
              </p>
            </Card>

            <Card title={t.recovery.postmortem}>
              <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700">
                {trace.postmortem_suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Card>

            <Card title={t.recovery.tools}>
              <ToolCallLog calls={toolCalls} dense />
            </Card>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
            {t.recovery.empty}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card lift p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import { RecoveryTrace, ToolCall } from "@/lib/types";
import ToolCallLog from "./ToolCallLog";
import { failurePointLabel, failureTypeLabel } from "@/lib/humanize";
import { Lang, ui } from "@/lib/i18n";

const DEFAULT_COMPLAINT =
  "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.";

const URGENCY_STYLE: Record<string, string> = {
  immediate: "border border-rose-300/30 bg-rose-400/12 text-rose-200",
  same_day: "border border-amber-300/30 bg-amber-400/12 text-amber-200",
  next_day: "border border-sky-300/30 bg-sky-400/12 text-sky-200",
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
    <div className="space-y-4">
      <div>
        <h1 className="t-title">{lang === "zh" ? "投诉恢复" : "Complaint Recovery"}</h1>
        <p className="t-caption mt-0.5">{lang === "zh" ? "把投诉追溯到具体断裂的承诺，并给出恢复方案" : "Trace a complaint back to the exact broken promise and recover"}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="glass p-5">
            <h3 className="t-label mb-3">{t.recovery.complaint}</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-[13.5px] leading-relaxed text-white/85 placeholder-white/30 focus:border-white/25 focus:outline-none"
            />
            <button
              onClick={() => onTrace(text)}
              disabled={busy}
              className="btn btn-danger mt-2.5 disabled:opacity-50"
            >
              {busy ? t.recovery.tracing : t.recovery.trace}
            </button>
          </div>

          {trace && (
            <>
              <Card title={t.recovery.matched}>
                <ul className="space-y-2">
                  {trace.matched_promises.map((m) => (
                    <li key={m.promise_id} className="flex items-center gap-2.5">
                      <span className="tnum rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/55">
                        {m.promise_id}
                      </span>
                      <span className="text-[13.5px] text-white/80">{m.promise_text}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title={t.recovery.broken}>
                <div className="space-y-2.5">
                  {trace.matched_promises.map((m) => (
                    <div
                      key={m.promise_id}
                      className="status-edge rounded-xl bg-white/[0.03] p-3.5 pl-5"
                      style={{ "--edge": "251 113 133" } as React.CSSProperties}
                    >
                      <div className="text-[13.5px] font-semibold text-rose-200">
                        {m.promise_id} — {failureTypeLabel(m.failure_type)}
                      </div>
                      <div className="t-caption mt-0.5">
                        {t.recovery.where}: {failurePointLabel(m.failure_point)}
                      </div>
                      <div className="t-body mt-1">{m.root_cause}</div>
                      {m.linked_task_id && (
                        <div className="tnum mt-1.5 font-mono text-[11px] text-white/38">
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
                <ol className="space-y-2.5">
                  {trace.recovery_plan.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">
                        {p.department.replace(/_/g, " ")}
                      </span>
                      <span className="flex-1 text-[13.5px] leading-relaxed text-white/80">{p.action}</span>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${URGENCY_STYLE[p.urgency] ?? "border border-white/10 bg-white/5 text-white/55"}`}>
                        {p.urgency}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card title={t.recovery.reply}>
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-white/80">
                  {trace.guest_reply_draft}
                </p>
              </Card>

              <Card title={t.recovery.postmortem}>
                <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-white/80">
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
            <div className="t-caption grid h-48 place-items-center rounded-[20px] border border-dashed border-white/12 bg-white/[0.02]">
              {t.recovery.empty}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass p-5">
      <h3 className="t-label mb-3">{title}</h3>
      {children}
    </div>
  );
}

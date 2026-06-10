"use client";

import { useState } from "react";
import { TIMELINE_FILTERS, TimelineFilter, filterTimeline } from "@/lib/timeline";
import { RecoveryTrace } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

const CAT: Record<string, { rgb: string }> = {
  promise: { rgb: "129,140,248" },
  approval: { rgb: "178,160,218" },
  task: { rgb: "56,189,248" },
  complaint: { rgb: "229,138,148" },
  recovery: { rgb: "126,200,169" },
  system: { rgb: "148,163,184" },
};

export default function TimelineView({ trace, lang }: { trace: RecoveryTrace | null; lang: Lang }) {
  const t = ui[lang];
  const [filter, setFilter] = useState<TimelineFilter>("All");
  const events = filterTimeline(filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-title">{lang === "zh" ? "时间线" : "Timeline"}</h1>
        <p className="t-caption mt-0.5">{lang === "zh" ? "从承诺到投诉恢复的完整事件流" : "Full event flow from promise to complaint recovery"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIMELINE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn ${filter === f ? "btn-primary" : "btn-glass"}`}
          >
            {t.timeline.filters[f]}
          </button>
        ))}
      </div>

      <div className="glass p-6">
        <ol className="relative ml-1 border-l border-white/[0.08]">
          {events.map((e, i) => {
            const c = CAT[e.category] ?? CAT.system;
            return (
              <li
                key={i}
                className="mb-5 ml-6 last:mb-0 animate-fadeup"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <span
                  className="absolute -left-[5.5px] mt-1.5 h-2.5 w-2.5 rounded-full"
                  style={{ background: `rgb(${c.rgb})`, boxShadow: "0 0 0 4px rgb(13,16,32)" }}
                />
                <div className="group flex flex-col gap-1 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <time className="tnum font-mono text-[11px] text-white/38">{e.at}</time>
                    <span className="t-label" style={{ color: `rgba(${c.rgb},0.85)` }}>
                      {e.category}
                    </span>
                  </div>
                  <p className="text-[13.5px] font-semibold text-white/90">{e.label}</p>
                  {e.detail && <p className="t-body">{e.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {trace && (
        <div className="status-edge animate-fadeup glass p-6 pl-7" style={{ "--edge": "251 113 133" } as React.CSSProperties}>
          <h3 className="t-label mb-4 !text-rose-200">{t.timeline.broke}</h3>
          <div className="space-y-5">
            {trace.matched_promises.map((m) => {
              const nodes =
                m.promise_id === "P-002"
                  ? ["Complaint", m.promise_id, "APR-001", m.linked_task_id ?? "Task", "Not completed", "Failure"]
                  : ["Complaint", m.promise_id, m.linked_task_id ?? "Task", "Wrong due time", "Failure"];
              const displayNodes = nodes.map((node) => t.timeline.chain[node as keyof typeof t.timeline.chain] ?? node);
              return (
                <div key={m.promise_id}>
                  <FlowChain nodes={displayNodes} />
                  <p className="mt-2 pl-1 text-[12.5px] text-rose-200/90">{m.root_cause}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FlowChain({ nodes }: { nodes: string[] }) {
  const tone = (label: string, i: number) => {
    if (i === 0) return "border border-rose-300/30 bg-rose-400/12 text-rose-200";
    if (label === "Failure" || label === "失败") return "bg-rose-500 text-white";
    if (label.startsWith("APR")) return "border border-violet-300/30 bg-violet-400/12 text-violet-200";
    if (label.startsWith("TASK")) return "border border-sky-300/30 bg-sky-400/12 text-sky-200";
    if (label.startsWith("P-")) return "border border-indigo-300/30 bg-indigo-400/12 text-indigo-200";
    if (label.includes("Not") || label.includes("Wrong") || label.includes("未完成") || label.includes("错误")) return "border border-amber-300/30 bg-amber-400/12 text-amber-200";
    return "border border-white/12 bg-white/6 text-white/70";
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className={`rounded-lg px-2.5 py-1 text-[12px] font-medium ${tone(n, i)}`}>{n}</span>
          {i < nodes.length - 1 && (
            <svg width="26" height="12" viewBox="0 0 26 12" className="text-white/25">
              <path d="M0 6 H22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
              <path d="M20 2.5 L25 6 L20 9.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

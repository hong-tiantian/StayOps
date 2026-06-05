"use client";

import { useState } from "react";
import { TIMELINE_FILTERS, TimelineFilter, filterTimeline } from "@/lib/timeline";
import { RecoveryTrace } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

const CAT: Record<string, { dot: string; ring: string; chip: string }> = {
  promise: { dot: "bg-indigo-500", ring: "ring-indigo-100", chip: "bg-indigo-50 text-indigo-600" },
  approval: { dot: "bg-violet-500", ring: "ring-violet-100", chip: "bg-violet-50 text-violet-600" },
  task: { dot: "bg-sky-500", ring: "ring-sky-100", chip: "bg-sky-50 text-sky-600" },
  complaint: { dot: "bg-rose-500", ring: "ring-rose-100", chip: "bg-rose-50 text-rose-600" },
  recovery: { dot: "bg-emerald-500", ring: "ring-emerald-100", chip: "bg-emerald-50 text-emerald-600" },
  system: { dot: "bg-slate-400", ring: "ring-slate-100", chip: "bg-slate-100 text-slate-500" },
};

export default function TimelineView({ trace, lang }: { trace: RecoveryTrace | null; lang: Lang }) {
  const t = ui[lang];
  const [filter, setFilter] = useState<TimelineFilter>("All");
  const events = filterTimeline(filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TIMELINE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
          >
            {t.timeline.filters[f]}
          </button>
        ))}
      </div>

      <div className="card p-6">
        <ol className="relative ml-1 border-l-2 border-slate-100">
          {events.map((e, i) => {
            const c = CAT[e.category] ?? CAT.system;
            return (
              <li
                key={i}
                className="mb-6 ml-6 last:mb-0 animate-fadeup"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <span
                  className={`absolute -left-[9px] mt-1 grid h-4 w-4 place-items-center rounded-full ${c.dot} ring-4 ring-white`}
                >
                  <span className={`h-4 w-4 rounded-full ${c.dot} opacity-40`} style={{ animation: "pulseglow 2.6s ease-in-out infinite" }} />
                </span>
                <div className="group flex flex-col gap-1 rounded-xl px-3 py-2 transition-colors hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <time className="font-mono text-[11px] text-slate-400">{e.at}</time>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${c.chip}`}>
                      {e.category}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{e.label}</p>
                  {e.detail && <p className="text-xs text-slate-500">{e.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {trace && (
        <div className="card animate-fadeup border-rose-200 p-6">
          <h3 className="mb-4 text-sm font-semibold text-rose-700">{t.timeline.broke}</h3>
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
                  <p className="mt-2 pl-1 text-[11px] text-rose-700">{m.root_cause}</p>
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
    if (i === 0) return "bg-rose-100 text-rose-700";
    if (label === "Failure" || label === "失败") return "bg-rose-600 text-white";
    if (label.startsWith("APR")) return "bg-violet-100 text-violet-700";
    if (label.startsWith("TASK")) return "bg-sky-100 text-sky-700";
    if (label.startsWith("P-")) return "bg-indigo-100 text-indigo-700";
    if (label.includes("Not") || label.includes("Wrong") || label.includes("未完成") || label.includes("错误")) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(n, i)}`}>{n}</span>
          {i < nodes.length - 1 && (
            <svg width="26" height="12" viewBox="0 0 26 12" className="text-slate-300">
              <path
                d="M0 6 H22"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
                style={{ animation: "dash 0.7s linear infinite" }}
              />
              <path d="M20 2 L25 6 L20 10" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

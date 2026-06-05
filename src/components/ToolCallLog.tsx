"use client";

import { useState } from "react";
import { ToolCall } from "@/lib/types";
import { describeCall, toolIcon, toolLabel } from "@/lib/humanize";

/**
 * Operator-facing audit trail. Reads as plain-language activity by default.
 * The raw engine call (the actual function + JSON I/O) is tucked behind an
 * opt-in "technical view" so the product never shows source-level identifiers
 * to a business user unless they ask for it.
 */
export default function ToolCallLog({
  calls,
  title = "Activity & Audit Trail",
  dense = false,
}: {
  calls: ToolCall[];
  title?: string;
  dense?: boolean;
}) {
  const [tech, setTech] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  if (!calls || calls.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs italic text-slate-400">
        No activity yet — run the promise audit or trace a complaint.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {!dense ? (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            {calls.length} steps
          </span>
        )}
        <button
          onClick={() => setTech((v) => !v)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            tech ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          {tech ? "Hide technical" : "Technical view"}
        </button>
      </div>

      <ol className="relative space-y-2 border-l border-slate-200 pl-4">
        {calls.map((c, i) => (
          <li key={i} className="relative animate-fadeup" style={{ animationDelay: `${i * 25}ms` }}>
            <span className="absolute -left-[21px] top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] shadow ring-1 ring-slate-200">
              {toolIcon(c.tool_name)}
            </span>
            <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-800">{toolLabel(c.tool_name)}</span>
                {tech && (
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="font-mono text-[9px] text-slate-400 hover:text-slate-700"
                  >
                    {c.tool_name}() {open === i ? "▾" : "▸"}
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{describeCall(c)}</p>

              {tech && open === i && (
                <div className="mt-2 rounded-lg bg-slate-900 p-2 font-mono text-[10px] text-slate-200">
                  <div className="text-slate-400">// {c.called_at}</div>
                  <div className="text-sky-300">input</div>
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(c.input, null, 2)}
                  </pre>
                  <div className="mt-1 text-emerald-300">output</div>
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(c.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

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
      <div className="rounded-xl border border-dashed border-white/12 px-3 py-6 text-center text-[13px] italic text-white/35">
        No activity yet — run the promise audit or trace a complaint.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        {!dense ? (
          <h3 className="t-label">{title}</h3>
        ) : (
          <span className="t-label">{calls.length} steps</span>
        )}
        <button
          onClick={() => setTech((v) => !v)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            tech ? "bg-white/90 text-slate-950" : "border border-white/12 bg-white/5 text-white/55 hover:bg-white/12"
          }`}
        >
          {tech ? "Hide technical" : "Technical view"}
        </button>
      </div>

      <ol className="relative space-y-2.5 border-l border-white/10 pl-4">
        {calls.map((c, i) => (
          <li key={i} className="relative animate-fadeup" style={{ animationDelay: `${i * 25}ms` }}>
            <span className="absolute -left-[21px] top-1.5 grid h-4 w-4 place-items-center rounded-full bg-white/10 text-[9px] ring-1 ring-white/15">
              {toolIcon(c.tool_name)}
            </span>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-white/85">{toolLabel(c.tool_name)}</span>
                {tech && (
                  <button
                    onClick={() => setOpen(open === i ? null : i)}
                    className="font-mono text-[10px] text-white/40 hover:text-white/80"
                  >
                    {c.tool_name}() {open === i ? "▾" : "▸"}
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-white/50">{describeCall(c)}</p>

              {tech && open === i && (
                <div className="mt-2 rounded-lg bg-black/50 p-2 font-mono text-[10px] text-slate-200 ring-1 ring-white/10">
                  <div className="text-white/40">// {c.called_at}</div>
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

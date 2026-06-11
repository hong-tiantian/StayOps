"use client";

import { PromiseDecision } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { DeptIcon } from "@/components/ui/icons";
import { deptLabel, effectiveStatus, humanizeOpsText } from "@/lib/humanize";
import { Lang, ui } from "@/lib/i18n";

/* Manager-facing ledger: title + current state (evidence & risk in plain
   language) + owning team + approval. Technical columns (promise type,
   execution state, AI proposal) live in the Judge view. */

export default function PromiseLedger({
  decisions,
  approved,
  onSelect,
  onApprove,
  highlightIds = [],
  lang,
}: {
  decisions: PromiseDecision[];
  approved: Set<string>;
  onSelect: (d: PromiseDecision) => void;
  onApprove: (promise_id: string) => void;
  highlightIds?: string[];
  lang: Lang;
}) {
  const t = ui[lang];
  const zh = lang === "zh";
  if (decisions.length === 0) {
    return (
      <div className="grid h-48 place-items-center rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] text-sm text-white/40">
        {t.ledger.empty}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="t-title">{zh ? "承诺台账" : "Promise Ledger"}</h1>
        <p className="t-caption mt-0.5">{zh ? "每条对客承诺的现状、风险与交接结果" : "Current state, risk and handoff for every guest-facing promise"}</p>
      </div>
      <div className="overflow-x-auto glass p-0">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-white/[0.08]">
            <tr>
              {[
                t.ledger.promise,
                t.ledger.status,
                zh ? "现状与风险" : "Current state & risk",
                t.ledger.owner,
                t.ledger.approval,
                t.ledger.linkedTask,
              ].map((h) => (
                <th key={h} className="t-label h-11 px-4 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {decisions.map((d) => {
              const isApproved = approved.has(d.promise_id);
              const highlight = highlightIds.includes(d.promise_id);
              return (
                <tr
                  key={d.promise_id}
                  onClick={() => onSelect(d)}
                  className={`cursor-pointer align-top transition-colors hover:bg-white/[0.05] ${
                    highlight ? "bg-rose-400/10" : ""
                  }`}
                >
                  <td className="max-w-[260px] px-4 py-3.5">
                    <div className="text-[13.5px] font-medium leading-5 text-white">{d.promise_text}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={effectiveStatus(d, approved)} lang={lang} />
                  </td>
                  <td className="max-w-[340px] px-4 py-3.5 text-[12.5px] leading-5 text-white/60">
                    {humanizeOpsText(d.evidence[0] ?? "", lang)}
                    {d.risk_reason && (
                      <span className="mt-1 block text-[11.5px] text-amber-100/60">
                        {zh ? "风险：" : "Risk: "}
                        {humanizeOpsText(d.risk_reason, lang)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12.5px] text-white/70">
                      <DeptIcon dept={d.owner_department} className="h-3.5 w-3.5 text-white/50" />
                      {deptLabel(d.owner_department, lang)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {d.approval_required ? (
                      isApproved ? (
                        <span className="rounded-full border border-violet-300/30 bg-violet-400/12 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
                          {t.ledger.approved}
                        </span>
                      ) : (
                        <button
                          onClick={() => onApprove(d.promise_id)}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-slate-950 transition active:scale-95"
                        >
                          {t.ledger.approve}
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] text-white/35">{t.ledger.auto}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {d.linked_task_id ? (
                      <span className="rounded-lg border border-blue-300/25 bg-blue-400/10 px-2 py-0.5 font-mono text-[11px] text-blue-200">
                        {d.linked_task_id}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/25">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

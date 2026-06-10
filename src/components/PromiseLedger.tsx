"use client";

import { PromiseDecision } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { Lang, ui } from "@/lib/i18n";

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
        <h1 className="t-title">{lang === "zh" ? "承诺账本" : "Promise Ledger"}</h1>
        <p className="t-caption mt-0.5">{lang === "zh" ? "每条承诺的提取、验证、安全门裁决与交接结果" : "Extraction, verification, safety-gate decision and handoff for every promise"}</p>
      </div>
      <div className="overflow-x-auto glass p-0">
        <table className="w-full min-w-[1100px]">
          <thead className="border-b border-white/[0.08]">
            <tr>
              {[
                t.ledger.promise,
                t.ledger.type,
                t.ledger.status,
                t.ledger.evidence,
                t.ledger.risk,
                t.ledger.owner,
                t.ledger.action,
                t.ledger.approval,
                t.ledger.execution,
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
                  <td className="px-4 py-3.5">
                    <div className="text-[13.5px] font-medium text-white">{d.promise_text}</div>
                    <div className="tnum mt-0.5 font-mono text-[11px] text-white/38">{d.promise_id}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {d.promise_type.map((pt) => (
                        <span
                          key={pt}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/65"
                        >
                          {pt.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={d.status} lang={lang} />
                    {d.agent_proposed_status && (
                      <div
                        className={`mt-1.5 text-[11px] ${
                          d.policy_overruled ? "font-semibold text-amber-300" : "text-white/40"
                        }`}
                        title={
                          lang === "zh"
                            ? "Gemini 提议的状态；最终状态由确定性安全门裁决"
                            : "Status proposed by Gemini; final status decided by the deterministic safety gate"
                        }
                      >
                        {d.policy_overruled
                          ? `⚖️ AI: ${d.agent_proposed_status} → ${lang === "zh" ? "安全门改判" : "overruled"}`
                          : `AI: ${d.agent_proposed_status} ✓`}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[240px] px-4 py-3.5 text-[12.5px] leading-5 text-white/60">
                    {d.evidence[0]}
                  </td>
                  <td className="max-w-[170px] px-4 py-3.5 text-[12.5px] leading-5 text-white/60">
                    {d.risk_reason}
                  </td>
                  <td className="px-4 py-3.5 text-[12.5px] text-white/70">{d.owner_department.replace(/_/g, " ")}</td>
                  <td className="max-w-[210px] px-4 py-3.5 text-[12.5px] leading-5 text-white/70">
                    {d.recommended_action}
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
                  <td className="px-4 py-3.5 text-[12.5px] text-white/60">{d.execution_state.replace(/_/g, " ")}</td>
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

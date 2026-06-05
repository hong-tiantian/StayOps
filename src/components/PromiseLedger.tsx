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
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
        {t.ledger.empty}
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
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
              <th key={h} className="px-3 py-2.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {decisions.map((d) => {
            const isApproved = approved.has(d.promise_id);
            const highlight = highlightIds.includes(d.promise_id);
            return (
              <tr
                key={d.promise_id}
                onClick={() => onSelect(d)}
                className={`cursor-pointer align-top transition-colors hover:bg-indigo-50/50 ${
                  highlight ? "bg-rose-50/70" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <div className="font-medium text-gray-900">{d.promise_text}</div>
                  <div className="font-mono text-[10px] text-gray-400">{d.promise_id}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {d.promise_type.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={d.status} lang={lang} />
                </td>
                <td className="max-w-[220px] px-3 py-3 text-xs text-gray-500">
                  {d.evidence[0]}
                </td>
                <td className="max-w-[160px] px-3 py-3 text-xs text-gray-500">
                  {d.risk_reason}
                </td>
                <td className="px-3 py-3 text-xs text-gray-600">{d.owner_department}</td>
                <td className="max-w-[200px] px-3 py-3 text-xs text-gray-600">
                  {d.recommended_action}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  {d.approval_required ? (
                    isApproved ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
                        {t.ledger.approved}
                      </span>
                    ) : (
                      <button
                        onClick={() => onApprove(d.promise_id)}
                        className="rounded-md bg-purple-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-purple-700"
                      >
                        {t.ledger.approve}
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-gray-400">{t.ledger.auto}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-500">{d.execution_state}</td>
                <td className="px-3 py-3">
                  {d.linked_task_id ? (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-800">
                      {d.linked_task_id}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { PromiseDecision, RecoveryTrace } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import ToolCallLog from "./ToolCallLog";
import { failurePointLabel, failureTypeLabel } from "@/lib/humanize";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h4>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

export default function PromiseDetailDrawer({
  decision,
  approved,
  freshnessByPromise,
  trace,
  onApprove,
  onClose,
}: {
  decision: PromiseDecision | null;
  approved: Set<string>;
  freshnessByPromise: Record<string, { source_name: string; freshness_status: string }[]>;
  trace: RecoveryTrace | null;
  onApprove: (promise_id: string) => void;
  onClose: () => void;
}) {
  if (!decision) return null;
  const isApproved = approved.has(decision.promise_id);
  const fresh = freshnessByPromise[decision.promise_id] ?? [];
  const matched = trace?.matched_promises.find((m) => m.promise_id === decision.promise_id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative z-50 h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3">
          <div>
            <div className="font-mono text-[10px] text-gray-400">{decision.promise_id}</div>
            <h3 className="text-base font-semibold text-gray-900">{decision.promise_text}</h3>
            <div className="mt-1">
              <StatusBadge status={decision.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <Section title="Source quote">
            <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600">
              “{decision.source_quote}”
              <span className="ml-1 not-italic text-[11px] text-gray-400">
                ({decision.source_message_id})
              </span>
            </blockquote>
          </Section>

          <Section title="Promise type">
            <div className="flex flex-wrap gap-1">
              {decision.promise_type.map((t) => (
                <span
                  key={t}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Freshness status">
            <div className="flex flex-wrap gap-1.5">
              {fresh.map((f) => (
                <span
                  key={f.source_name}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    f.freshness_status === "fresh"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {f.source_name}: {f.freshness_status}
                </span>
              ))}
              {fresh.length === 0 && <span className="text-xs text-gray-400">—</span>}
            </div>
          </Section>

          <Section title="Evidence">
            <ul className="list-disc space-y-1 pl-4 text-sm text-gray-600">
              {decision.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Section>

          <Section title="Risk reason">{decision.risk_reason}</Section>

          <Section title="Recommended action">{decision.recommended_action}</Section>

          <Section title="Approval status">
            <div className="flex items-center gap-2">
              {decision.approval_required ? (
                isApproved ? (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    Approved by manager
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">Requires manager approval</span>
                    <button
                      onClick={() => onApprove(decision.promise_id)}
                      className="rounded-md bg-purple-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-purple-700"
                    >
                      Approve
                    </button>
                  </>
                )
              ) : (
                <span className="text-xs text-gray-500">No approval required</span>
              )}
            </div>
          </Section>

          <Section title="Execution state">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {decision.execution_state}
            </span>
            {decision.linked_task_id && (
              <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] text-blue-800">
                {decision.linked_task_id}
              </span>
            )}
          </Section>

          {matched && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                Complaint trace
              </h4>
              <div className="space-y-1 text-sm text-red-800">
                <div>
                  <span className="font-medium">What went wrong:</span>{" "}
                  {failureTypeLabel(matched.failure_type)}
                </div>
                <div>
                  <span className="font-medium">Where it broke:</span>{" "}
                  {failurePointLabel(matched.failure_point)}
                  <span className="ml-1 font-mono text-[9px] text-rose-300">
                    {matched.failure_point}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Root cause:</span> {matched.root_cause}
                </div>
              </div>
            </div>
          )}

          <Section title="Tool calls used">
            <ToolCallLog calls={decision.tool_calls} dense />
          </Section>
        </div>
      </aside>
    </div>
  );
}

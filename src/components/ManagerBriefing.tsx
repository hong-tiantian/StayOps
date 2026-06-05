import { DecoratedTask } from "./TaskBoard";
import { FreshnessResult, PromiseDecision, Reservation } from "@/lib/types";

function countByStatus(decisions: PromiseDecision[], status: string) {
  return decisions.filter((d) => d.status === status).length;
}

export default function ManagerBriefing({
  reservation,
  decisions,
  tasks,
  freshness,
  onRunAudit,
  onTrace,
  auditing,
  tracing,
}: {
  reservation: Reservation | null;
  decisions: PromiseDecision[];
  tasks: DecoratedTask[];
  freshness: FreshnessResult[];
  onRunAudit: () => void;
  onTrace: () => void;
  auditing: boolean;
  tracing: boolean;
}) {
  const warningTasks = tasks.filter((t) => t.warning).length;
  const freshnessText = freshness.every((s) => s.freshness_status === "fresh")
    ? "All sources fresh"
    : "Stale source detected";

  const metrics = [
    { label: "Promises", value: String(decisions.length || 6), note: "extracted from booking thread" },
    { label: "At risk", value: String(countByStatus(decisions, "at_risk")), note: "requires manager judgment" },
    { label: "Missing info", value: String(countByStatus(decisions, "missing_info")), note: "guest or company follow-up" },
    { label: "Task warnings", value: String(warningTasks), note: "deadline or completion risk" },
  ];

  return (
    <section className="command-hero overflow-hidden rounded-[28px] border border-white/70 px-5 py-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.7)] sm:px-7 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-[260px] flex-col justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-white/70 bg-white/55 px-3 py-1 text-[11px] font-medium text-slate-600 backdrop-blur">
              Manager command room · {freshnessText}
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.03] text-slate-950 sm:text-5xl">
              Audit every guest promise before it becomes a service failure.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              Acme Robotics arrives with a VIP room preference, meeting-room setup, dietary requests,
              transport, and billing needs. StayOps verifies what the hotel can safely promise,
              routes approved actions, and traces failures back to the exact task.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary px-4 py-2">
              {auditing ? "Auditing..." : "Run Promise Audit"}
            </button>
            <button
              onClick={onTrace}
              disabled={tracing}
              className="btn border border-slate-200/80 bg-white/75 px-4 py-2 text-slate-700 hover:bg-white"
            >
              {tracing ? "Tracing..." : "Trace Complaint"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/75 bg-white/68 p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase text-slate-400">Active stay</div>
              <div className="text-sm font-semibold text-slate-900">
                {reservation?.company_name ?? "Acme Robotics"}
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {reservation?.status ?? "confirmed"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl border border-slate-200/70 bg-white/80 p-3">
                <div className="text-[11px] text-slate-400">{m.label}</div>
                <div className="mt-1 text-3xl font-semibold text-slate-950">{m.value}</div>
                <div className="mt-1 min-h-[28px] text-[11px] leading-4 text-slate-500">{m.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-950 p-3 text-white">
            <div className="text-[11px] text-slate-400">Current failure chain</div>
            <div className="mt-1 text-sm font-medium">P-002 → TASK-103 open · P-004 → wrong due time</div>
            <p className="mt-2 text-[11px] leading-4 text-slate-300">
              The manager sees whether approval became execution, not just whether a request was acknowledged.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

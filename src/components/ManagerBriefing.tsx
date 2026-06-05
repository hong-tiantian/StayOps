import { DecoratedTask } from "./TaskBoard";
import { FreshnessResult, PromiseDecision, Reservation } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

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
  lang,
  reasoningSource,
}: {
  reservation: Reservation | null;
  decisions: PromiseDecision[];
  tasks: DecoratedTask[];
  freshness: FreshnessResult[];
  onRunAudit: () => void;
  onTrace: () => void;
  auditing: boolean;
  tracing: boolean;
  lang: Lang;
  reasoningSource: "gemini" | "rules" | null;
}) {
  const t = ui[lang];
  const warningTasks = tasks.filter((t) => t.warning).length;
  const freshnessText = freshness.every((s) => s.freshness_status === "fresh")
    ? t.briefing.allFresh
    : t.briefing.stale;

  const metrics = [
    { label: t.briefing.promises, value: String(decisions.length || 6), note: t.briefing.promisesNote },
    { label: t.briefing.atRisk, value: String(countByStatus(decisions, "at_risk")), note: t.briefing.atRiskNote },
    { label: t.briefing.missingInfo, value: String(countByStatus(decisions, "missing_info")), note: t.briefing.missingInfoNote },
    { label: t.briefing.warnings, value: String(warningTasks), note: t.briefing.warningsNote },
  ];

  return (
    <section className="command-hero overflow-hidden rounded-[28px] border border-white/70 px-5 py-5 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.7)] sm:px-7 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-h-[260px] flex-col justify-between">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-full border border-white/70 bg-white/55 px-3 py-1 text-[11px] font-medium text-slate-600 backdrop-blur">
                {t.briefing.room} · {freshnessText}
              </div>
              <div
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                  reasoningSource === "gemini"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-slate-300 bg-slate-100 text-slate-600"
                }`}
              >
                {reasoningSource === "gemini"
                  ? lang === "zh"
                    ? "⚡ Gemini 智能体推理"
                    : "⚡ Reasoning: Gemini agent"
                  : lang === "zh"
                    ? "🛡 确定性规则(降级)"
                    : "🛡 Deterministic policy (fallback)"}
              </div>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.03] text-slate-950 sm:text-5xl">
              {t.briefing.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{t.briefing.body}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary px-4 py-2">
              {auditing ? t.nav.auditing : t.nav.audit}
            </button>
            <button
              onClick={onTrace}
              disabled={tracing}
              className="btn border border-slate-200/80 bg-white/75 px-4 py-2 text-slate-700 hover:bg-white"
            >
              {tracing ? t.nav.tracing : t.nav.trace}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/75 bg-white/68 p-4 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase text-slate-400">{t.briefing.activeStay}</div>
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
            <div className="text-[11px] text-slate-400">{t.briefing.failureChain}</div>
            <div className="mt-1 text-sm font-medium">{t.briefing.failureChainValue}</div>
            <p className="mt-2 text-[11px] leading-4 text-slate-300">{t.briefing.failureChainNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

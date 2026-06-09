"use client";

import { AgentTraceStage } from "@/lib/types";
import { Lang } from "@/lib/i18n";

const STAGE_ORDER: AgentTraceStage["stage_id"][] = [
  "info_analysis",
  "verification_agent",
  "decision_rules",
  "task_planning",
  "evaluation_recovery",
  "arize_monitoring",
];

const LABELS: Record<Lang, Record<AgentTraceStage["stage_id"], string>> = {
  en: {
    info_analysis: "Info Analysis",
    verification_agent: "Verification Agent",
    decision_rules: "Safety Gate",
    task_planning: "Task Planning",
    evaluation_recovery: "Recovery",
    arize_monitoring: "Arize Audit",
  },
  zh: {
    info_analysis: "信息分析",
    verification_agent: "验证智能体",
    decision_rules: "安全闸门",
    task_planning: "任务规划",
    evaluation_recovery: "恢复追踪",
    arize_monitoring: "Arize 审计",
  },
};

const FALLBACK_SUMMARY: Record<Lang, Record<AgentTraceStage["stage_id"], string>> = {
  en: {
    info_analysis: "Waiting for audit intake.",
    verification_agent: "No evidence run yet.",
    decision_rules: "Policy has not adjudicated the booking.",
    task_planning: "No handoff plan yet.",
    evaluation_recovery: "Runs after a complaint is traced.",
    arize_monitoring: "Audit traces are observational.",
  },
  zh: {
    info_analysis: "等待审查输入。",
    verification_agent: "尚未运行证据验证。",
    decision_rules: "安全规则尚未裁决。",
    task_planning: "尚未生成交接计划。",
    evaluation_recovery: "投诉追踪后运行。",
    arize_monitoring: "审计轨迹仅用于观察。",
  },
};

const STATUS_TEXT: Record<Lang, Record<AgentTraceStage["status"], string>> = {
  en: {
    complete: "Complete",
    pending: "Pending",
    fallback: "Fallback",
    not_run: "Not run",
  },
  zh: {
    complete: "完成",
    pending: "待运行",
    fallback: "兜底",
    not_run: "未运行",
  },
};

function statusClasses(status: AgentTraceStage["status"]) {
  switch (status) {
    case "complete":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "fallback":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "pending":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "not_run":
      return "border-slate-200 bg-white text-slate-400";
  }
}

function dotClasses(status: AgentTraceStage["status"]) {
  switch (status) {
    case "complete":
      return "bg-emerald-500";
    case "fallback":
      return "bg-amber-500";
    case "pending":
      return "bg-slate-300";
    case "not_run":
      return "bg-slate-200";
  }
}

function normalize(stages: AgentTraceStage[], lang: Lang): AgentTraceStage[] {
  const byId = new Map(stages.map((stage) => [stage.stage_id, stage]));
  return STAGE_ORDER.map((stage_id) => {
    const stage = byId.get(stage_id);
    return (
      stage ?? {
        stage_id,
        label: LABELS[lang][stage_id],
        status: "not_run",
        summary: FALLBACK_SUMMARY[lang][stage_id],
      }
    );
  });
}

export default function AgentTeamFlow({
  stages,
  lang,
}: {
  stages: AgentTraceStage[];
  lang: Lang;
}) {
  const normalized = normalize(stages, lang);
  const completed = normalized.filter((stage) => stage.status === "complete" || stage.status === "fallback").length;

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {lang === "zh" ? "智能体团队流程" : "Agent Team Flow"}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {lang === "zh"
              ? "经理视角下的审查、裁决、交接与审计状态。"
              : "Manager-facing status across analysis, verification, handoff, and audit."}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {completed}/{normalized.length}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        {normalized.map((stage, index) => (
          <div
            key={stage.stage_id}
            className="relative min-h-[118px] rounded-xl border border-slate-200/80 bg-white/80 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClasses(stage.status)}`} />
                <div className="text-xs font-semibold leading-4 text-slate-900">
                  {LABELS[lang][stage.stage_id] ?? stage.label}
                </div>
              </div>
              <span className="font-mono text-[10px] text-slate-300">{index + 1}</span>
            </div>

            <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-500">{stage.summary}</p>

            <div className="absolute bottom-3 left-3">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClasses(stage.status)}`}>
                {STATUS_TEXT[lang][stage.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

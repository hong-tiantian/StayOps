"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PromiseDecision, RecoveryTrace } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { describeCall, failurePointLabel, failureTypeLabel, toolIcon, toolLabel } from "@/lib/humanize";
import { Lang, ui } from "@/lib/i18n";

const DETAIL = {
  en: {
    sourceQuote: "Source quote",
    promiseType: "Promise type",
    freshness: "Freshness status",
    evidence: "Evidence",
    risk: "Risk reason",
    action: "Recommended action",
    safetyGate: "Agent proposal vs safety gate",
    learned: "Learned from past cases",
    learnedHint: (n: number) => `This decision drew on ${n} similar past case${n > 1 ? "s" : ""} from case memory`,
    gateAgreed: "Policy confirmed the agent's proposal",
    gateOverruled: "Deterministic safety gate overrode the agent",
    gateRulesOnly: "Agent unavailable — status computed by deterministic rules only",
    approval: "Approval status",
    approvedBy: "Approved by manager",
    requires: "Requires manager approval",
    noApproval: "No approval required",
    execution: "Execution state",
    complaintTrace: "Complaint trace",
    wentWrong: "What went wrong",
    broke: "Where it broke",
    rootCause: "Root cause",
    tools: "Tool calls used",
  },
  zh: {
    sourceQuote: "来源原文",
    promiseType: "承诺类型",
    freshness: "数据新鲜度",
    evidence: "证据",
    risk: "风险原因",
    action: "建议动作",
    safetyGate: "Agent 提议 vs 安全门",
    learned: "从历史案例学习",
    learnedHint: (n: number) => `该决策参考了案例库中 ${n} 条相似历史案例`,
    gateAgreed: "策略确认了 Agent 的提议",
    gateOverruled: "确定性安全门改判了 Agent 的提议",
    gateRulesOnly: "Agent 不可用 — 状态完全由确定性规则计算",
    approval: "审批状态",
    approvedBy: "经理已批准",
    requires: "需要经理审批",
    noApproval: "无需审批",
    execution: "执行状态",
    complaintTrace: "投诉追踪",
    wentWrong: "出了什么问题",
    broke: "断在哪",
    rootCause: "根因",
    tools: "使用的工具调用",
  },
} as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="t-label mb-2">{title}</h4>
      <div className="text-[13.5px] leading-relaxed text-white/80">{children}</div>
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
  lang,
}: {
  decision: PromiseDecision | null;
  approved: Set<string>;
  freshnessByPromise: Record<string, { source_name: string; freshness_status: string }[]>;
  trace: RecoveryTrace | null;
  onApprove: (promise_id: string) => void;
  onClose: () => void;
  lang: Lang;
}) {
  const t = DETAIL[lang];
  const common = ui[lang];

  return (
    <AnimatePresence>
      {decision && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="glass-shell relative z-10 m-2 h-[calc(100%-16px)] w-full max-w-md overflow-y-auto rounded-[28px]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-white/8 bg-white/[0.04] px-5 py-4 backdrop-blur-2xl">
              <div className="min-w-0">
                <div className="font-mono text-[10px] text-white/40">{decision.promise_id}</div>
                <h3 className="mt-0.5 text-base font-semibold leading-snug text-white">{decision.promise_text}</h3>
                <div className="mt-2">
                  <StatusBadge status={decision.status} lang={lang} />
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-white/60 transition hover:bg-white/12 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <Section title={t.sourceQuote}>
                <blockquote className="rounded-2xl border-l-2 border-cyan-300/50 bg-white/[0.04] px-3 py-2 text-sm italic text-white/70">
                  “{decision.source_quote}”
                  <span className="ml-1 not-italic text-[10px] text-white/35">({decision.source_message_id})</span>
                </blockquote>
              </Section>

              <Section title={t.promiseType}>
                <div className="flex flex-wrap gap-1.5">
                  {decision.promise_type.map((pt) => (
                    <span key={pt} className="glass-inset rounded-lg px-2 py-0.5 text-[11px] text-white/70">
                      {pt.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </Section>

              <Section title={t.safetyGate}>
                {decision.agent_proposed_status ? (
                  <div
                    className={
                      decision.policy_overruled
                        ? "rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-100"
                        : "rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-xs text-emerald-100"
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono">AI: {decision.agent_proposed_status}</span>
                      <span>→</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-semibold">{decision.status}</span>
                    </div>
                    <p className="mt-1.5">{decision.policy_overruled ? `⚖️ ${t.gateOverruled}` : `✓ ${t.gateAgreed}`}</p>
                  </div>
                ) : (
                  <span className="text-xs text-white/40">{t.gateRulesOnly}</span>
                )}
              </Section>

              <Section title={t.freshness}>
                <div className="flex flex-wrap gap-1.5">
                  {(freshnessByPromise[decision.promise_id] ?? []).map((f) => (
                    <span
                      key={f.source_name}
                      className={
                        f.freshness_status === "fresh"
                          ? "rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200"
                          : "rounded-lg border border-rose-300/25 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-200"
                      }
                    >
                      {f.source_name}: {f.freshness_status}
                    </span>
                  ))}
                  {(freshnessByPromise[decision.promise_id] ?? []).length === 0 && (
                    <span className="text-xs text-white/35">—</span>
                  )}
                </div>
              </Section>

              <Section title={t.evidence}>
                <ul className="space-y-1.5">
                  {decision.evidence.map((e, i) => (
                    <li key={i} className="glass-inset rounded-lg px-3 py-1.5 text-[12px] leading-5 text-white/70">
                      {e}
                    </li>
                  ))}
                </ul>
              </Section>

              {decision.learning_provenance && decision.learning_provenance.length > 0 && (
                <Section title={t.learned}>
                  <p className="mb-2 text-[11px] text-white/45">{t.learnedHint(decision.learning_provenance.length)}</p>
                  <div className="space-y-1.5">
                    {decision.learning_provenance.map((c, i) => (
                      <div key={i} className="rounded-xl border border-violet-300/20 bg-violet-400/[0.07] px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[12px] font-medium leading-snug text-white/85">{c.scenario}</span>
                          <span className="tnum shrink-0 font-mono text-[10px] text-white/40">{(c.similarity * 100).toFixed(0)}%</span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-white/60">{c.lesson}</p>
                        <span className="mt-1.5 inline-block rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-white/45">
                          {c.source.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section title={t.risk}>
                <p className="text-[13px] leading-5 text-white/70">{decision.risk_reason}</p>
              </Section>

              <Section title={t.action}>
                <p className="text-[13px] leading-5 text-white/70">{decision.recommended_action}</p>
              </Section>

              <Section title={t.approval}>
                <div className="flex items-center gap-2">
                  {decision.approval_required ? (
                    approved.has(decision.promise_id) ? (
                      <span className="rounded-full border border-violet-300/30 bg-violet-400/12 px-2.5 py-0.5 text-xs font-medium text-violet-100">
                        {t.approvedBy}
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-white/50">{t.requires}</span>
                        <button
                          onClick={() => onApprove(decision.promise_id)}
                          className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 transition active:scale-95"
                        >
                          {common.ledger.approve}
                        </button>
                      </>
                    )
                  ) : (
                    <span className="text-xs text-white/50">{t.noApproval}</span>
                  )}
                </div>
              </Section>

              <Section title={t.execution}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-inset rounded-lg px-2 py-0.5 text-xs text-white/70">{decision.execution_state}</span>
                  {decision.linked_task_id && (
                    <span className="rounded-lg border border-blue-300/25 bg-blue-400/10 px-2 py-0.5 font-mono text-[10px] text-blue-200">
                      {decision.linked_task_id}
                    </span>
                  )}
                </div>
              </Section>

              {(() => {
                const matched = trace?.matched_promises.find((m) => m.promise_id === decision.promise_id);
                if (!matched) return null;
                return (
                  <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3">
                    <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                      {t.complaintTrace}
                    </h4>
                    <div className="space-y-1 text-[13px] text-rose-100">
                      <div>
                        <span className="font-semibold">{t.wentWrong}:</span> {failureTypeLabel(matched.failure_type)}
                      </div>
                      <div>
                        <span className="font-semibold">{t.broke}:</span> {failurePointLabel(matched.failure_point)}
                      </div>
                      <div>
                        <span className="font-semibold">{t.rootCause}:</span> {matched.root_cause}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <Section title={t.tools}>
                <div className="space-y-1.5">
                  {decision.tool_calls.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/8 text-sm">
                        {toolIcon(c.tool_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-white/85">{toolLabel(c.tool_name)}</div>
                        <div className="text-[10px] leading-4 text-white/45">{describeCall(c)}</div>
                      </div>
                    </div>
                  ))}
                  {decision.tool_calls.length === 0 && <span className="text-xs text-white/35">—</span>}
                </div>
              </Section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

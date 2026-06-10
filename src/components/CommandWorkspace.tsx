"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import AgentFlowGraph from "@/components/AgentFlowGraph";
import SelfReview from "@/components/SelfReview";
import StatusBadge from "@/components/StatusBadge";
import WidgetGrid, { GLayouts, WidgetItem } from "@/components/widgets/WidgetGrid";
import WidgetCard from "@/components/widgets/WidgetCard";
import Modal from "@/components/ui/Modal";
import { DecoratedTask } from "@/components/TaskBoard";
import {
  Bar,
  Bars,
  CountUp,
  Donut,
  DonutSlice,
  LegendRow,
  TrendPill,
  cx,
  EASE,
} from "@/components/ui/visuals";
import {
  AgentTraceStage,
  FreshnessResult,
  InfoAnalysis,
  Message,
  PromiseDecision,
  RecoveryTrace,
  Reservation,
  TaskPlan,
  ToolCall,
} from "@/lib/types";
import { Lang } from "@/lib/i18n";
import { toolIcon, toolLabel, describeCall } from "@/lib/humanize";
import { laneCellStatuses, matchedFor, summarize } from "@/lib/laneProgress";

export type WorkspaceMode = "manager" | "trace";

const DEPT_ICON: Record<string, string> = {
  front_desk: "🛎",
  housekeeping: "🧹",
  fb: "🍽",
  events: "📽",
  sales: "💼",
  concierge: "🎩",
  manager: "🧭",
  maintenance: "🔧",
};

type Bucket = "verifiable" | "at_risk" | "missing_info" | "cannot_confirm";

function bucketOf(status: string): Bucket {
  if (status === "verifiable" || status === "completed" || status === "resolved") return "verifiable";
  if (status === "at_risk" || status === "needs_approval" || status === "approved") return "at_risk";
  if (status === "missing_info") return "missing_info";
  return "cannot_confirm";
}

const GRADIENTS = ["grad-mint", "grad-violet", "grad-cyan", "grad-amber"];

function compactTime(value?: string) {
  if (!value) return "—";
  const v = value.replace("T", " ").replace("Z", "");
  return v.length > 16 ? v.slice(5, 16) : v;
}

function mn(o: { i: string; x: number; y: number; w: number; h: number }) {
  return { ...o, minW: 2, minH: 3 };
}

export default function CommandWorkspace({
  mode,
  onMode,
  lang,
  reservation,
  decisions,
  selected,
  onSelect,
  approved,
  onApprove,
  tasks,
  taskPlan,
  infoAnalysis,
  freshness,
  demoNow,
  agentTrace,
  auditCalls,
  reasoningSource,
  trace,
  onRunAudit,
  onTrace,
  onToggleFreshness,
  auditing,
  tracing,
}: {
  mode: WorkspaceMode;
  onMode: (mode: WorkspaceMode) => void;
  lang: Lang;
  reservation: Reservation | null;
  messages: Message[];
  decisions: PromiseDecision[];
  selected: PromiseDecision | null;
  onSelect: (decision: PromiseDecision) => void;
  approved: Set<string>;
  onApprove: (promiseId: string) => void;
  tasks: DecoratedTask[];
  taskPlan: TaskPlan[];
  infoAnalysis: InfoAnalysis | null;
  freshness: FreshnessResult[];
  demoNow: string;
  agentTrace: AgentTraceStage[];
  auditCalls: ToolCall[];
  reasoningSource: "adk" | "gemini" | "rules" | null;
  trace: RecoveryTrace | null;
  onRunAudit: () => void;
  onTrace: () => void;
  onToggleFreshness: (source: string) => void;
  auditing: boolean;
  tracing: boolean;
}) {
  const zh = lang === "zh";
  const active = selected ?? decisions[0] ?? null;
  const [stackTop, setStackTop] = useState(0);
  const [editing, setEditing] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [drillPanel, setDrillPanel] = useState<"atrisk" | "missing" | "blocked" | "all" | null>(null);

  const total = decisions.length || 0;
  const safe = decisions.filter((d) => bucketOf(d.status) === "verifiable").length;
  const risk = decisions.filter((d) => bucketOf(d.status) === "at_risk").length;
  const missing = decisions.filter((d) => bucketOf(d.status) === "missing_info").length;
  const blocked = decisions.filter((d) => bucketOf(d.status) === "cannot_confirm").length;
  const overrides = decisions.filter((d) => d.policy_overruled).length;
  const staleSources = freshness.filter((f) => f.freshness_status === "stale");
  const healthPct = total ? Math.round((safe / total) * 100) : 0;

  // Per-lane workflow summary (shared logic with the full graph).
  const laneSummaries = useMemo(
    () =>
      decisions.map((d) => {
        const plan = taskPlan.find((p) => p.item_id === d.promise_id);
        const matched = matchedFor(trace, d.promise_id);
        const s = summarize(laneCellStatuses(d, plan, Boolean(matched), approved));
        return { d, ...s };
      }),
    [decisions, taskPlan, trace, approved]
  );
  const flowDone = laneSummaries.reduce((a, l) => a + l.done, 0);
  const flowAlerts = laneSummaries.reduce((a, l) => a + l.alerts, 0);
  const flowTotal = (decisions.length || 0) * 6;

  const donutData: DonutSlice[] = useMemo(() => {
    const counts: Record<Bucket, number> = { verifiable: safe, at_risk: risk, missing_info: missing, cannot_confirm: blocked };
    const meta: Record<Bucket, { label: string; rgb: string }> = {
      verifiable: { label: zh ? "可验证" : "Verifiable", rgb: "52,211,153" },
      at_risk: { label: zh ? "风险/审批" : "At risk", rgb: "251,191,36" },
      missing_info: { label: zh ? "缺信息" : "Missing", rgb: "34,211,238" },
      cannot_confirm: { label: zh ? "无法确认" : "Blocked", rgb: "251,113,133" },
    };
    return (Object.keys(counts) as Bucket[])
      .map((k) => ({ label: meta[k].label, value: counts[k], color: `rgb(${meta[k].rgb})` }))
      .filter((s) => s.value > 0);
  }, [safe, risk, missing, blocked, zh]);

  const deptBars: Bar[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of decisions) counts[d.owner_department] = (counts[d.owner_department] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([dept, value]) => ({ label: (DEPT_ICON[dept] ?? "•") + " " + dept.replace(/_/g, " ").slice(0, 6), value, hint: `${value}` }));
  }, [decisions]);

  const recent = useMemo(() => auditCalls.slice(-8).reverse(), [auditCalls]);
  const overruled = useMemo(() => decisions.filter((d) => d.policy_overruled), [decisions]);
  const stackCards = decisions.slice(0, 4);

  /* ---------------- overview chips ---------------- */
  const chips: Array<{ label: string; value: number; rgb: string; drill: "all" | "atrisk" | "missing" | "blocked" | null }> = [
    { label: zh ? "承诺" : "Promises", value: total, rgb: "226,232,240", drill: "all" },
    { label: zh ? "安全" : "Safe", value: safe, rgb: "52,211,153", drill: null },
    { label: zh ? "风险" : "Risk", value: risk, rgb: "251,191,36", drill: "atrisk" },
    { label: zh ? "缺信息" : "Missing", value: missing, rgb: "34,211,238", drill: "missing" },
    { label: zh ? "无法确认" : "Blocked", value: blocked, rgb: "251,113,133", drill: "blocked" },
    { label: zh ? "改判" : "Override", value: overrides, rgb: "167,139,250", drill: null },
  ];

  /* ---------------- widget bodies ---------------- */
  const healthWidget = (
    <WidgetCard title={zh ? "承诺健康度" : "Promise health"} accent="52,211,153" editing={editing} bodyClassName="p-3">
      <div className="grad-mint relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-slate-950">
        <div>
          <div className="flex items-end gap-2.5">
            <CountUp value={healthPct} suffix="%" className="t-display !text-slate-950" />
            <span className="mb-1.5"><TrendPill value={safe} suffix={zh ? " 可执行" : " safe"} /></span>
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-slate-900/70">
            {zh ? `${safe}/${total} 个承诺可安全执行` : `${safe} of ${total} promises safe to execute`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRunAudit} disabled={auditing} className="h-8 rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50">
            {auditing ? (zh ? "审查中…" : "Auditing…") : zh ? "运行承诺审查" : "Run audit"}
          </button>
          <button onClick={onTrace} disabled={tracing} className="h-8 rounded-lg bg-white/85 px-3.5 text-xs font-semibold text-slate-950 transition active:scale-95 disabled:opacity-50">
            {tracing ? (zh ? "追踪中…" : "Tracing…") : zh ? "追踪投诉" : "Trace"}
          </button>
        </div>
      </div>
    </WidgetCard>
  );

  const kpiWidget = (key: "atrisk" | "missing") => {
    const isRisk = key === "atrisk";
    const count = isRisk ? risk : missing;
    return (
      <WidgetCard
        title={isRisk ? (zh ? "高风险 / 待审批" : "At risk / approval") : zh ? "缺信息" : "Missing info"}
        accent={isRisk ? "251,191,36" : "34,211,238"}
        editing={editing}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <CountUp value={count} className="t-metric block" />
            <TrendPill value={isRisk ? risk : -missing} suffix="" />
          </div>
          <div className="t-caption mb-2">{isRisk ? (zh ? "需要经理判断" : "needs manager judgment") : zh ? "需客人/公司补充" : "guest / company follow-up"}</div>
          {count > 0 && (
            <button
              onClick={() => setDrillPanel(isRisk ? "atrisk" : "missing")}
              onMouseDown={(e) => editing && e.stopPropagation()}
              className="h-7 w-full rounded-lg border border-white/12 bg-white/[0.05] text-[11px] font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white"
            >
              {zh ? `查看全部 ${count} 条 →` : `View all ${count} →`}
            </button>
          )}
        </div>
      </WidgetCard>
    );
  };

  const splitWidget = (
    <WidgetCard title={zh ? "承诺状态分布" : "Promise split"} accent="52,211,153" editing={editing}>
      <div className="flex h-full items-center gap-4">
        <Donut
          data={donutData.length ? donutData : [{ label: "—", value: 1, color: "rgba(255,255,255,0.12)" }]}
          thickness={16}
          centerTop={<div className="t-caption">{zh ? "总数" : "Total"}</div>}
          centerBottom={<CountUp value={total} className="t-metric" />}
        />
        <div className="flex-1 space-y-1">
          {donutData.map((s) => (
            <LegendRow key={s.label} color={s.color} label={s.label} value={s.value} />
          ))}
          {overrides > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgb(167,139,250)" }} />
              {overrides} {zh ? "安全门改判" : "gate override(s)"}
            </div>
          )}
        </div>
      </div>
    </WidgetCard>
  );

  const workloadWidget = (
    <WidgetCard title={zh ? "部门承诺分布" : "Department workload"} accent="34,211,238" editing={editing}>
      {deptBars.length ? <Bars data={deptBars} highlightIndex={0} height={150} /> : <div className="grid h-full place-items-center text-xs text-white/40">{zh ? "暂无数据" : "No data"}</div>}
    </WidgetCard>
  );

  const workflowSummaryWidget = (
    <WidgetCard
      title={zh ? "Agent 工作流" : "Agent workflow"}
      icon="✦"
      accent="167,139,250"
      editing={editing}
      onExpand={() => setWorkflowOpen(true)}
      expandLabel={zh ? "展开详情" : "Open"}
    >
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-baseline gap-6">
          <div>
            <div className="t-label mb-0.5">{zh ? "阶段完成" : "Stages"}</div>
            <div className="t-metric">{flowDone}<span className="text-[15px] font-normal text-white/38">/{flowTotal}</span></div>
          </div>
          <div>
            <div className="t-label mb-0.5">{zh ? "告警" : "Alerts"}</div>
            <div className={cx("t-metric", flowAlerts ? "!text-rose-300" : "!text-white/55")}>{flowAlerts}</div>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto">
          {laneSummaries.map(({ d, pct, alerts }) => (
            <button
              key={d.promise_id}
              onClick={() => onSelect(d)}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left transition hover:bg-white/[0.05]"
            >
              <span className="tnum w-12 shrink-0 font-mono text-[10px] text-white/38">{d.promise_id}</span>
              <span className="line-clamp-1 flex-1 text-[12.5px] text-white/70">{d.promise_text}</span>
              <span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: alerts ? "rgb(251,113,133)" : "rgb(52,211,153)" }} />
              </span>
              {alerts > 0 && <span className="shrink-0 text-[11px] text-rose-300">⚠{alerts}</span>}
            </button>
          ))}
        </div>
      </div>
    </WidgetCard>
  );

  const cardsWidget = (
    <WidgetCard
      title={zh ? "承诺卡组" : "Promise cards"}
      accent="167,139,250"
      editing={editing}
      headerRight={<span className="text-[10px] text-white/40">{total}</span>}
    >
      <div className="flex h-full flex-col">
        <div className="relative flex-1" style={{ minHeight: 150 }}>
          {stackCards.map((d, i) => {
            const depth = (i - stackTop + stackCards.length) % stackCards.length;
            const grad = GRADIENTS[i % GRADIENTS.length];
            return (
              <motion.button
                key={d.promise_id}
                onClick={() => (depth === 0 ? onSelect(d) : setStackTop(i))}
                onMouseDown={(e) => editing && e.stopPropagation()}
                animate={{ y: depth * 14, scale: 1 - depth * 0.05, opacity: depth > 2 ? 0 : 1, zIndex: 10 - depth }}
                transition={{ duration: 0.4, ease: EASE }}
                className={cx(grad, "absolute inset-x-0 top-0 overflow-hidden rounded-[20px] p-4 text-left text-slate-950 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]")}
                style={{ height: 132 }}
              >
                <div className="relative flex items-start justify-between">
                  <span className="font-mono text-[10px] text-slate-900/70">{d.promise_id}</span>
                  <span className="rounded-full bg-slate-950/15 px-2 py-0.5 text-[9px] font-semibold text-slate-900">
                    {DEPT_ICON[d.owner_department] ?? "•"} {d.owner_department.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="relative mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{d.promise_text}</div>
                <div className="relative mt-3 flex items-center gap-2">
                  <StatusBadge status={d.status} lang={lang} size="xs" />
                  {d.policy_overruled && <span className="rounded-full bg-slate-950/15 px-2 py-0.5 text-[9px] font-semibold text-slate-900">{zh ? "改判" : "override"}</span>}
                </div>
              </motion.button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {stackCards.map((d, i) => (
            <button key={d.promise_id} onClick={() => setStackTop(i)} className={cx("h-1.5 rounded-full transition-all", i === stackTop ? "w-5 bg-white" : "w-1.5 bg-white/30")} />
          ))}
        </div>
      </div>
    </WidgetCard>
  );

  const tasksWidget = (
    <WidgetCard
      title={zh ? "任务与交接" : "Tasks & handoffs"}
      accent="163,230,53"
      editing={editing}
      headerRight={<span className="text-[10px] text-white/40">{taskPlan.filter((p) => p.action_type !== "none").length}</span>}
    >
      <div className="space-y-2">
        {decisions.map((d) => {
          const plan = taskPlan.find((p) => p.item_id === d.promise_id);
          const task = tasks.find((t) => t.source_promise_id === d.promise_id);
          const needsApproval = d.approval_required && !approved.has(d.promise_id);
          return (
            <div
              key={d.promise_id}
              onClick={() => onSelect(d)}
              className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 transition hover:bg-white/[0.05]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-sm">{DEPT_ICON[d.owner_department] ?? "•"}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">{(plan?.action_type ?? "monitor").replace(/_/g, " ")}</div>
                <div className="t-caption truncate">{task?.task_id ?? d.linked_task_id ?? d.promise_id} · {compactTime(plan?.due_at ?? task?.due_at)}</div>
              </div>
              {needsApproval ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(d.promise_id);
                  }}
                  className="h-7 shrink-0 rounded-lg bg-amber-400/90 px-3 text-[11px] font-semibold text-slate-950 transition hover:bg-amber-400"
                >
                  {zh ? "批准" : "Approve"}
                </button>
              ) : (
                <StatusBadge status={d.status} lang={lang} size="xs" />
              )}
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );

  const freshnessWidget = (
    <WidgetCard
      title={zh ? "数据新鲜度闸门" : "Data freshness gate"}
      accent={staleSources.length ? "251,113,133" : "52,211,153"}
      editing={editing}
      headerRight={
        <span className={cx("rounded-full px-2 py-0.5 text-[9px] font-semibold", staleSources.length ? "bg-rose-400/15 text-rose-200" : "bg-emerald-400/15 text-emerald-200")}>
          {staleSources.length ? `${staleSources.length} stale` : zh ? "全部新鲜" : "all fresh"}
        </span>
      }
    >
      <div className="space-y-0.5">
        {freshness.map((f) => {
          const stale = f.freshness_status === "stale";
          return (
            <button
              key={f.source_name}
              onClick={() => onToggleFreshness(f.source_name)}
              onMouseDown={(e) => editing && e.stopPropagation()}
              title={zh ? "点击切换新鲜/过期(演示)" : "Toggle fresh/stale (demo)"}
              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2.5 transition hover:bg-white/[0.05]"
            >
              <span className={cx("truncate font-mono text-[12px]", stale ? "text-rose-300" : "text-white/65")}>{f.source_name}</span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="tnum font-mono text-[11px] text-white/38">{f.age_minutes}/{f.max_allowed_age_minutes}m</span>
                <span className={cx("h-1.5 w-1.5 rounded-full", stale ? "bg-rose-400" : "bg-emerald-400")} />
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );

  /* ---------------- judge widgets ---------------- */
  const workflowFullWidget = (
    <WidgetCard
      title={zh ? "Agent 工作流（完整）" : "Agent workflow (full)"}
      icon="✦"
      accent="167,139,250"
      editing={editing}
      onExpand={() => setWorkflowOpen(true)}
      expandLabel={zh ? "全屏" : "Fullscreen"}
    >
      <AgentFlowGraph
        decisions={decisions}
        taskPlan={taskPlan}
        freshness={freshness}
        trace={trace}
        selectedId={active?.promise_id}
        onSelect={onSelect}
        reasoningSource={reasoningSource}
        approved={approved}
        lang={lang}
      />
    </WidgetCard>
  );

  const pipelineWidget = (
    <WidgetCard
      title={zh ? "Agent 团队管线" : "Agent team pipeline"}
      accent="34,211,238"
      editing={editing}
      headerRight={<span className="text-[10px] text-white/40">{agentTrace.filter((s) => s.status === "complete" || s.status === "fallback").length}/{agentTrace.length || 6}</span>}
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        {agentTrace.map((s, i) => (
          <div key={s.stage_id} className="glass-inset rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cx("h-1.5 w-1.5 rounded-full", s.status === "complete" ? "bg-emerald-400" : s.status === "fallback" ? "bg-amber-400" : s.status === "pending" ? "bg-white/30" : "bg-white/15")} />
                <span className="text-[12.5px] font-semibold text-white">{s.label}</span>
              </div>
              <span className="tnum font-mono text-[10px] text-white/30">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-4 text-white/50">{s.summary}</p>
          </div>
        ))}
        {agentTrace.length === 0 && <div className="col-span-full grid h-24 place-items-center text-xs text-white/38">{zh ? "运行审查后显示" : "Run an audit"}</div>}
      </div>
    </WidgetCard>
  );

  const overridesWidget = (
    <WidgetCard title={zh ? "安全门改判清单" : "Safety-gate overrides"} accent="167,139,250" editing={editing} headerRight={<span className="text-[10px] text-white/40">{overruled.length}</span>}>
      <div className="space-y-1.5">
        {overruled.map((d) => (
          <button
            key={d.promise_id}
            onClick={() => onSelect(d)}
            className="status-edge flex w-full items-center gap-3 rounded-xl bg-white/[0.03] py-2.5 pl-4 pr-3 text-left transition hover:bg-white/[0.06]"
            style={{ "--edge": "167 139 250" } as React.CSSProperties}
          >
            <span className="font-mono text-[10px] text-white/38">{d.promise_id}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-white/85">{d.promise_text}</div>
              <div className="tnum text-[11px] text-violet-200/90">{d.agent_proposed_status} → {d.status}</div>
            </div>
          </button>
        ))}
        {overruled.length === 0 && <div className="grid h-20 place-items-center text-xs text-white/38">{zh ? "本次无改判" : "No overrides"}</div>}
      </div>
    </WidgetCard>
  );

  const toolsWidget = (
    <WidgetCard title={zh ? "工具调用轨迹" : "Tool-call trail"} accent="96,165,250" editing={editing} headerRight={<span className="text-[10px] text-white/40">{auditCalls.length}</span>}>
      <div className="space-y-0.5">
        {recent.length === 0 && <div className="grid h-20 place-items-center text-xs text-white/38">{zh ? "运行审查后显示" : "Run an audit"}</div>}
        {recent.map((c, i) => (
          <div key={i} className="flex h-11 items-center gap-3 rounded-lg px-2 transition hover:bg-white/[0.04]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-sm">{toolIcon(c.tool_name)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white/90">{toolLabel(c.tool_name)}</div>
              <div className="t-caption truncate">{describeCall(c)}</div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );

  const selfReviewWidget = (
    <WidgetCard title={zh ? "Agent 自检与学习 (Arize)" : "Self-review & learning (Arize)"} accent="167,139,250" editing={editing}>
      <SelfReview lang={lang} refreshKey={approved.size + auditCalls.length} bare />
    </WidgetCard>
  );

  const infoWidget = infoAnalysis ? (
    <WidgetCard title={zh ? "信息分析" : "Info analysis"} accent="34,211,238" editing={editing}>
      <div className="space-y-1">
        <LegendRow color="rgb(34,211,238)" label={zh ? "范围" : "Scope"} value={infoAnalysis.intake_scope} />
        <LegendRow color="rgb(167,139,250)" label={zh ? "基础信息" : "Basic info"} value={infoAnalysis.basic_info_status} />
        <LegendRow color="rgb(52,211,153)" label={zh ? "额外项目" : "Extra items"} value={infoAnalysis.extra_items.length} />
      </div>
    </WidgetCard>
  ) : null;

  /* ---------------- layouts ---------------- */
  const managerItems: WidgetItem[] = [
    { id: "health", node: healthWidget },
    { id: "atrisk", node: kpiWidget("atrisk") },
    { id: "missing", node: kpiWidget("missing") },
    { id: "split", node: splitWidget },
    { id: "workload", node: workloadWidget },
    { id: "workflow", node: workflowSummaryWidget },
    { id: "cards", node: cardsWidget },
    { id: "tasks", node: tasksWidget },
    { id: "freshness", node: freshnessWidget },
  ];

  const managerLayouts: GLayouts = {
    lg: [
      mn({ i: "health", x: 0, y: 0, w: 5, h: 9 }),
      mn({ i: "atrisk", x: 5, y: 0, w: 3, h: 4 }),
      mn({ i: "missing", x: 5, y: 4, w: 3, h: 5 }),
      mn({ i: "split", x: 8, y: 0, w: 4, h: 9 }),
      mn({ i: "workload", x: 0, y: 9, w: 5, h: 8 }),
      mn({ i: "workflow", x: 5, y: 9, w: 7, h: 8 }),
      mn({ i: "cards", x: 0, y: 17, w: 4, h: 9 }),
      mn({ i: "tasks", x: 4, y: 17, w: 5, h: 9 }),
      mn({ i: "freshness", x: 9, y: 17, w: 3, h: 9 }),
    ],
    sm: [
      mn({ i: "health", x: 0, y: 0, w: 1, h: 8 }),
      mn({ i: "atrisk", x: 0, y: 8, w: 1, h: 4 }),
      mn({ i: "missing", x: 0, y: 12, w: 1, h: 4 }),
      mn({ i: "split", x: 0, y: 16, w: 1, h: 9 }),
      mn({ i: "workload", x: 0, y: 25, w: 1, h: 8 }),
      mn({ i: "workflow", x: 0, y: 33, w: 1, h: 10 }),
      mn({ i: "cards", x: 0, y: 43, w: 1, h: 9 }),
      mn({ i: "tasks", x: 0, y: 52, w: 1, h: 10 }),
      mn({ i: "freshness", x: 0, y: 62, w: 1, h: 9 }),
    ],
  };

  const judgeItems: WidgetItem[] = [
    { id: "workflow_full", node: workflowFullWidget },
    { id: "pipeline", node: pipelineWidget },
    { id: "overrides", node: overridesWidget },
    { id: "tools", node: toolsWidget },
    { id: "selfreview", node: selfReviewWidget },
    ...(infoWidget ? [{ id: "info", node: infoWidget }] : []),
  ];

  const judgeLayouts: GLayouts = {
    lg: [
      mn({ i: "workflow_full", x: 0, y: 0, w: 12, h: 14 }),
      mn({ i: "pipeline", x: 0, y: 14, w: 6, h: 8 }),
      mn({ i: "overrides", x: 6, y: 14, w: 6, h: 8 }),
      mn({ i: "tools", x: 0, y: 22, w: 4, h: 10 }),
      mn({ i: "selfreview", x: 4, y: 22, w: 5, h: 10 }),
      mn({ i: "info", x: 9, y: 22, w: 3, h: 10 }),
    ],
    sm: [
      mn({ i: "workflow_full", x: 0, y: 0, w: 1, h: 14 }),
      mn({ i: "pipeline", x: 0, y: 14, w: 1, h: 9 }),
      mn({ i: "overrides", x: 0, y: 23, w: 1, h: 8 }),
      mn({ i: "tools", x: 0, y: 31, w: 1, h: 10 }),
      mn({ i: "selfreview", x: 0, y: 41, w: 1, h: 12 }),
      mn({ i: "info", x: 0, y: 53, w: 1, h: 8 }),
    ],
  };

  const isManager = mode === "manager";

  /* ---------------- drill panel render ---------------- */
  const DRILL_ACCENT: Record<string, string> = {
    verifiable: "52,211,153", completed: "52,211,153", resolved: "52,211,153", task_created: "52,211,153",
    at_risk: "251,191,36", needs_approval: "251,191,36", approved: "167,139,250",
    missing_info: "34,211,238",
    cannot_confirm: "251,113,133", conflict: "251,113,133", failed: "251,113,133",
  };

  const drillDecisions = drillPanel === "atrisk"
    ? decisions.filter((d) => ["at_risk", "needs_approval", "approved"].includes(d.status))
    : drillPanel === "missing"
    ? decisions.filter((d) => d.status === "missing_info")
    : drillPanel === "blocked"
    ? decisions.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status))
    : decisions;

  const drillTitle =
    drillPanel === "atrisk" ? (zh ? `高风险 / 待审批 · ${drillDecisions.length}` : `At risk / Approval · ${drillDecisions.length}`)
    : drillPanel === "missing" ? (zh ? `缺信息 · ${drillDecisions.length}` : `Missing info · ${drillDecisions.length}`)
    : drillPanel === "blocked" ? (zh ? `无法确认 · ${drillDecisions.length}` : `Blocked · ${drillDecisions.length}`)
    : zh ? `全部承诺 · ${drillDecisions.length}` : `All promises · ${drillDecisions.length}`;

  const drillPanelNode = drillPanel && (
    <motion.div
      key="drill"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="space-y-3"
    >
      {/* Drill header */}
      <div className="glass-lite flex items-center gap-4 px-5 py-3.5">
        <button
          onClick={() => setDrillPanel(null)}
          className="flex h-8 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[12px] font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white"
        >
          ← {zh ? "返回" : "Back"}
        </button>
        <h2 className="t-title">{drillTitle}</h2>
        {drillPanel === "all" && (
          <div className="ml-auto flex gap-1">
            {(["all", "atrisk", "missing", "blocked"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setDrillPanel(key)}
                className={cx(
                  "h-7 rounded-lg px-3 text-[11px] font-medium transition",
                  drillPanel === key ? "bg-white/15 text-white" : "text-white/45 hover:text-white"
                )}
              >
                {key === "all" ? (zh ? "全部" : "All")
                  : key === "atrisk" ? (zh ? "风险" : "Risk")
                  : key === "missing" ? (zh ? "缺信息" : "Missing")
                  : zh ? "阻塞" : "Blocked"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Promise cards */}
      {drillDecisions.length === 0 ? (
        <div className="glass-lite grid h-40 place-items-center text-sm text-white/40">
          {zh ? "暂无此类承诺" : "No promises in this category"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {drillDecisions.map((d) => {
            const accentRgb = DRILL_ACCENT[d.status] ?? "148,163,184";
            const needsApprove = d.approval_required && !approved.has(d.promise_id);
            const extraItem = (infoAnalysis?.extra_items ?? []).find((e) => e.item_id === d.promise_id);
            return (
              <motion.div
                key={d.promise_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="status-edge glass rounded-[20px] px-5 py-4"
                style={{ "--edge": accentRgb.replace(/,/g, " ") } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: promise info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-white/35">{d.promise_id}</span>
                      <StatusBadge status={d.status} lang={lang} size="xs" />
                      {d.policy_overruled && (
                        <span className="rounded-full border border-violet-300/25 bg-violet-400/12 px-2 py-0.5 text-[9px] font-semibold text-violet-200">
                          {zh ? "安全门改判" : "gate override"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[14px] font-semibold leading-snug text-white">{d.promise_text}</p>
                    {d.evidence[0] && (
                      <p className="mt-1.5 text-[12px] leading-5 text-white/50">
                        <span className="mr-1 text-white/25">›</span>{d.evidence[0]}
                      </p>
                    )}
                    {d.risk_reason && (
                      <p className="mt-1 text-[11.5px] text-white/40">
                        {zh ? "风险：" : "Risk: "}{d.risk_reason}
                      </p>
                    )}
                    {extraItem?.missing_fields && extraItem.missing_fields.length > 0 && (
                      <p className="mt-1 text-[11.5px] text-cyan-200/70">
                        {zh ? "缺失字段：" : "Missing: "}{extraItem.missing_fields.join(", ")}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.promise_type.map((pt) => (
                        <span key={pt} className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                          {pt.replace(/_/g, " ")}
                        </span>
                      ))}
                      <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
                        {DEPT_ICON[d.owner_department] ?? "•"} {d.owner_department.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {needsApprove && (
                      <button
                        onClick={() => onApprove(d.promise_id)}
                        className="h-9 rounded-xl bg-amber-400/90 px-5 text-[12px] font-semibold text-slate-950 transition hover:bg-amber-400 active:scale-95"
                      >
                        {zh ? "批准" : "Approve"}
                      </button>
                    )}
                    {approved.has(d.promise_id) && (
                      <span className="rounded-full border border-violet-300/30 bg-violet-400/12 px-3 py-1.5 text-[11px] font-semibold text-violet-100">
                        {zh ? "✓ 已批准" : "✓ Approved"}
                      </span>
                    )}
                    {(d.status === "cannot_confirm" || d.status === "conflict") && (
                      <button
                        onClick={() => onSelect(d)}
                        className="h-9 rounded-xl border border-rose-300/30 bg-rose-400/12 px-5 text-[12px] font-semibold text-rose-100 transition hover:bg-rose-400/18 active:scale-95"
                      >
                        {zh ? "上报" : "Escalate"}
                      </button>
                    )}
                    {d.status === "missing_info" && (
                      <button
                        onClick={() => onSelect(d)}
                        className="h-9 rounded-xl border border-cyan-300/30 bg-cyan-400/12 px-5 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-400/18 active:scale-95"
                      >
                        {zh ? "发起跟进" : "Follow up"}
                      </button>
                    )}
                    <button
                      onClick={() => onSelect(d)}
                      className="h-8 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      {zh ? "查看详情 →" : "Details →"}
                    </button>
                  </div>
                </div>

                {/* Recommended action */}
                {d.recommended_action && (
                  <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 text-[12px] leading-5 text-white/55">
                    <span className="mr-1.5 font-semibold text-white/35">{zh ? "建议：" : "Action:"}</span>
                    {d.recommended_action}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      {/* ---------------- Toolbar ---------------- */}
      <div className="glass-lite flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <h1 className="t-title">{zh ? "经理指挥台" : "Manager Command Deck"}</h1>
          <p className="t-caption mt-0.5">
            {reservation ? `${reservation.company_name} · ${reservation.room_count} ${zh ? "间房" : "rooms"} · ${reservation.arrival_date}` : zh ? "加载中…" : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center rounded-xl border border-white/10 bg-white/[0.04] p-0.5 text-[11px] font-medium text-white/55">
            <button onClick={() => onMode("manager")} className={cx("h-7 rounded-[10px] px-3 transition", isManager ? "bg-white/90 text-slate-950" : "hover:text-white")}>{zh ? "经理视图" : "Manager"}</button>
            <button onClick={() => onMode("trace")} className={cx("h-7 rounded-[10px] px-3 transition", !isManager ? "bg-white/90 text-slate-950" : "hover:text-white")}>{zh ? "评委追踪" : "Judge"}</button>
          </div>
          <button
            onClick={() => setEditing((v) => !v)}
            className={cx("btn", editing ? "btn-primary" : "btn-glass")}
            title={zh ? "拖动表头换位、拖右下角改大小" : "Drag header to move, drag corner to resize"}
          >
            {editing ? (zh ? "完成布局" : "Done") : zh ? "自定义布局" : "Customize"}
          </button>
          {editing && (
            <button onClick={() => setResetNonce((n) => n + 1)} className="btn btn-glass">{zh ? "重置布局" : "Reset"}</button>
          )}
          <button onClick={onRunAudit} disabled={auditing} className="btn btn-primary disabled:opacity-50">{auditing ? (zh ? "审查中…" : "Auditing…") : zh ? "运行审查" : "Run audit"}</button>
          <button onClick={onTrace} disabled={tracing} className="btn btn-danger disabled:opacity-50">{tracing ? (zh ? "追踪中…" : "Tracing…") : zh ? "追踪投诉" : "Trace"}</button>
        </div>
      </div>

      {/* ---------------- Overview banner — one quiet line ---------------- */}
      <div className="glass-lite flex min-h-[52px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
        <p className="t-body !text-white/80">
          {zh
            ? <>本次审查 <b className="tnum font-semibold text-white">{total}</b> 个承诺{flowAlerts ? <>，<b className="tnum font-semibold text-rose-300">{flowAlerts}</b> 处工作流告警</> : null}</>
            : <>This audit covers <b className="tnum font-semibold text-white">{total}</b> promises{flowAlerts ? <>, <b className="tnum font-semibold text-rose-300">{flowAlerts}</b> workflow alerts</> : null}</>}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          {chips.map((c, i) => {
            const inner = (
              <>
                {i > 0 && <span className="-ml-2.5 mr-2.5 hidden h-3.5 w-px bg-white/10 sm:block" />}
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${c.rgb})` }} />
                <span className="t-label">{c.label}</span>
                <span className="tnum text-[15px] font-semibold leading-none text-white">{c.value}</span>
                {c.drill && c.value > 0 && <span className="text-[10px] text-white/30">↗</span>}
              </>
            );
            return c.drill && c.value > 0 ? (
              <button
                key={c.label}
                onClick={() => setDrillPanel(c.drill!)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/[0.07]"
              >
                {inner}
              </button>
            ) : (
              <div key={c.label} className="flex items-center gap-2 px-1.5 py-1">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- Drill panel or Widget grid ---------------- */}
      {drillPanel ? drillPanelNode : isManager ? (
        <WidgetGrid key="manager" storageKey="stayops:layout:manager" editing={editing} resetNonce={resetNonce} defaultLayouts={managerLayouts} items={managerItems} />
      ) : (
        <WidgetGrid key="judge" storageKey="stayops:layout:judge" editing={editing} resetNonce={resetNonce} defaultLayouts={judgeLayouts} items={judgeItems} />
      )}

      {/* ---------------- Workflow modal ---------------- */}
      <Modal
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        title={zh ? "Agent 工作流 — 实时进度" : "Agent Workflow — live progress"}
        subtitle={zh ? "每条泳道是一个承诺从接收到恢复的真实进度；绿色完成，红色告警，紫色安全门改判。" : "Each lane is one promise's real progress; green = done, red = alert, violet = gate override."}
      >
        <div className="h-[64vh]">
          <AgentFlowGraph
            decisions={decisions}
            taskPlan={taskPlan}
            freshness={freshness}
            trace={trace}
            selectedId={active?.promise_id}
            onSelect={onSelect}
            reasoningSource={reasoningSource}
            approved={approved}
            lang={lang}
          />
        </div>
      </Modal>
    </div>
  );
}

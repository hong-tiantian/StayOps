"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import WidgetGrid, { GLayouts, WidgetItem } from "@/components/widgets/WidgetGrid";
import WidgetCard from "@/components/widgets/WidgetCard";
import { DeptIcon } from "@/components/ui/icons";
import GmailIntakeMiniPanel from "@/components/GmailIntakeMiniPanel";
import { DecoratedTask } from "@/components/TaskBoard";
import {
  Bar,
  Bars,
  CountUp,
  Donut,
  DonutSlice,
  cx,
  EASE,
} from "@/components/ui/visuals";
import {
  FreshnessResult,
  InfoAnalysis,
  PromiseDecision,
  Reservation,
  TaskPlan,
} from "@/lib/types";
import { Lang } from "@/lib/i18n";
import { deptLabel, effectiveStatus, fieldLabel, humanizeOpsText } from "@/lib/humanize";

/* Manager workspace focused on the duty manager's active queue.
   Everything technical (agent pipeline, tool calls, eval, freshness toggles)
   lives in the Judge view. */

type Bucket = "verifiable" | "at_risk" | "missing_info" | "cannot_confirm";

function bucketOf(status: string): Bucket {
  if (status === "verifiable" || status === "completed" || status === "resolved") return "verifiable";
  if (status === "at_risk" || status === "needs_approval" || status === "approved") return "at_risk";
  if (status === "missing_info") return "missing_info";
  return "cannot_confirm";
}

function compactTime(value?: string) {
  if (!value) return "—";
  const v = value.replace("T", " ").replace("Z", "");
  return v.length > 16 ? v.slice(5, 16) : v;
}

function bookingLabel(b: BookingOption) {
  const date = b.arrival_date ? ` · ${b.arrival_date.slice(5)}` : "";
  return `${b.company_name}${date}`;
}

const NO_APPROVALS = new Set<string>();

const ACTION_LABELS: Record<string, { en: string; zh: string }> = {
  create_task: { en: "Create task", zh: "创建任务" },
  request_manager_approval: { en: "Needs manager approval", zh: "请求经理审批" },
  request_missing_info: { en: "Ask guest for details", zh: "追问缺失信息" },
  escalate: { en: "Escalate", zh: "上报处理" },
  monitor: { en: "Monitor", zh: "保持关注" },
  none: { en: "No action", zh: "无需动作" },
};

function actionLabel(code: string | undefined, lang: Lang) {
  const key = code ?? "monitor";
  return ACTION_LABELS[key]?.[lang === "zh" ? "zh" : "en"] ?? key.replace(/_/g, " ");
}

function mn(o: { i: string; x: number; y: number; w: number; h: number }) {
  return { ...o, minW: 2, minH: 3 };
}

type DrillKey =
  | "queue"
  | "atrisk"
  | "approval"
  | "missing"
  | "blocked"
  | "all"
  | "portfolio_all"
  | "portfolio_atrisk"
  | "portfolio_missing"
  | "portfolio_blocked";

interface BookingOption {
  booking_id: string;
  company_name: string;
  arrival_date?: string;
}

interface BookingOverview {
  booking_id: string;
  company_name: string;
  arrival_date: string;
  counts: { total: number; safe: number; risk: number; missing: number; blocked: number };
  pending_approval: number;
  urgency: number;
  urgent: boolean;
  watch: boolean;
  top_issue: { promise_text: string; status: string } | null;
  decisions?: PromiseDecision[];
}

export default function CommandWorkspace({
  lang,
  bookingId,
  bookings,
  onBooking,
  reservation,
  decisions,
  onSelect,
  approved,
  onApprove,
  tasks,
  taskPlan,
  infoAnalysis,
  freshness,
  onRunAudit,
  auditing,
  navResetNonce,
}: {
  lang: Lang;
  bookingId: string;
  bookings: BookingOption[];
  onBooking: (id: string) => void;
  reservation: Reservation | null;
  decisions: PromiseDecision[];
  onSelect: (decision: PromiseDecision) => void;
  approved: Set<string>;
  onApprove: (promiseId: string) => void;
  tasks: DecoratedTask[];
  taskPlan: TaskPlan[];
  infoAnalysis: InfoAnalysis | null;
  freshness: FreshnessResult[];
  onRunAudit: () => void;
  auditing: boolean;
  /** Incremented by the page on every nav click — re-clicking "Dashboard"
      collapses the drill panel back to the overview. */
  navResetNonce?: number;
}) {
  const zh = lang === "zh";
  const [editing, setEditing] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [drillPanel, setDrillPanel] = useState<DrillKey | null>(null);

  /* Donut legend → the actionable list for that status (with approve /
     follow-up buttons), not just a visual filter. */
  const BUCKET_DRILL: Record<Bucket, DrillKey> = {
    verifiable: "all",
    at_risk: "atrisk",
    missing_info: "missing",
    cannot_confirm: "blocked",
  };

  useEffect(() => {
    if (navResetNonce !== undefined) setDrillPanel(null);
  }, [navResetNonce]);

  /* Portfolio strip data — fast rules-only audit across ALL bookings,
     re-fetched whenever this booking's audit lands (cheap, ms-level). */
  const [portfolio, setPortfolio] = useState<BookingOverview[]>([]);
  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((j) => setPortfolio(j.bookings ?? []))
      .catch(() => setPortfolio([]));
  }, [decisions]);

  const total = decisions.length || 0;
  const safe = decisions.filter((d) => bucketOf(d.status) === "verifiable").length;
  const risk = decisions.filter((d) => bucketOf(d.status) === "at_risk").length;
  const missing = decisions.filter((d) => bucketOf(d.status) === "missing_info").length;
  const blocked = decisions.filter((d) => bucketOf(d.status) === "cannot_confirm").length;
  const staleSources = freshness.filter((f) => f.freshness_status === "stale");
  const portfolioDecisions = useMemo(
    () => portfolio.flatMap((b) => (b.decisions ?? []).map((d) => ({ ...d, booking_id: d.booking_id || b.booking_id }))),
    [portfolio]
  );
  const portfolioCounts = useMemo(
    () => ({
      total: portfolioDecisions.length,
      risk: portfolioDecisions.filter((d) => ["at_risk", "needs_approval"].includes(d.status)).length,
      missing: portfolioDecisions.filter((d) => d.status === "missing_info").length,
      blocked: portfolioDecisions.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status)).length,
    }),
    [portfolioDecisions]
  );
  const bookingNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of portfolio) map.set(b.booking_id, b.company_name);
    return map;
  }, [portfolio]);

  const isActionable = (d: PromiseDecision) =>
    ["at_risk", "needs_approval", "missing_info", "cannot_confirm", "conflict", "failed"].includes(d.status) &&
    !(d.approval_required && approved.has(d.promise_id));
  const queue = decisions.filter(isActionable);
  const pendingApproval = decisions.filter((d) => d.approval_required && !approved.has(d.promise_id)).length;
  const queueRisk = queue.filter((d) => ["at_risk", "needs_approval"].includes(d.status)).length;
  const queueMissing = queue.filter((d) => d.status === "missing_info").length;
  const queueBlocked = queue.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status)).length;

  const donutData: (DonutSlice & { key: Bucket })[] = useMemo(() => {
    const counts: Record<Bucket, number> = { verifiable: safe, at_risk: risk, missing_info: missing, cannot_confirm: blocked };
    const meta: Record<Bucket, { label: string; rgb: string }> = {
      verifiable: { label: zh ? "可验证" : "Verifiable", rgb: "126,200,169" },
      at_risk: { label: zh ? "风险/审批" : "At risk", rgb: "229,190,120" },
      missing_info: { label: zh ? "缺信息" : "Missing", rgb: "138,192,214" },
      cannot_confirm: { label: zh ? "无法确认" : "Blocked", rgb: "229,138,148" },
    };
    return (Object.keys(counts) as Bucket[])
      .map((k) => ({ key: k, label: meta[k].label, value: counts[k], color: `rgb(${meta[k].rgb})` }))
      .filter((s) => s.value > 0);
  }, [safe, risk, missing, blocked, zh]);

  const deptBars: Bar[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of decisions) counts[d.owner_department] = (counts[d.owner_department] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([dept, value]) => ({ label: deptLabel(dept, lang), value, hint: `${value}` }));
  }, [decisions, lang]);

  const overviewCards = decisions;

  /* ---------------- widgets ---------------- */

  /* Promise overview = the old "Promise split" + "Promise cards" merged:
     donut as the total view, cards as the quick-scan strip, legend filters both. */
  const overviewWidget = (
    <WidgetCard title={zh ? "承诺总览" : "Promise overview"} accent="126,200,169" editing={editing}>
      <div className="flex h-full flex-col gap-4 lg:flex-row">
        <div className="flex shrink-0 items-center gap-4">
          <Donut
            data={donutData.length ? donutData : [{ label: "—", value: 1, color: "rgba(255,255,255,0.12)" }]}
            size={132}
            thickness={10}
            centerTop={<div className="t-caption">{zh ? "总数" : "Total"}</div>}
            centerBottom={<CountUp value={total} className="t-metric" />}
          />
          <div className="space-y-0.5">
            <button
              onClick={() => setDrillPanel("all")}
              onMouseDown={(e) => editing && e.stopPropagation()}
              className="flex h-7 w-full items-center justify-between gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.1]"
            >
              <span className="text-[12.5px] text-white/80">{zh ? "全部" : "All"}</span>
              <span className="tnum text-[13px] font-semibold text-white/90">{total} →</span>
            </button>
            {donutData.map((s) => (
              <button
                key={s.key}
                onClick={() => setDrillPanel(BUCKET_DRILL[s.key])}
                onMouseDown={(e) => editing && e.stopPropagation()}
                className="flex h-7 w-full items-center justify-between gap-3 rounded-lg px-2 text-left transition hover:bg-white/[0.1]"
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-[12.5px] text-white/80">{s.label}</span>
                </span>
                <span className="tnum text-[13px] font-semibold text-white/90">{s.value} →</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-1">
          {overviewCards.map((d) => {
            const status = effectiveStatus(d, approved);
            return (
              <button
                key={d.promise_id}
                onClick={() => setDrillPanel(BUCKET_DRILL[bucketOf(status)])}
                onMouseDown={(e) => editing && e.stopPropagation()}
                className="glass-inset flex h-full w-[200px] shrink-0 flex-col justify-between rounded-2xl p-3.5 text-left transition hover:bg-white/[0.08]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/55">
                      <DeptIcon dept={d.owner_department} className="h-3 w-3" />
                      {deptLabel(d.owner_department, lang)}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-3 text-[12.5px] font-medium leading-5 text-white/90">{d.promise_text}</div>
                </div>
                <div className="mt-2.5">
                  <StatusBadge status={status} lang={lang} size="xs" />
                </div>
              </button>
            );
          })}
          {overviewCards.length === 0 && (
            <div className="grid h-full w-full place-items-center text-xs text-white/38">
              {zh ? "该状态下暂无承诺" : "No promises in this state"}
            </div>
          )}
        </div>
      </div>
    </WidgetCard>
  );

  const tasksWidget = (
    <WidgetCard
      title={zh ? "任务与交接" : "Tasks & handoffs"}
      accent="126,200,169"
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
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/70">
                <DeptIcon dept={d.owner_department} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">{actionLabel(plan?.action_type, lang)}</div>
                <div className="t-caption truncate">
                  {deptLabel(d.owner_department, lang)} · {compactTime(plan?.due_at ?? task?.due_at)}
                </div>
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
                <StatusBadge status={effectiveStatus(d, approved)} lang={lang} size="xs" />
              )}
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );

  const workloadWidget = (
    <WidgetCard title={zh ? "部门承诺分布" : "Department workload"} accent="138,192,214" editing={editing}>
      {deptBars.length ? (
        <div className="flex h-full flex-col justify-center">
          <Bars data={deptBars} highlightIndex={0} height={170} />
        </div>
      ) : (
        <div className="grid h-full place-items-center text-xs text-white/40">{zh ? "暂无数据" : "No data"}</div>
      )}
    </WidgetCard>
  );

  const managerItems: WidgetItem[] = [
    { id: "overview", node: overviewWidget },
    { id: "tasks", node: tasksWidget },
    { id: "workload", node: workloadWidget },
  ];

  const managerLayouts: GLayouts = {
    lg: [
      mn({ i: "overview", x: 0, y: 0, w: 12, h: 9 }),
      mn({ i: "tasks", x: 0, y: 9, w: 7, h: 10 }),
      mn({ i: "workload", x: 7, y: 9, w: 5, h: 10 }),
    ],
    sm: [
      mn({ i: "overview", x: 0, y: 0, w: 1, h: 12 }),
      mn({ i: "tasks", x: 0, y: 12, w: 1, h: 10 }),
      mn({ i: "workload", x: 0, y: 22, w: 1, h: 8 }),
    ],
  };

  /* ---------------- drill panel ---------------- */
  const DRILL_ACCENT: Record<string, string> = {
    verifiable: "126,200,169", completed: "126,200,169", resolved: "126,200,169", task_created: "126,200,169",
    at_risk: "229,190,120", needs_approval: "229,190,120", approved: "178,160,218",
    missing_info: "138,192,214",
    cannot_confirm: "229,138,148", conflict: "229,138,148", failed: "229,138,148",
  };

  const isPortfolioDrill = drillPanel?.startsWith("portfolio_") ?? false;
  const drillDecisions =
    drillPanel === "portfolio_all"
      ? portfolioDecisions
      : drillPanel === "portfolio_atrisk"
      ? portfolioDecisions.filter((d) => ["at_risk", "needs_approval"].includes(d.status))
      : drillPanel === "portfolio_missing"
      ? portfolioDecisions.filter((d) => d.status === "missing_info")
      : drillPanel === "portfolio_blocked"
      ? portfolioDecisions.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status))
      : drillPanel === "queue"
      ? queue
      : drillPanel === "atrisk"
      ? decisions.filter((d) => ["at_risk", "needs_approval", "approved"].includes(d.status))
      : drillPanel === "missing"
      ? decisions.filter((d) => d.status === "missing_info")
      : drillPanel === "blocked"
      ? decisions.filter((d) => ["cannot_confirm", "conflict", "failed"].includes(d.status))
      : drillPanel === "approval"
      ? decisions.filter((d) => d.approval_required && !approved.has(d.promise_id))
      : decisions;

  const drillTitle =
    drillPanel === "portfolio_all" ? (zh ? `全部预订承诺 · ${drillDecisions.length}` : `All booking promises · ${drillDecisions.length}`)
    : drillPanel === "portfolio_atrisk" ? (zh ? `全部预订 · 风险承诺 · ${drillDecisions.length}` : `All bookings · at risk · ${drillDecisions.length}`)
    : drillPanel === "portfolio_missing" ? (zh ? `全部预订 · 缺信息 · ${drillDecisions.length}` : `All bookings · missing info · ${drillDecisions.length}`)
    : drillPanel === "portfolio_blocked" ? (zh ? `全部预订 · 阻塞 · ${drillDecisions.length}` : `All bookings · blocked · ${drillDecisions.length}`)
    : drillPanel === "queue" ? (zh ? `待处理队列 · ${drillDecisions.length}` : `Pending queue · ${drillDecisions.length}`)
    : drillPanel === "atrisk" ? (zh ? `高风险 / 待审批 · ${drillDecisions.length}` : `At risk / Approval · ${drillDecisions.length}`)
    : drillPanel === "missing" ? (zh ? `缺信息 · ${drillDecisions.length}` : `Missing info · ${drillDecisions.length}`)
    : drillPanel === "blocked" ? (zh ? `无法确认 · ${drillDecisions.length}` : `Blocked · ${drillDecisions.length}`)
    : drillPanel === "approval" ? (zh ? `待审批队列 · ${drillDecisions.length}` : `Approval queue · ${drillDecisions.length}`)
    : zh ? `全部承诺 · ${drillDecisions.length}` : `All promises · ${drillDecisions.length}`;

  const drillFilters = isPortfolioDrill
    ? ([
        ["portfolio_all", zh ? "总数" : "Total"],
        ["portfolio_atrisk", zh ? "风险" : "At risk"],
        ["portfolio_missing", zh ? "缺信息" : "Missing"],
        ["portfolio_blocked", zh ? "阻塞" : "Blocked"],
      ] as const)
    : ([
        ["queue", zh ? "待处理" : "Queue"],
        ["atrisk", zh ? "风险" : "Risk"],
        ["approval", zh ? "待审批" : "Approval"],
        ["missing", zh ? "缺信息" : "Missing"],
        ["blocked", zh ? "阻塞" : "Blocked"],
        ["all", zh ? "全部" : "All"],
      ] as const);

  const drillPanelNode = drillPanel && (
    <motion.div
      key="drill"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="space-y-3"
    >
      <div className="glass-lite flex items-center gap-4 px-5 py-3.5">
        <button
          onClick={() => setDrillPanel(null)}
          className="flex h-8 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[12px] font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> {zh ? "返回" : "Back"}
        </button>
        <h2 className="t-title">{drillTitle}</h2>
        <div className="ml-auto flex gap-1">
          {drillFilters.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDrillPanel(key)}
              className={cx(
                "h-7 rounded-lg px-3 text-[11px] font-medium transition",
                drillPanel === key ? "bg-white/15 text-white" : "text-white/45 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {drillDecisions.length === 0 ? (
        <div className="glass-lite grid h-40 place-items-center text-sm text-white/40">
          {zh ? "暂无此类承诺" : "No promises in this category"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {drillDecisions.map((d) => {
            const accentRgb = DRILL_ACCENT[d.status] ?? "148,163,184";
            const sameBooking = d.booking_id === bookingId;
            const displayApproved = sameBooking ? approved : NO_APPROVALS;
            const needsApprove = sameBooking && d.approval_required && !approved.has(d.promise_id);
            const extraItem = (infoAnalysis?.extra_items ?? []).find((e) => e.item_id === d.promise_id);
            const sourceBookingName = bookingNameById.get(d.booking_id);
            return (
              <motion.div
                key={d.promise_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="status-edge glass rounded-[20px] px-5 py-4"
                style={{ "--edge": accentRgb.replace(/,/g, " ") } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Left: title + current state (risk merged with the workable path) + owning dept */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={effectiveStatus(d, displayApproved)} lang={lang} size="xs" />
                      {isPortfolioDrill && sourceBookingName && (
                        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
                          {sourceBookingName}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">
                        <DeptIcon dept={d.owner_department} className="h-3 w-3" />
                        {deptLabel(d.owner_department, lang)}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] font-semibold leading-snug text-white">{d.promise_text}</p>
                    {d.evidence[0] && (
                      <p className="mt-1.5 text-[12px] leading-5 text-white/55">
                        {humanizeOpsText(d.evidence[0], lang)}
                      </p>
                    )}
                    {d.risk_reason && (
                      <p className="mt-1 text-[11.5px] text-white/40">
                        {zh ? "风险：" : "Risk: "}{humanizeOpsText(d.risk_reason, lang)}
                      </p>
                    )}
                    {extraItem?.missing_fields && extraItem.missing_fields.length > 0 && (
                      <p className="mt-1 text-[11.5px] text-cyan-200/70">
                        {zh ? "待补：" : "Needs: "}
                        {extraItem.missing_fields.map((f) => fieldLabel(f, lang)).join(zh ? "、" : ", ")}
                      </p>
                    )}
                  </div>

                  {/* Right: the manager's next click — one verb per status */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {needsApprove && (
                      <button
                        onClick={() => onApprove(d.promise_id)}
                        className="h-9 rounded-xl bg-white/90 px-5 text-[12px] font-semibold text-slate-950 transition hover:bg-white active:scale-95"
                      >
                        {zh ? "批准" : "Approve"}
                      </button>
                    )}
                    {displayApproved.has(d.promise_id) && (
                      <span className="rounded-full border border-violet-300/30 bg-violet-400/12 px-3 py-1.5 text-[11px] font-semibold text-violet-100">
                        {zh ? "✓ 已批准" : "✓ Approved"}
                      </span>
                    )}
                    {(d.status === "cannot_confirm" || d.status === "conflict") && (
                      <button
                        onClick={() => {
                          if (d.booking_id !== bookingId) onBooking(d.booking_id);
                          onSelect(d);
                        }}
                        className="h-9 rounded-xl border border-rose-300/30 bg-rose-400/12 px-5 text-[12px] font-semibold text-rose-100 transition hover:bg-rose-400/18 active:scale-95"
                      >
                        {zh ? "上报" : "Escalate"}
                      </button>
                    )}
                    {d.status === "missing_info" && (
                      <button
                        onClick={() => {
                          if (d.booking_id !== bookingId) onBooking(d.booking_id);
                          onSelect(d);
                        }}
                        className="h-9 rounded-xl border border-cyan-300/30 bg-cyan-400/12 px-5 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-400/18 active:scale-95"
                      >
                        {zh ? "发起跟进" : "Follow up"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (d.booking_id !== bookingId) onBooking(d.booking_id);
                        onSelect(d);
                      }}
                      className="h-8 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.1] hover:text-white"
                    >
                      {zh ? "查看详情 →" : "Details →"}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  const basicInfoOk = infoAnalysis ? /complete|ok/i.test(infoAnalysis.basic_info_status) : null;

  return (
    <div className="space-y-4">
      {/* ---------------- Toolbar ---------------- */}
      <div className="glass-lite flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <h1 className="t-title">{zh ? "经理工作台" : "Manager Workspace"}</h1>
          <p className="t-caption mt-0.5 flex flex-wrap items-center gap-2">
            <span>
              {reservation ? `${reservation.company_name} · ${reservation.room_count} ${zh ? "间房" : "rooms"} · ${reservation.arrival_date}` : zh ? "加载中…" : "Loading…"}
            </span>
            {basicInfoOk !== null && (
              <span
                className={cx(
                  "rounded-full border px-2 py-0.5 text-[9px] font-semibold",
                  basicInfoOk ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-amber-300/25 bg-amber-400/10 text-amber-200"
                )}
              >
                {zh ? (basicInfoOk ? "基础信息完整" : "基础信息待补") : basicInfoOk ? "Basic info complete" : "Basic info incomplete"}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {/* ---------------- Section 1 · whole hotel, agent-prioritized ---------------- */}
      {!drillPanel && portfolio.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="t-label">{zh ? "全部预订 · 承诺总览" : "All bookings · promise overview"}</h2>
            <span className="t-caption">{zh ? "点击任一指标查看承诺列表" : "click a metric to open the promise list"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                key: "portfolio_all" as const,
                label: zh ? "承诺总数" : "Total promises",
                value: portfolioCounts.total,
                hint: zh ? `${portfolio.length} 个预订` : `${portfolio.length} bookings`,
                tone: "126,200,169",
              },
              {
                key: "portfolio_atrisk" as const,
                label: zh ? "At risk" : "At risk",
                value: portfolioCounts.risk,
                hint: zh ? "需要审批或先锁资源" : "approval or resource lock needed",
                tone: "244,196,110",
              },
              {
                key: "portfolio_missing" as const,
                label: zh ? "Missing info" : "Missing info",
                value: portfolioCounts.missing,
                hint: zh ? "先向客人补字段" : "guest details needed before action",
                tone: "126,200,236",
              },
              {
                key: "portfolio_blocked" as const,
                label: zh ? "Blocked" : "Blocked",
                value: portfolioCounts.blocked,
                hint: zh ? "现在不能承诺" : "cannot be promised yet",
                tone: "246,142,158",
              },
            ].map((card) => (
              <button
                key={card.key}
                onClick={() => setDrillPanel(card.key)}
                className="glass lift flex min-h-[132px] flex-col justify-between rounded-[20px] p-4 text-left transition hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="t-label">{card.label}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${card.tone})` }} />
                </div>
                <CountUp value={card.value} className="t-display block" />
                <div className="t-caption">{card.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
            <h2 className="t-label">{zh ? "已选预订" : "Selected booking"}</h2>
            <select
              value={bookingId}
              onChange={(e) => onBooking(e.target.value)}
              title={zh ? "切换预订" : "Switch booking"}
              className="select-glass"
            >
              {bookings.length === 0 ? (
                <option value={bookingId}>{reservation?.company_name ?? bookingId}</option>
              ) : (
                bookings.map((b) => (
                  <option key={b.booking_id} value={b.booking_id}>
                    {bookingLabel(b)}
                  </option>
                ))
              )}
            </select>
            <span className="t-caption">{bookingId}</span>
          </div>
        </div>
      )}

      {!drillPanel && <GmailIntakeMiniPanel lang={lang} />}

      {/* ---------------- Contextual freshness notice (replaces the old gate board) ---------------- */}
      {staleSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-amber-100/90">
            {zh
              ? `${staleSources.length} 个数据源已过期（${staleSources.map((s) => fieldLabel(s.source_name, lang)).join("、")}）— 审计结果已自动降级，处理前建议重新运行审查。`
              : `${staleSources.length} data source(s) out of date (${staleSources.map((s) => fieldLabel(s.source_name, lang)).join(", ")}) — audit results were automatically downgraded. Re-run the audit before acting.`}
          </p>
          <button onClick={onRunAudit} disabled={auditing} className="btn btn-glass shrink-0 disabled:opacity-50">
            {auditing ? (zh ? "审查中…" : "Auditing…") : zh ? "重新审查" : "Re-run audit"}
          </button>
        </div>
      )}

      {/* ---------------- Hero — ONE pending queue ---------------- */}
      {!drillPanel && (
        <button
          onClick={() => setDrillPanel("queue")}
          className={cx(
            "glass lift flex w-full flex-wrap items-center justify-between gap-5 rounded-[20px] p-6 text-left",
            queue.length > 0 ? "card-atrisk" : "card-safe"
          )}
        >
          <div className="flex items-center gap-5">
            <CountUp value={queue.length} className="t-hero block" />
            <div>
              <div className="t-label">{zh ? "待处理队列" : "Pending queue"}</div>
              <div className="t-caption mt-1">
                {queue.length > 0
                  ? zh ? "这些承诺现在需要你 — 点击逐条处理 →" : "These promises need you now — click to act →"
                  : zh ? "全部承诺都在安全轨道上" : "every promise is on a safe track"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingApproval > 0 && (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100">
                {zh ? `待审批 ${pendingApproval}` : `Approval ${pendingApproval}`}
              </span>
            )}
            {queueRisk > 0 && (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100">
                {zh ? `高风险 ${queueRisk}` : `At risk ${queueRisk}`}
              </span>
            )}
            {queueMissing > 0 && (
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                {zh ? `缺信息 ${queueMissing}` : `Missing ${queueMissing}`}
              </span>
            )}
            {queueBlocked > 0 && (
              <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1 text-[11px] font-medium text-rose-100">
                {zh ? `无法确认 ${queueBlocked}` : `Blocked ${queueBlocked}`}
              </span>
            )}
          </div>
        </button>
      )}

      {/* ---------------- Drill panel or widget grid ---------------- */}
      {drillPanel ? drillPanelNode : (
        <WidgetGrid key="manager" storageKey="stayops:layout:manager:v3" editing={editing} resetNonce={resetNonce} defaultLayouts={managerLayouts} items={managerItems} />
      )}
    </div>
  );
}

"use client";

import { Fragment, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FreshnessResult,
  PromiseDecision,
  RecoveryTrace,
  TaskPlan,
} from "@/lib/types";
import { Lang } from "@/lib/i18n";
import { cx, EASE } from "@/components/ui/visuals";
import { CellStatus, laneCellStatuses, laneHasStaleTool, matchedFor } from "@/lib/laneProgress";

type StageDef = { id: string; title: { en: string; zh: string } };

const STAGES: StageDef[] = [
  { id: "intake", title: { en: "Intake", zh: "接收" } },
  { id: "extract", title: { en: "Extract", zh: "提取" } },
  { id: "verify", title: { en: "Verify", zh: "验证" } },
  { id: "policy", title: { en: "Safety Gate", zh: "安全门" } },
  { id: "handoff", title: { en: "Handoff", zh: "交接" } },
  { id: "recovery", title: { en: "Recovery", zh: "恢复" } },
];

const STATUS_RGB: Record<CellStatus, string> = {
  complete: "126,200,169",
  active: "229,190,120",
  alert: "229,138,148",
  override: "178,160,218",
  pending: "148,163,184",
};

const STATUS_ICON: Record<CellStatus, string> = {
  complete: "✓",
  active: "●",
  alert: "⚠",
  override: "⚖",
  pending: "○",
};

type Cell = { status: CellStatus; title: string; sub: string };

function Node({
  status,
  title,
  sub,
  done,
}: Cell & { done: boolean }) {
  const rgb = STATUS_RGB[status];
  const pulse = status === "alert" ? "alert-pulse" : status === "override" ? "override-pulse" : "";
  const emphasized = status === "alert" || status === "override";
  return (
    <div
      className={cx(
        "status-edge relative w-[148px] shrink-0 overflow-hidden rounded-xl border p-2.5 pl-3.5 transition",
        pulse,
        done ? "bg-white/[0.045]" : "bg-white/[0.02]"
      )}
      style={{
        borderColor: emphasized ? `rgba(${rgb},0.4)` : "rgba(255,255,255,0.08)",
        ["--edge" as string]: rgb.replace(/,/g, " "),
      }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-4 text-white">{title}</div>
          <div className="t-caption mt-0.5 truncate !leading-4">{sub}</div>
        </div>
        <span
          className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
          style={{ color: `rgb(${rgb})`, height: 18, width: 18, background: `rgba(${rgb},0.12)` }}
        >
          {STATUS_ICON[status]}
        </span>
      </div>
    </div>
  );
}

function Connector({ done, alert }: { done: boolean; alert: boolean }) {
  const rgb = alert ? "229,138,148" : done ? "126,200,169" : "148,163,184";
  return (
    <div className="relative flex w-7 shrink-0 items-center justify-center self-center">
      <svg width="28" height="16" viewBox="0 0 28 16" className="overflow-visible">
        <line
          x1="0"
          y1="8"
          x2="22"
          y2="8"
          stroke={`rgb(${rgb})`}
          strokeWidth="1.5"
          className={done ? "" : "flow-dash"}
          opacity={alert ? 0.9 : done ? 0.6 : 0.3}
        />
        <path d="M21 4.5 L27 8 L21 11.5 Z" fill={`rgb(${rgb})`} opacity={alert ? 0.9 : done ? 0.7 : 0.4} />
      </svg>
    </div>
  );
}

export default function AgentFlowGraph({
  decisions,
  taskPlan,
  freshness,
  trace,
  selectedId,
  onSelect,
  reasoningSource,
  approved,
  lang,
}: {
  decisions: PromiseDecision[];
  taskPlan: TaskPlan[];
  freshness: FreshnessResult[];
  trace: RecoveryTrace | null;
  selectedId?: string;
  onSelect: (d: PromiseDecision) => void;
  reasoningSource: "adk" | "gemini" | "rules" | null;
  approved?: Set<string>;
  lang: Lang;
}) {
  const zh = lang === "zh";

  const sourceLabel =
    reasoningSource === "adk"
      ? "ADK / Agent Builder"
      : reasoningSource === "gemini"
        ? "Gemini agent"
        : zh
          ? "规则兜底"
          : "Rules fallback";

  const lanes = useMemo(
    () =>
      decisions.map((d) => {
        const plan = taskPlan.find((p) => p.item_id === d.promise_id);
        const matched = matchedFor(trace, d.promise_id);
        const statuses = laneCellStatuses(d, plan, Boolean(matched), approved);
        const stale = laneHasStaleTool(d);
        const tools = d.tool_calls?.length ?? 0;
        const subs = [
          { title: d.source_message_id ?? (zh ? "来源" : "Source"), sub: zh ? "邮件 / 预订" : "Email / booking" },
          { title: (d.promise_type?.[0] ?? "promise").replace(/_/g, " "), sub: zh ? "已提取" : "extracted" },
          { title: `${tools} ${zh ? "次工具" : "tools"}`, sub: stale ? (zh ? "数据过期" : "stale source") : zh ? "数据新鲜" : "data fresh" },
          {
            title: d.status.replace(/_/g, " "),
            sub: d.policy_overruled ? (zh ? "安全门改判" : "gate overruled") : statuses[3] === "alert" ? (zh ? "已阻断" : "blocked") : zh ? "策略确认" : "policy owned",
          },
          {
            title: (plan?.action_type ?? "none").replace(/_/g, " "),
            sub: statuses[4] === "active" ? (zh ? "待审批" : "awaiting approval") : d.linked_task_id ?? (zh ? "无任务" : "no task"),
          },
          {
            title: matched ? (zh ? "断裂承诺" : "broken") : zh ? "监控中" : "monitoring",
            sub: matched ? matched.failure_point : zh ? "无投诉" : "no complaint",
          },
        ];
        const cells: Cell[] = statuses.map((status, i) => ({ status, title: subs[i].title, sub: subs[i].sub }));
        const done = cells.filter((c) => c.status === "complete" || c.status === "override").length;
        const alerts = cells.filter((c) => c.status === "alert").length;
        return { decision: d, cells, done, alerts };
      }),
    [decisions, taskPlan, trace, approved, zh]
  );

  const totalDone = lanes.reduce((s, l) => s + l.done, 0);
  const totalAlerts = lanes.reduce((s, l) => s + l.alerts, 0);
  const totalStages = lanes.length * STAGES.length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3.5">
          {([
            ["126,200,169", zh ? "完成" : "done"],
            ["229,190,120", zh ? "进行" : "active"],
            ["229,138,148", zh ? "告警" : "alert"],
            ["178,160,218", zh ? "改判" : "override"],
          ] as const).map(([rgb, label]) => (
            <span key={label} className="t-caption inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${rgb})` }} />
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-baseline gap-4">
          <span className="tnum text-[13px] font-semibold text-white">
            {totalDone}<span className="font-normal text-white/38">/{totalStages} {zh ? "阶段" : "stages"}</span>
          </span>
          {totalAlerts > 0 && (
            <span className="tnum text-[13px] font-semibold text-rose-300">⚠ {totalAlerts}</span>
          )}
          <span className="t-caption">{sourceLabel}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-1">
        <div className="min-w-[1020px]">
          {/* Stage headers */}
          <div className="mb-3 flex items-stretch pl-[166px]">
            {STAGES.map((s, i) => (
              <Fragment key={s.id}>
                <div className="w-[148px] shrink-0 text-center">
                  <div className="t-label !normal-case !tracking-normal !text-white/80">{s.title[lang]}</div>
                  <div className="tnum font-mono text-[9px] text-white/30">{String(i + 1).padStart(2, "0")}</div>
                </div>
                {i < STAGES.length - 1 && <div className="w-7 shrink-0" />}
              </Fragment>
            ))}
          </div>

          {/* Lanes */}
          <div className="space-y-2.5">
            {lanes.map(({ decision: d, cells, done, alerts }, laneIndex) => {
              const active = selectedId === d.promise_id;
              const pct = Math.round((done / STAGES.length) * 100);
              return (
                <motion.div
                  key={d.promise_id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: laneIndex * 0.05 }}
                  onClick={() => onSelect(d)}
                  className={cx(
                    "flex cursor-pointer items-stretch rounded-2xl p-1 transition",
                    active ? "bg-white/[0.06] ring-1 ring-white/20" : "hover:bg-white/[0.03]"
                  )}
                >
                  {/* lane label + progress */}
                  <div className="flex w-[166px] shrink-0 flex-col justify-center pr-3">
                    <div className="flex items-center justify-between gap-1">
                      <span className="tnum font-mono text-[10px] text-white/38">{d.promise_id}</span>
                      <span className={cx("tnum text-[10px] font-semibold", alerts ? "text-rose-300" : "text-white/55")}>{pct}%</span>
                    </div>
                    <div className="line-clamp-1 text-[12px] font-medium leading-4 text-white/85">{d.promise_text}</div>
                    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: EASE }}
                        className="h-full rounded-full"
                        style={{ background: alerts ? "rgb(229,138,148)" : "rgb(126,200,169)" }}
                      />
                    </div>
                  </div>

                  {cells.map((cell, i) => {
                    const cellDone = cell.status === "complete" || cell.status === "override";
                    return (
                      <Fragment key={`${d.promise_id}-${i}`}>
                        <Node {...cell} done={cellDone} />
                        {i < cells.length - 1 && (
                          <Connector done={cellDone} alert={cell.status === "alert"} />
                        )}
                      </Fragment>
                    );
                  })}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

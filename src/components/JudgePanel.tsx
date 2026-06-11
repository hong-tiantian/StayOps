"use client";

import { useMemo, useState } from "react";
import AgentFlowGraph from "@/components/AgentFlowGraph";
import SelfReview from "@/components/SelfReview";
import WidgetGrid, { GLayouts, WidgetItem } from "@/components/widgets/WidgetGrid";
import WidgetCard from "@/components/widgets/WidgetCard";
import Modal from "@/components/ui/Modal";
import { ToolIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/visuals";
import {
  AgentTraceStage,
  FreshnessResult,
  PromiseDecision,
  RecoveryTrace,
  TaskPlan,
  ToolCall,
} from "@/lib/types";
import { Lang } from "@/lib/i18n";
import { toolLabel, describeCall } from "@/lib/humanize";

/* Judge view — how the AI arrived at its answer: full per-promise workflow,
   agent pipeline stages, safety-gate overrides and the raw tool-call trail.
   Everything with rule_key / trace / proposal vocabulary belongs here,
   NOT in the manager workspace. */

function mn(o: { i: string; x: number; y: number; w: number; h: number }) {
  return { ...o, minW: 2, minH: 3 };
}

export default function JudgePanel({
  lang,
  decisions,
  taskPlan,
  freshness,
  trace,
  selected,
  onSelect,
  reasoningSource,
  approved,
  agentTrace,
  auditCalls,
}: {
  lang: Lang;
  decisions: PromiseDecision[];
  taskPlan: TaskPlan[];
  freshness: FreshnessResult[];
  trace: RecoveryTrace | null;
  selected: PromiseDecision | null;
  onSelect: (d: PromiseDecision) => void;
  reasoningSource: "adk" | "gemini" | "rules" | null;
  approved: Set<string>;
  agentTrace: AgentTraceStage[];
  auditCalls: ToolCall[];
}) {
  const zh = lang === "zh";
  const [editing, setEditing] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [workflowOpen, setWorkflowOpen] = useState(false);

  const active = selected ?? decisions[0] ?? null;
  const recent = useMemo(() => auditCalls.slice(-10).reverse(), [auditCalls]);
  const overruled = useMemo(() => decisions.filter((d) => d.policy_overruled), [decisions]);
  const proposed = useMemo(() => decisions.filter((d) => d.agent_proposed_status), [decisions]);
  const completedStages = agentTrace.filter((s) => s.status === "complete" || s.status === "fallback").length;
  const sourceLabel =
    reasoningSource === "adk"
      ? "ADK / Agent Builder"
      : reasoningSource === "gemini"
        ? "Gemini ReAct"
        : reasoningSource === "rules"
          ? "Rules fallback"
          : "Not run";

  const workflowFullWidget = (
    <WidgetCard
      title={zh ? "Agent 工作流（全链路）" : "Agent workflow (full trace)"}
      accent="178,160,218"
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
      accent="138,192,214"
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
    <WidgetCard title={zh ? "安全门改判清单" : "Safety-gate overrides"} accent="178,160,218" editing={editing} headerRight={<span className="text-[10px] text-white/40">{overruled.length}</span>}>
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
    <WidgetCard title={zh ? "工具调用轨迹" : "Tool-call trail"} accent="138,192,214" editing={editing} headerRight={<span className="text-[10px] text-white/40">{auditCalls.length}</span>}>
      <div className="space-y-0.5">
        {recent.length === 0 && <div className="grid h-20 place-items-center text-xs text-white/38">{zh ? "运行审查后显示" : "Run an audit"}</div>}
        {recent.map((c, i) => (
          <div key={i} className="flex h-11 items-center gap-3 rounded-lg px-2 transition hover:bg-white/[0.04]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/70">
              <ToolIcon tool={c.tool_name} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white/90">{toolLabel(c.tool_name)}</div>
              <div className="t-caption truncate">{describeCall(c)}</div>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );

  const proofWidget = (
    <WidgetCard title={zh ? "提交要求证据" : "Submission proof"} accent="126,200,169" editing={editing}>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          {
            k: "Gemini / ADK",
            v: sourceLabel,
            ok: reasoningSource === "adk" || reasoningSource === "gemini",
          },
          {
            k: "Tool use",
            v: `${auditCalls.length} calls`,
            ok: auditCalls.length > 0,
          },
          {
            k: "Safety gate",
            v: `${decisions.length} adjudicated · ${overruled.length} override`,
            ok: decisions.length > 0,
          },
          {
            k: "Agent proposals",
            v: `${proposed.length}/${decisions.length || 0} visible`,
            ok: proposed.length > 0 || reasoningSource === "rules",
          },
        ].map((item) => (
          <div key={item.k} className="glass-inset rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-white/55">{item.k}</span>
              <span className={cx("h-1.5 w-1.5 rounded-full", item.ok ? "bg-emerald-400" : "bg-amber-400")} />
            </div>
            <div className="mt-1 truncate text-[13px] font-semibold text-white/90">{item.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11.5px] leading-5 text-white/55">
        {zh
          ? `${completedStages}/${agentTrace.length || 6} 个 agent-team stage 已有运行状态；最终承诺状态由 policy gate 裁决。`
          : `${completedStages}/${agentTrace.length || 6} agent-team stages have runtime status; final promise status is policy-gated.`}
      </div>
    </WidgetCard>
  );

  const scopeWidget = (
    <WidgetCard title={zh ? "Demo 范围诚实说明" : "Demo scope honesty"} accent="229,190,120" editing={editing}>
      <div className="space-y-2 text-[12px] leading-5 text-white/65">
        <div className="glass-inset rounded-xl p-3">
          <div className="font-semibold text-white/85">{zh ? "Golden case 固定" : "Golden case is fixed"}</div>
          <p className="mt-0.5 text-white/50">
            {zh
              ? "Acme 的 6 条 promises、TASK-102 错误 due time、TASK-103 open 是投诉追踪 demo 的不变量。"
              : "The Acme six promises, TASK-102 due-time bug, and TASK-103 open task are demo invariants for complaint tracing."}
          </p>
        </div>
        <div className="glass-inset rounded-xl p-3">
          <div className="font-semibold text-white/85">{zh ? "泛化路径已存在" : "Generalization path exists"}</div>
          <p className="mt-0.5 text-white/50">
            {zh
              ? "Manual/Gmail intake 走 /api/audit/from-intake，映射到隔离 INTAKE booking，不会污染 Acme 主流程。"
              : "Manual/Gmail intake uses /api/audit/from-intake and isolated INTAKE bookings, so it does not mutate the Acme flow."}
          </p>
        </div>
        <div className="glass-inset rounded-xl p-3">
          <div className="font-semibold text-white/85">{zh ? "仍需谨慎表述" : "Wording guardrail"}</div>
          <p className="mt-0.5 text-white/50">
            {zh
              ? "这是 multi-stage agent-team workflow，不是多个 autonomous agents 互相聊天。"
              : "This is a multi-stage agent-team workflow, not multiple autonomous agents chatting with each other."}
          </p>
        </div>
      </div>
    </WidgetCard>
  );

  const mcpWidget = (
    <WidgetCard title={zh ? "Partner MCP 运行证据" : "Partner MCP runtime"} accent="178,160,218" editing={editing}>
      <SelfReview lang={lang} refreshKey={auditCalls.length + decisions.length} bare />
    </WidgetCard>
  );

  const items: WidgetItem[] = [
    { id: "workflow_full", node: workflowFullWidget },
    { id: "proof", node: proofWidget },
    { id: "mcp", node: mcpWidget },
    { id: "pipeline", node: pipelineWidget },
    { id: "scope", node: scopeWidget },
    { id: "overrides", node: overridesWidget },
    { id: "tools", node: toolsWidget },
  ];

  const layouts: GLayouts = {
    lg: [
      mn({ i: "workflow_full", x: 0, y: 0, w: 12, h: 14 }),
      mn({ i: "proof", x: 0, y: 14, w: 5, h: 8 }),
      mn({ i: "mcp", x: 5, y: 14, w: 7, h: 8 }),
      mn({ i: "pipeline", x: 0, y: 22, w: 8, h: 8 }),
      mn({ i: "scope", x: 8, y: 22, w: 4, h: 8 }),
      mn({ i: "overrides", x: 0, y: 30, w: 4, h: 8 }),
      mn({ i: "tools", x: 4, y: 30, w: 8, h: 8 }),
    ],
    sm: [
      mn({ i: "workflow_full", x: 0, y: 0, w: 1, h: 14 }),
      mn({ i: "proof", x: 0, y: 14, w: 1, h: 9 }),
      mn({ i: "mcp", x: 0, y: 23, w: 1, h: 10 }),
      mn({ i: "pipeline", x: 0, y: 33, w: 1, h: 9 }),
      mn({ i: "scope", x: 0, y: 42, w: 1, h: 10 }),
      mn({ i: "overrides", x: 0, y: 52, w: 1, h: 8 }),
      mn({ i: "tools", x: 0, y: 60, w: 1, h: 10 }),
    ],
  };

  return (
    <div className="space-y-4">
      <div className="glass-lite flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div>
          <h1 className="t-title">{zh ? "Agent 工作流 — 全链路" : "Agent Workflow — full trace"}</h1>
          <p className="t-caption mt-0.5">
            {zh
              ? "每条泳道是一个承诺从接收到恢复的真实进度；绿色完成，红色告警，紫色安全门改判。"
              : "Each lane is one promise's real progress from intake to recovery; green = done, red = alert, violet = gate override."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setEditing((v) => !v)} className={cx("btn", editing ? "btn-primary" : "btn-glass")}>
            {editing ? (zh ? "完成布局" : "Done") : zh ? "自定义布局" : "Customize"}
          </button>
          {editing && <button onClick={() => setResetNonce((n) => n + 1)} className="btn btn-glass">{zh ? "重置布局" : "Reset"}</button>}
        </div>
      </div>

      <WidgetGrid key="judge" storageKey="stayops:layout:judge:v3" editing={editing} resetNonce={resetNonce} defaultLayouts={layouts} items={items} />

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

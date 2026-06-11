"use client";

import { useEffect, useState } from "react";
import { Bot, Brain, CheckCircle2, Lightbulb, Network, ReceiptText, ShieldCheck, Timer, Wrench } from "lucide-react";
import { Lang } from "@/lib/i18n";

interface LearnedPreference {
  promise_id: string;
  promise_text?: string;
  approvals: number;
  rejections: number;
  hint: string;
}

interface AuditTraceSummary {
  trace_id: string;
  started_at: string;
  duration_ms: number;
  span_count: number;
  llm_calls: number;
  tool_calls: number;
  tool_names: string[];
  injection_flags: string;
  phoenix_url?: string;
}

interface ImprovementSuggestion {
  title: string;
  detail: string;
  basis: string;
}

interface CostBasis {
  measured: {
    gemini_turns: number;
    tool_calls: number;
    trace_duration_ms: number;
    traced_spans: number;
  } | null;
  unavailable: string[];
  note: string;
}

interface Insights {
  ok: boolean;
  self_project?: { name: string; id: string } | null;
  all_projects?: string[];
  audit_trace?: AuditTraceSummary | null;
  improvement_suggestions?: ImprovementSuggestion[];
  cost_basis?: CostBasis;
  learning?: {
    total_decisions: number;
    learned_count: number;
    learned: LearnedPreference[];
  };
}

/**
 * Agent Self-Review — the visible self-improvement loop.
 * Pulls the agent's own observability project over the Arize Phoenix MCP server
 * and shows what the agent has learned from manager feedback.
 */
export default function SelfReview({ lang, refreshKey, bare = false }: { lang: Lang; refreshKey?: number; bare?: boolean }) {
  const [data, setData] = useState<Insights | null>(null);
  const zh = lang === "zh";

  useEffect(() => {
    let active = true;
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .catch(() => active && setData({ ok: false }));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const learned = data?.learning?.learned ?? [];
  const total = data?.learning?.total_decisions ?? 0;
  const suggestions = data?.improvement_suggestions ?? [];

  const Wrapper = bare
    ? ({ children }: { children: React.ReactNode }) => <div className="h-full">{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <div className="relative overflow-hidden glass p-5">{children}</div>
      );

  return (
    <Wrapper>
      {!bare && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {zh ? "Agent 自检与学习" : "Agent Self-Review & Learning"}
          </h2>
          <span className="rounded-full border border-violet-300/30 bg-violet-400/12 px-2.5 py-1 text-[10px] font-semibold text-violet-100">
            via Arize Phoenix MCP
          </span>
        </div>
      )}

      {/* Self-introspection over MCP */}
      <div className="glass-inset mb-3 rounded-2xl p-3 text-[12px]">
        {data?.ok ? (
          <span className="flex items-center gap-1.5 text-white/70">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={1.75} aria-hidden />
            {zh ? "正在 Phoenix 中监控自身 · 项目 " : "Monitoring itself in Phoenix · project "}
            <span className="font-semibold text-white">{data.self_project?.name ?? "stayops"}</span>
            {data.all_projects ? ` · ${data.all_projects.length} ${zh ? "个项目" : "projects"}` : ""}
          </span>
        ) : (
          <span className="text-white/40">
            {zh ? "Phoenix MCP 未连接(降级)" : "Phoenix MCP unavailable (degraded)"}
          </span>
        )}
      </div>

      {/* Latest audit run, reconstructed from the agent's own Phoenix spans over MCP */}
      {data?.ok && data.audit_trace && (
        <div className="mb-3 rounded-2xl border border-violet-300/25 bg-violet-400/8 p-3 text-[12px]">
          <div className="mb-1 font-semibold text-violet-100">
            {zh ? "最近一次审计的自审（来自自身 trace）" : "Latest audit, self-reviewed from its own trace"}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-white/65">
            <span className="flex items-center gap-1"><Network className="h-3 w-3" strokeWidth={1.75} aria-hidden /> {data.audit_trace.span_count} {zh ? "个 span" : "spans"}</span>
            <span className="flex items-center gap-1"><Bot className="h-3 w-3" strokeWidth={1.75} aria-hidden /> {data.audit_trace.llm_calls} {zh ? "次 Gemini 调用" : "Gemini turn(s)"}</span>
            <span className="flex items-center gap-1"><Wrench className="h-3 w-3" strokeWidth={1.75} aria-hidden /> {data.audit_trace.tool_calls} {zh ? "次工具调用" : "tool call(s)"}</span>
            <span className="flex items-center gap-1"><Timer className="h-3 w-3" strokeWidth={1.75} aria-hidden /> {(data.audit_trace.duration_ms / 1000).toFixed(1)}s</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.75} aria-hidden /> {zh ? "注入检测: " : "injection screen: "}
              {data.audit_trace.injection_flags === "none" ? (zh ? "干净" : "clean") : data.audit_trace.injection_flags}
            </span>
          </div>
          {data.audit_trace.tool_names.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.audit_trace.tool_names.map((n) => (
                <span key={n} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-100">
                  {n}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 font-mono text-[10px] text-white/35">
            trace {data.audit_trace.trace_id.slice(0, 16)}… · {data.audit_trace.started_at.slice(0, 19)}
          </div>
        </div>
      )}

      {data?.cost_basis && (
        <div className="mb-3 flex items-start gap-1.5 rounded-2xl border border-violet-300/20 bg-violet-400/8 p-3 text-[11px] text-white/58">
          <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-200" strokeWidth={1.75} aria-hidden />
          <div>
            <div className="font-semibold text-violet-100">{zh ? "成本依据" : "Cost basis"}</div>
            <div className="mt-0.5">
              {data.cost_basis.measured
                ? zh
                  ? `已记录 ${data.cost_basis.measured.gemini_turns} 次 Gemini 调用、${data.cost_basis.measured.tool_calls} 次工具调用、${(data.cost_basis.measured.trace_duration_ms / 1000).toFixed(1)}s trace；token / USD 需部署后接入 usage metadata。`
                  : `${data.cost_basis.measured.gemini_turns} Gemini turn(s), ${data.cost_basis.measured.tool_calls} tool call(s), ${(data.cost_basis.measured.trace_duration_ms / 1000).toFixed(1)}s trace measured; token / USD cost requires deployed usage metadata.`
                : zh
                  ? "MCP 通道可用于读取 Phoenix；当前还没有可展示的审计运行记录。token / USD 需部署后接入 Gemini usage metadata。"
                  : "The MCP channel can read Phoenix; no displayable audit-run evidence is available yet. Token / USD cost requires deployed Gemini usage metadata."}
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/8 p-3 text-[12px]">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-100">
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {zh ? "自审改进建议" : "Self-review improvement suggestions"}
          </div>
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.title} className="rounded-xl border border-white/8 bg-black/10 px-2.5 py-2">
                <div className="font-medium text-white/85">{suggestion.title}</div>
                <div className="mt-0.5 text-white/58">{suggestion.detail}</div>
                <div className="mt-1 text-[10px] uppercase text-emerald-200/65">
                  {zh ? "依据" : "basis"} · {suggestion.basis}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Learned preferences from manager feedback */}
      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
        <Brain className="h-3 w-3" strokeWidth={1.75} aria-hidden />
        {zh ? `已从 ${total} 次经理决策中学习` : `Learned from ${total} manager decision(s)`}
      </div>
      {learned.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/55">
          {zh
            ? "批准/驳回承诺后,这里会显示 Agent 学到的偏好。"
            : "Approve or reject promises and the agent's learned preferences appear here."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {learned.map((p) => (
            <li key={p.promise_id} className="glass-inset rounded-xl px-3 py-2 text-[12px]">
              <span className="font-medium text-white">{p.promise_id}</span>{" "}
              <span className="text-white/50">{p.promise_text ?? ""}</span>
              <div className="mt-0.5 text-[11px] text-violet-200">{p.hint}</div>
            </li>
          ))}
        </ul>
      )}
    </Wrapper>
  );
}

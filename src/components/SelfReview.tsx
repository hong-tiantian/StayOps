"use client";

import { useEffect, useState } from "react";
import SpotlightCard from "./SpotlightCard";
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

interface Insights {
  ok: boolean;
  self_project?: { name: string; id: string } | null;
  all_projects?: string[];
  audit_trace?: AuditTraceSummary | null;
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
export default function SelfReview({ lang, refreshKey }: { lang: Lang; refreshKey?: number }) {
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

  return (
    <SpotlightCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {zh ? "Agent 自检与学习" : "Agent Self-Review & Learning"}
        </h2>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
          via Arize Phoenix MCP
        </span>
      </div>

      {/* Self-introspection over MCP */}
      <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 text-[12px]">
        {data?.ok ? (
          <span className="text-slate-700">
            {zh ? "✅ 正在 Phoenix 中监控自身 · 项目 " : "✅ Monitoring itself in Phoenix · project "}
            <span className="font-semibold text-slate-900">{data.self_project?.name ?? "stayops"}</span>
            {data.all_projects ? ` · ${data.all_projects.length} ${zh ? "个项目" : "projects"}` : ""}
          </span>
        ) : (
          <span className="text-slate-400">
            {zh ? "Phoenix MCP 未连接(降级)" : "Phoenix MCP unavailable (degraded)"}
          </span>
        )}
      </div>

      {/* Latest audit run, reconstructed from the agent's own Phoenix spans over MCP */}
      {data?.ok && data.audit_trace && (
        <div className="mb-3 rounded-2xl border border-violet-200/70 bg-violet-50/50 p-3 text-[12px]">
          <div className="mb-1 font-semibold text-violet-900">
            {zh ? "最近一次审计的自审（来自自身 trace）" : "Latest audit, self-reviewed from its own trace"}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-700">
            <span>🧩 {data.audit_trace.span_count} {zh ? "个 span" : "spans"}</span>
            <span>🤖 {data.audit_trace.llm_calls} {zh ? "次 Gemini 调用" : "Gemini turn(s)"}</span>
            <span>🔧 {data.audit_trace.tool_calls} {zh ? "次工具调用" : "tool call(s)"}</span>
            <span>⏱ {(data.audit_trace.duration_ms / 1000).toFixed(1)}s</span>
            <span>
              🛡 {zh ? "注入检测: " : "injection screen: "}
              {data.audit_trace.injection_flags === "none" ? (zh ? "干净" : "clean") : data.audit_trace.injection_flags}
            </span>
          </div>
          {data.audit_trace.tool_names.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {data.audit_trace.tool_names.map((n) => (
                <span key={n} className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-violet-700">
                  {n}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 font-mono text-[10px] text-slate-400">
            trace {data.audit_trace.trace_id.slice(0, 16)}… · {data.audit_trace.started_at.slice(0, 19)}
          </div>
        </div>
      )}

      {/* Learned preferences from manager feedback */}
      <div className="text-[11px] text-slate-400">
        🧠 {zh ? `已从 ${total} 次经理决策中学习` : `Learned from ${total} manager decision(s)`}
      </div>
      {learned.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500">
          {zh
            ? "批准/驳回承诺后,这里会显示 Agent 学到的偏好。"
            : "Approve or reject promises and the agent's learned preferences appear here."}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {learned.map((p) => (
            <li key={p.promise_id} className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-[12px]">
              <span className="font-medium text-slate-900">{p.promise_id}</span>{" "}
              <span className="text-slate-500">{p.promise_text ?? ""}</span>
              <div className="mt-0.5 text-[11px] text-violet-700">{p.hint}</div>
            </li>
          ))}
        </ul>
      )}
    </SpotlightCard>
  );
}

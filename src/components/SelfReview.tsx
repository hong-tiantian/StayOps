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

interface Insights {
  ok: boolean;
  self_project?: { name: string; id: string } | null;
  all_projects?: string[];
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

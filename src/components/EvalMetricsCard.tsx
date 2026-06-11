"use client";

import { useCallback, useState } from "react";
import { Lang } from "@/lib/i18n";
import { cx } from "@/components/ui/visuals";

/* Judge-view eval metrics — POST /api/eval/[booking_id] (handoff contract §5).
   The call forces a fresh audit server-side (5-10s), so it runs on demand
   with an explicit loading state instead of on mount. */

type Ratio = { passed: number; total: number };

interface EvalResult {
  overall_passed: boolean;
  classification_accuracy: Ratio;
  approval_compliance: Ratio;
  unsafe_overpromise_count: number;
  missing_info_recall: Ratio;
  evidence_coverage: Ratio;
  tool_call_coverage: Ratio;
  complaint_trace: {
    expected_match_coverage: Ratio;
    missing_promise_ids: string[];
  };
  arize_trace_present: boolean;
  phoenix_trace_id: string | null;
  phoenix_trace_url: string | null;
  latency_ms: number;
  manual_lookup_sources_checked: number;
}

function ratioOk(r: Ratio) {
  return r.total === 0 || r.passed === r.total;
}

function MetricTile({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="glass-inset rounded-xl px-3 py-2.5">
      <div className="t-caption truncate">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          style={{
            background: ok ? "rgb(110 222 178)" : "rgb(246 142 158)",
            boxShadow: `0 0 8px ${ok ? "rgb(110 222 178)" : "rgb(246 142 158)"}`,
          }}
        />
        <span className="tnum text-[15px] font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}

export default function EvalMetricsCard({ bookingId, lang }: { bookingId: string; lang: Lang }) {
  const zh = lang === "zh";
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/eval/${bookingId}`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error ?? `HTTP ${r.status}`);
      }
      setResult((await r.json()) as EvalResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "eval_failed");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="t-caption max-w-[260px]">
          {zh
            ? "对当前预订强制重跑审查并对照黄金用例评分（约 5–10 秒）"
            : "Re-runs the audit against the golden case and scores it (~5–10s)"}
        </p>
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
        <button
          onClick={run}
          disabled={loading}
          className="btn btn-glass disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/90" />
              {zh ? "评测中…" : "Evaluating…"}
            </>
          ) : zh ? "运行评测" : "Run eval"}
        </button>
      </div>
    );
  }

  const traceOk =
    ratioOk(result.complaint_trace.expected_match_coverage) &&
    result.complaint_trace.missing_promise_ids.length === 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/25 px-2.5 py-0.5 text-[11px] font-medium",
            result.overall_passed ? "text-emerald-200" : "text-rose-200"
          )}
        >
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{
              background: result.overall_passed ? "rgb(110 222 178)" : "rgb(246 142 158)",
              boxShadow: `0 0 8px ${result.overall_passed ? "rgb(110 222 178)" : "rgb(246 142 158)"}`,
            }}
          />
          {result.overall_passed ? (zh ? "全部通过" : "All passed") : zh ? "存在失败项" : "Has failures"}
        </span>
        <button onClick={run} disabled={loading} className="text-[10px] text-white/40 transition hover:text-white/70 disabled:opacity-50">
          {loading ? (zh ? "评测中…" : "running…") : zh ? "重跑 ↺" : "Re-run ↺"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          label={zh ? "状态判定" : "Classification"}
          value={`${result.classification_accuracy.passed}/${result.classification_accuracy.total}`}
          ok={ratioOk(result.classification_accuracy)}
        />
        <MetricTile
          label={zh ? "危险过度承诺" : "Unsafe overpromise"}
          value={String(result.unsafe_overpromise_count)}
          ok={result.unsafe_overpromise_count === 0}
        />
        <MetricTile
          label={zh ? "投诉追溯" : "Complaint trace"}
          value={traceOk ? "✓" : `${result.complaint_trace.expected_match_coverage.passed}/${result.complaint_trace.expected_match_coverage.total}`}
          ok={traceOk}
        />
        <MetricTile
          label={zh ? "审批合规" : "Approval compliance"}
          value={`${result.approval_compliance.passed}/${result.approval_compliance.total}`}
          ok={ratioOk(result.approval_compliance)}
        />
        <MetricTile
          label={zh ? "证据覆盖" : "Evidence coverage"}
          value={`${result.evidence_coverage.passed}/${result.evidence_coverage.total}`}
          ok={ratioOk(result.evidence_coverage)}
        />
        <MetricTile
          label={zh ? "缺信息召回" : "Missing-info recall"}
          value={`${result.missing_info_recall.passed}/${result.missing_info_recall.total}`}
          ok={ratioOk(result.missing_info_recall)}
        />
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-white/45">
          <span>{zh ? "评测耗时" : "Eval latency"}</span>
          <span className="tnum font-mono">{(result.latency_ms / 1000).toFixed(1)}s · {result.manual_lookup_sources_checked} {zh ? "数据源" : "sources"}</span>
        </div>
        {result.arize_trace_present && result.phoenix_trace_id && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
            <span className="text-white/45">Phoenix trace</span>
            {result.phoenix_trace_url ? (
              <a
                href={result.phoenix_trace_url}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[10px] text-cyan-200/90 underline decoration-white/20 underline-offset-2 hover:text-cyan-100"
              >
                {result.phoenix_trace_id}
              </a>
            ) : (
              <span className="truncate font-mono text-[10px] text-white/60">{result.phoenix_trace_id}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

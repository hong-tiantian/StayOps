"use client";

import { useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { deptLabel } from "@/lib/humanize";
import { Lang } from "@/lib/i18n";

interface ThreadSummary {
  thread_id: string;
  subject?: string;
}

interface IntakeMessage {
  source: string;
  sender?: string;
  subject?: string;
  received_at?: string;
  body_text: string;
}

interface IntakeDecision {
  promise_id: string;
  promise_text: string;
  status: string;
  owner_department: string;
  approval_required: boolean;
}

interface IntakeResult {
  ok: true;
  mapped_booking_id: string;
  mapping_reason: string;
  intake_messages: IntakeMessage[];
  audit: {
    reasoning_source: string;
    decisions: IntakeDecision[];
  };
}

const DEMO_GMAIL_MESSAGE: IntakeMessage = {
  source: "gmail",
  sender: "sofia.rossi@example.com",
  subject: "[STAYOPS DEMO] Booking.com arrival request",
  received_at: "2026-07-17T08:15:00Z",
  body_text:
    "Hi team, I have a Booking.com reservation for July 19. I will arrive after 11pm, would prefer a high-floor quiet room, and I wanted to ask whether a free suite upgrade is possible. I also need parking but I do not know the plate number yet.",
};

async function auditMessages(messages: IntakeMessage[]): Promise<IntakeResult> {
  const response = await fetch("/api/audit/from-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error ?? `HTTP ${response.status}`);
  return json as IntakeResult;
}

export default function GmailIntakeMiniPanel({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function detectInboxItem() {
    setRunning(true);
    setError(null);
    try {
      const searchResponse = await fetch(`/api/intake/gmail/search?q=${encodeURIComponent("[STAYOPS DEMO]")}`);
      const search = (await searchResponse.json()) as
        | { ok: true; source: "gmail"; data: ThreadSummary[] }
        | { ok: false; source: "gmail"; reason?: string };

      if (search.ok && search.data.length > 0) {
        const thread = search.data[0];
        const importResponse = await fetch("/api/intake/gmail/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: thread.thread_id }),
        });
        const imported = (await importResponse.json()) as { ok: boolean; data?: IntakeMessage[]; reason?: string };
        if (!imported.ok || !imported.data?.length) throw new Error(imported.reason ?? "gmail_import_failed");
        setResult(await auditMessages(imported.data));
        setSourceLabel(thread.subject ? `Gmail: ${thread.subject}` : "Gmail thread");
      } else {
        setResult(await auditMessages([DEMO_GMAIL_MESSAGE]));
        setSourceLabel(search.ok ? "Simulated Gmail demo email" : "Simulated Gmail fallback");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "gmail_intake_failed");
    } finally {
      setRunning(false);
    }
  }

  const decisions = result?.audit.decisions ?? [];

  return (
    <div className="glass rounded-[20px] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.06] text-white/75">
          <MailCheck className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="t-label">{zh ? "Gmail 自动接入" : "Gmail auto-intake"}</h3>
              <p className="t-caption mt-1">
                {zh ? "一键识别新邮件，生成隔离的 promise list" : "Detect one inbox item and turn it into an isolated promise list"}
              </p>
            </div>
            <button onClick={detectInboxItem} disabled={running} className="btn btn-glass shrink-0 disabled:opacity-50">
              {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> : null}
              {running ? (zh ? "识别中" : "Detecting") : zh ? "识别邮件" : "Detect inbox item"}
            </button>
          </div>

          {error && <p className="mt-3 text-[11.5px] text-rose-300">{error}</p>}

          {result ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 font-mono text-[10px] text-white/62">
                  {result.mapped_booking_id}
                </span>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                  {result.audit.reasoning_source}
                </span>
                {sourceLabel && <span className="truncate text-[10.5px] text-white/42">{sourceLabel}</span>}
              </div>
              <div className="space-y-1.5">
                {decisions.slice(0, 4).map((decision, index) => (
                  <div key={`${decision.promise_id}-${index}`} className="glass-inset rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-white/88">{decision.promise_text}</div>
                        <div className="t-caption">
                          {deptLabel(decision.owner_department, lang)}
                          {decision.approval_required ? (zh ? " · 需审批" : " · approval needed") : ""}
                        </div>
                      </div>
                      <StatusBadge status={decision.status} lang={lang} size="xs" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] leading-4 text-white/38">
                {zh
                  ? "结果不会写入 Acme 固定 demo；它使用 intake booking 隔离上下文。"
                  : "Does not modify the fixed Acme demo; this uses an isolated intake booking context."}
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11.5px] leading-5 text-white/52">
              {zh
                ? "Demo 时点击一次即可展示：Gmail -> extraction -> policy gate -> promise list。"
                : "For the demo: one click shows Gmail -> extraction -> policy gate -> promise list."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

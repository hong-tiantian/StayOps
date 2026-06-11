"use client";

import { useCallback, useEffect, useState } from "react";
import { Lang } from "@/lib/i18n";
import { cx } from "@/components/ui/visuals";
import { deptLabel } from "@/lib/humanize";
import StatusBadge from "@/components/StatusBadge";
import ReplyDraftCard from "@/components/ReplyDraftCard";

/* Email intake — Gmail readonly search/import plus manual paste, both feeding
   POST /api/audit/from-intake (handoff contract §5). Unmapped emails are
   audited in an isolated INTAKE-xxx booking context and never touch the
   Acme demo flow. */

interface ThreadSummary {
  thread_id: string;
  subject?: string;
  sender?: string;
  received_at?: string;
  snippet?: string;
}

interface IntakeMessage {
  source: string;
  sender?: string;
  subject?: string;
  received_at?: string;
  body_text: string;
}

type GmailSearch =
  | { ok: true; source: "gmail"; data: ThreadSummary[] }
  | { ok: false; source: "gmail"; status: string; reason: string; required_env: string[] };

interface IntakeDecision {
  promise_id: string;
  promise_text: string;
  status: string;
  owner_department: string;
  approval_required: boolean;
  risk_reason?: string;
  recommended_action?: string;
  evidence?: string[];
}

interface IntakeGrounding {
  hotel_name: string;
  retrieval_method: string;
  sop_hits: Array<{ doc_title: string; score: number; chunk_text: string }>;
  case_hits: Array<{ scenario: string; lesson: string; score: number; source: string }>;
}

interface IntakeAudit {
  ok: true;
  mapped_booking_id: string;
  mapping_reason: string;
  intake_messages: IntakeMessage[];
  audit: {
    reasoning_source: string;
    decisions: IntakeDecision[];
    grounding?: IntakeGrounding;
    task_plan: unknown[];
  };
}

function compactDate(value?: string) {
  if (!value) return "";
  return value.replace("T", " ").slice(5, 16);
}

export default function GmailIntakePanel({
  lang,
  variant = "manual",
}: {
  lang: Lang;
  /** "manual" = manager-facing manual intake (phone / walk-in / pasted text).
      "gmail"  = judge-side test-email injection living in the Demo Console. */
  variant?: "manual" | "gmail";
}) {
  const zh = lang === "zh";
  const isGmail = variant === "gmail";
  const [query, setQuery] = useState("[STAYOPS DEMO]");
  const [search, setSearch] = useState<GmailSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [result, setResult] = useState<IntakeAudit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    setError(null);
    try {
      const r = await fetch(`/api/intake/gmail/search?q=${encodeURIComponent(q)}`);
      setSearch((await r.json()) as GmailSearch);
    } catch {
      setError(zh ? "Gmail 搜索请求失败" : "Gmail search request failed");
    } finally {
      setSearching(false);
    }
  }, [zh]);

  useEffect(() => {
    if (isGmail) runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGmail]);

  const auditMessages = useCallback(
    async (body: Record<string, unknown>) => {
      setAuditing(true);
      setError(null);
      try {
        const r = await fetch("/api/audit/from-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setResult(j as IntakeAudit);
      } catch (e) {
        setError(e instanceof Error ? e.message : "intake_audit_failed");
      } finally {
        setAuditing(false);
      }
    },
    []
  );

  const guestText = result?.intake_messages.map((m) => m.body_text).join("\n\n") ?? "";
  const firstMessage = result?.intake_messages[0];

  const importThread = useCallback(
    async (threadId: string) => {
      setImportingId(threadId);
      setError(null);
      try {
        const r = await fetch("/api/intake/gmail/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_id: threadId }),
        });
        const j = (await r.json()) as { ok: boolean; data?: IntakeMessage[]; reason?: string };
        if (!j.ok || !j.data?.length) throw new Error(j.reason ?? "gmail_import_failed");
        await auditMessages({ messages: j.data });
      } catch (e) {
        setError(e instanceof Error ? e.message : "gmail_import_failed");
      } finally {
        setImportingId(null);
      }
    },
    [auditMessages]
  );

  const gmailDegraded = search && !search.ok;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="t-title">
          {isGmail ? (zh ? "测试邮件注入" : "Test email injection") : zh ? "手动接入" : "Manual Intake"}
        </h1>
        <p className="t-caption mt-0.5">
          {isGmail
            ? zh
              ? "从 Gmail 只读导入预订邮件 — 在隔离上下文中审计，不影响 Acme 主流程"
              : "Readonly Gmail import for booking emails — audited in an isolated context, never touches the Acme demo flow"
            : zh
            ? "电话预订、walk-in、微信截图等机器读不到的渠道 — 前台把内容敲进来，立即生成预订、承诺清单与回复草稿"
            : "Phone bookings, walk-ins, chat screenshots — channels machines can't read. Type what the guest said and get a booking, promise list and reply draft instantly"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------- Left: Gmail search (judge) or manual entry (manager) -------- */}
        <div className="space-y-4">
          {isGmail && (
          <div className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="t-label">Gmail</h3>
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/25 px-2.5 py-0.5 text-[10px] font-medium",
                  gmailDegraded ? "text-amber-200" : "text-emerald-200"
                )}
              >
                <span
                  className="h-[5px] w-[5px] rounded-full"
                  style={{ background: gmailDegraded ? "rgb(244 196 110)" : "rgb(110 222 178)" }}
                />
                {gmailDegraded ? (zh ? "未连接" : "Not connected") : zh ? "只读已连接" : "Readonly connected"}
              </span>
            </div>

            {gmailDegraded ? (
              <div className="space-y-3">
                <p className="text-[12.5px] leading-relaxed text-white/60">{search.reason}</p>
                <div className="glass-inset rounded-xl p-3">
                  <div className="t-caption mb-1.5">{zh ? "所需环境变量" : "Required env"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {search.required_env.map((name) => (
                      <span key={name} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/55">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <a href="/api/auth/gmail/start" className="btn btn-glass inline-flex">
                  {zh ? "连接 Gmail（只读授权）→" : "Connect Gmail (readonly) →"}
                </a>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
                    placeholder={zh ? "Gmail 搜索语法，如 from:acme" : "Gmail query, e.g. from:acme"}
                    className="h-8 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/85 placeholder-white/30 outline-none focus:border-white/25"
                  />
                  <button onClick={() => runSearch(query)} disabled={searching} className="btn btn-glass shrink-0 disabled:opacity-50">
                    {searching ? (zh ? "搜索中…" : "Searching…") : zh ? "搜索" : "Search"}
                  </button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {search?.ok && search.data.length === 0 && (
                    <div className="grid h-16 place-items-center text-xs text-white/38">
                      {zh ? "没有匹配的线程" : "No matching threads"}
                    </div>
                  )}
                  {search?.ok &&
                    search.data.map((thread) => (
                      <div key={thread.thread_id} className="glass-inset flex items-center gap-3 rounded-xl p-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium text-white/90">{thread.subject || "(no subject)"}</div>
                          <div className="t-caption truncate">
                            {thread.sender} · {compactDate(thread.received_at)}
                          </div>
                          {thread.snippet && <div className="t-caption mt-0.5 line-clamp-1">{thread.snippet}</div>}
                        </div>
                        <button
                          onClick={() => importThread(thread.thread_id)}
                          disabled={importingId !== null || auditing}
                          className="btn btn-glass shrink-0 disabled:opacity-50"
                        >
                          {importingId === thread.thread_id ? (zh ? "导入中…" : "Importing…") : zh ? "导入并审计" : "Import & audit"}
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          )}

          {!isGmail && (
          <div className="glass p-5">
            <h3 className="t-label mb-1.5">{zh ? "录入客人需求" : "Type in the guest request"}</h3>
            <p className="t-caption mb-2.5">
              {zh
                ? "接电话边听边敲、或粘贴聊天/邮件原文 — 系统自动提取承诺并走同一套安全审计"
                : "Type while on the phone, or paste the raw chat / email — promises are extracted and run through the same safety audit"}
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              placeholder={zh ? "例如：Chen 女士来电，7 月 22 日两间大床房，需要无麸质早餐，希望高层安静……" : "e.g. Ms Chen called — two king rooms July 22, gluten-free breakfast, quiet high floor if possible…"}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-[13px] leading-relaxed text-white/85 placeholder-white/30 focus:border-white/25 focus:outline-none"
            />
            <button
              onClick={() => auditMessages({ body_text: pasteText, source: "manual_paste" })}
              disabled={auditing || !pasteText.trim()}
              className="btn btn-primary mt-2.5 disabled:opacity-50"
            >
              {auditing ? (zh ? "审计中…" : "Auditing…") : zh ? "生成预订与承诺清单" : "Create booking & promise list"}
            </button>
          </div>
          )}
        </div>

        {/* -------- Right: audit result + grounding + reply loop -------- */}
        <div className="space-y-4">
          <div className="glass p-5">
            <h3 className="t-label mb-3">{zh ? "接入审计结果" : "Intake audit result"}</h3>
            {!result && !auditing && (
              <div className="grid h-40 place-items-center text-center text-xs leading-relaxed text-white/38">
                {zh ? "导入线程或粘贴邮件后，承诺审计结果显示在这里" : "Import a thread or paste an email — the promise audit lands here"}
              </div>
            )}
            {auditing && (
              <div className="grid h-40 place-items-center">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/25 border-t-white/85" />
                  {zh ? "检索 SOP/案例 + 提案 + 安全门终审中…" : "Retrieving SOP/cases + proposing + safety gate adjudicating…"}
                </div>
              </div>
            )}
            {error && <p className="mb-3 text-[12px] text-rose-300">{error}</p>}
            {result && !auditing && (
              <div className="space-y-3">
                <div className="glass-inset rounded-xl p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/65">
                      {result.mapped_booking_id}
                    </span>
                    <span className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      {result.intake_messages[0]?.source === "gmail" ? "source: gmail" : "source: manual"}
                    </span>
                    <span className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/70">
                      {result.audit.reasoning_source}
                    </span>
                    {result.audit.grounding && (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                        {result.audit.grounding.hotel_name} · {result.audit.grounding.retrieval_method} RAG
                      </span>
                    )}
                  </div>
                  <p className="t-caption mt-2">{result.mapping_reason}</p>
                </div>

                <div className="space-y-1.5">
                  {result.audit.decisions.map((d) => (
                    <div key={d.promise_id} className="glass-inset rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] text-white/90">{d.promise_text}</div>
                          <div className="t-caption">
                            {deptLabel(d.owner_department, lang)}
                            {d.approval_required && (zh ? " · 需经理审批" : " · needs manager approval")}
                            {d.promise_id.startsWith("NOVEL") && (zh ? " · 规则库外" : " · outside rule library")}
                          </div>
                        </div>
                        <StatusBadge status={d.status} size="xs" lang={lang} />
                      </div>
                      {d.recommended_action && (
                        <p className="mt-1.5 border-l-2 border-white/15 pl-2 text-[11.5px] leading-relaxed text-white/60">
                          {d.recommended_action}
                        </p>
                      )}
                    </div>
                  ))}
                  {result.audit.decisions.length === 0 && (
                    <div className="grid h-16 place-items-center text-xs text-white/38">
                      {zh ? "未提取到承诺条目" : "No promise items extracted"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {result && !auditing && result.audit.grounding && (
            <div className="glass p-5">
              <h3 className="t-label mb-2.5">
                {zh ? "决策依据 — 检索到的 SOP 与历史案例" : "Decision grounding — retrieved SOP & past cases"}
              </h3>
              <div className="space-y-1.5">
                {result.audit.grounding.sop_hits.slice(0, 3).map((h, i) => (
                  <div key={`sop-${i}`} className="glass-inset rounded-xl p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-white/80">SOP · {h.doc_title}</span>
                      <span className="tnum font-mono text-[10px] text-white/45">{(h.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/55">{h.chunk_text}</p>
                  </div>
                ))}
                {result.audit.grounding.case_hits.slice(0, 2).map((h, i) => (
                  <div key={`case-${i}`} className="glass-inset rounded-xl p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-white/80">
                        {zh ? "案例" : "Case"} · {h.source}
                      </span>
                      <span className="tnum font-mono text-[10px] text-white/45">{(h.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/55">{h.lesson}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && !auditing && result.audit.decisions.length > 0 && (
            <ReplyDraftCard
              decisions={result.audit.decisions.map((d) => ({
                promise_id: d.promise_id,
                promise_text: d.promise_text,
                status: d.status,
                owner_department: d.owner_department,
                approval_required: d.approval_required,
              }))}
              guestText={guestText}
              subject={firstMessage?.subject}
              senderHint={firstMessage?.sender}
              threadId={firstMessage && "thread_id" in firstMessage ? (firstMessage as { thread_id?: string }).thread_id : undefined}
              lang={lang}
            />
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Lang } from "@/lib/i18n";

/* Reply draft — the closed loop. The agent drafts the outgoing guest email
   from the audited statuses; a deterministic linter blocks written guarantees
   on unverified promises; a HUMAN clicks Send. */

interface DecisionLite {
  promise_id: string;
  promise_text: string;
  status: string;
  owner_department: string;
  approval_required: boolean;
}

interface Draft {
  subject: string;
  body: string;
  lint_flags: string[];
  regenerated: boolean;
  hotel_name: string;
}

type SendState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "sent"; message_id?: string }
  | { phase: "error"; reason: string; lint_flags?: string[] };

export default function ReplyDraftCard({
  decisions,
  guestText,
  subject,
  senderHint,
  threadId,
  lang,
}: {
  decisions: DecisionLite[];
  guestText: string;
  subject?: string;
  senderHint?: string;
  threadId?: string;
  lang: Lang;
}) {
  const zh = lang === "zh";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [to, setTo] = useState(senderHint ?? "");
  const [send, setSend] = useState<SendState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setDrafting(true);
    setDraftError(null);
    setSend({ phase: "idle" });
    try {
      const r = await fetch("/api/reply/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions, guest_text: guestText, subject }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDraft(j.draft as Draft);
      setEditedSubject((j.draft as Draft).subject);
      setEditedBody((j.draft as Draft).body);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "draft_failed");
    } finally {
      setDrafting(false);
    }
  }, [decisions, guestText, subject]);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestText]);

  const doSend = useCallback(async () => {
    setSend({ phase: "sending" });
    try {
      const r = await fetch("/api/reply/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject: editedSubject, body: editedBody, thread_id: threadId, decisions }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setSend({ phase: "error", reason: j.reason ?? j.error ?? `HTTP ${r.status}`, lint_flags: j.lint_flags });
        return;
      }
      setSend({ phase: "sent", message_id: j.message_id });
    } catch (e) {
      setSend({ phase: "error", reason: e instanceof Error ? e.message : "send_failed" });
    }
  }, [to, editedSubject, editedBody, threadId, decisions]);

  const copyDraft = useCallback(async () => {
    await navigator.clipboard.writeText(`Subject: ${editedSubject}\n\n${editedBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [editedSubject, editedBody]);

  return (
    <div className="glass p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="t-label">{zh ? "回复草稿（人审后发送）" : "Reply draft (human-approved send)"}</h3>
        <button onClick={generate} disabled={drafting} className="btn btn-glass disabled:opacity-50">
          {drafting ? (zh ? "起草中…" : "Drafting…") : zh ? "重新起草" : "Re-draft"}
        </button>
      </div>

      {drafting && !draft && (
        <div className="grid h-32 place-items-center">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/25 border-t-white/85" />
            {zh ? "按审计结果起草并通过过度承诺检查…" : "Drafting from audited statuses + overpromise lint…"}
          </div>
        </div>
      )}
      {draftError && <p className="text-[12px] text-rose-300">{draftError}</p>}

      {draft && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white/70">
              {draft.hotel_name}
            </span>
            {draft.lint_flags.length === 0 ? (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                {zh ? "✓ 零过度承诺" : "✓ zero overpromise"}
              </span>
            ) : (
              <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <AlertTriangle className="mr-1 inline h-2.5 w-2.5 align-[-1px]" strokeWidth={2} aria-hidden />
                {zh ? `${draft.lint_flags.length} 处需人工确认` : `${draft.lint_flags.length} flag(s) for review`}
              </span>
            )}
            {draft.regenerated && (
              <span className="rounded-full border border-white/12 bg-black/25 px-2 py-0.5 text-[10px] text-white/55">
                {zh ? "已自动重写一次" : "auto-revised once"}
              </span>
            )}
          </div>

          {draft.lint_flags.length > 0 && (
            <div className="rounded-xl border border-amber-300/25 bg-amber-400/[0.07] p-2.5">
              {draft.lint_flags.map((f, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-amber-100/90">
                  {f}
                </p>
              ))}
            </div>
          )}

          <input
            value={editedSubject}
            onChange={(e) => setEditedSubject(e.target.value)}
            className="h-8 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-white/90 outline-none focus:border-white/25"
          />
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={11}
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-[12.5px] leading-relaxed text-white/85 focus:border-white/25 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={zh ? "收件人邮箱" : "Recipient email"}
              className="h-8 min-w-[180px] flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/85 placeholder-white/30 outline-none focus:border-white/25"
            />
            <button
              onClick={doSend}
              disabled={send.phase === "sending" || !to.trim() || !editedBody.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {send.phase === "sending" ? (zh ? "发送中…" : "Sending…") : zh ? "通过 Gmail 发送" : "Send via Gmail"}
            </button>
            <button onClick={copyDraft} className="btn btn-glass">
              {copied ? (zh ? "已复制 ✓" : "Copied ✓") : zh ? "复制" : "Copy"}
            </button>
          </div>

          {send.phase === "sent" && (
            <p className="text-[12px] text-emerald-200">
              {zh ? "已发送" : "Sent"}
              {send.message_id ? ` · ${send.message_id}` : ""}
            </p>
          )}
          {send.phase === "error" && (
            <div className="rounded-xl border border-rose-300/25 bg-rose-400/[0.07] p-2.5">
              <p className="text-[11.5px] text-rose-200">{send.reason}</p>
              {send.lint_flags?.map((f, i) => (
                <p key={i} className="mt-1 text-[11px] text-rose-200/80">
                  {f}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell, { TabDef } from "@/components/AppShell";
import BookingHeader from "@/components/BookingHeader";
import DataFreshnessPanel from "@/components/DataFreshnessPanel";
import BookingEmailPanel from "@/components/BookingEmailPanel";
import PromiseLedger from "@/components/PromiseLedger";
import PromiseDetailDrawer from "@/components/PromiseDetailDrawer";
import TaskBoard, { DecoratedTask } from "@/components/TaskBoard";
import TimelineView from "@/components/TimelineView";
import HotelMap from "@/components/HotelMap";
import ComplaintRecovery from "@/components/ComplaintRecovery";
import ToolCallLog from "@/components/ToolCallLog";
import SpotlightCard from "@/components/SpotlightCard";
import ManagerBriefing from "@/components/ManagerBriefing";
import SelfReview from "@/components/SelfReview";
import AgentTeamFlow from "@/components/AgentTeamFlow";
import {
  AgentTraceStage,
  FreshnessResult,
  Message,
  PromiseDecision,
  RecoveryTrace,
  Reservation,
  ToolCall,
} from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

const SEED_BOOKING = "BKG-2026-0718-ACME";

const DEFAULT_COMPLAINT =
  "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.";

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bookingId, setBookingId] = useState(SEED_BOOKING);
  const [bookings, setBookings] = useState<Array<{ booking_id: string; company_name: string }>>([]);
  const t = ui[lang];

  const tabs: TabDef[] = useMemo(
    () => [
      { key: "dashboard", label: t.nav.dashboard },
      { key: "ledger", label: t.nav.ledger },
      { key: "tasks", label: t.nav.tasks },
      { key: "timeline", label: t.nav.timeline },
      { key: "map", label: t.nav.map },
      { key: "recovery", label: t.nav.recovery },
    ],
    [t]
  );

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [freshness, setFreshness] = useState<FreshnessResult[]>([]);
  const [demoNow, setDemoNow] = useState<string>("");
  const [allFresh, setAllFresh] = useState(true);

  const [decisions, setDecisions] = useState<PromiseDecision[]>([]);
  const [auditCalls, setAuditCalls] = useState<ToolCall[]>([]);
  const [agentTrace, setAgentTrace] = useState<AgentTraceStage[]>([]);
  const [reasoningSource, setReasoningSource] = useState<"adk" | "gemini" | "rules" | null>(null);
  const [tasks, setTasks] = useState<DecoratedTask[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());

  const [trace, setTrace] = useState<RecoveryTrace | null>(null);
  const [traceCalls, setTraceCalls] = useState<ToolCall[]>([]);

  const [selected, setSelected] = useState<PromiseDecision | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [tracing, setTracing] = useState(false);

  const refreshTasks = useCallback(async () => {
    const r = await fetch(`/api/tasks?booking_id=${bookingId}`);
    const j = await r.json();
    setTasks(j.tasks);
  }, [bookingId]);

  const runAudit = useCallback(
    async (silent = false) => {
      if (!silent) setAuditing(true);
      const r = await fetch(`/api/audit/${bookingId}`, { method: "POST" });
      const j = await r.json();
      setDecisions(j.decisions);
      setAuditCalls(j.tool_calls);
      setAgentTrace(j.agent_trace ?? []);
      setFreshness(j.freshness_summary);
      setReasoningSource(j.reasoning_source ?? null);
      await refreshTasks();
      if (!silent) {
        setAuditing(false);
        setActiveTab("ledger");
      }
    },
    [refreshTasks, bookingId]
  );

  const approve = useCallback(
    async (promise_id: string) => {
      await fetch(`/api/promises/${promise_id}/approve`, { method: "POST" });
      setApproved((prev) => new Set(prev).add(promise_id));
      await refreshTasks();
    },
    [refreshTasks]
  );

  const toggleStaleSource = useCallback(
    async (source: string) => {
      await fetch("/api/freshness/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      await runAudit(true); // cache cleared server-side; re-audit shows the downgrade
    },
    [runAudit]
  );

  const traceComplaint = useCallback(
    async (text: string) => {
      setTracing(true);
      const r = await fetch(`/api/complaints/trace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, complaint_text: text }),
      });
      const j = (await r.json()) as RecoveryTrace & { tool_calls: ToolCall[] };
      setTrace(j);
      setTraceCalls(j.tool_calls ?? []);
      await refreshTasks();
      setTracing(false);
      setActiveTab("recovery");
    },
    [refreshTasks, bookingId]
  );

  // Initial load.
  useEffect(() => {
    (async () => {
      const [b, m, f, ap] = await Promise.all([
        fetch(`/api/bookings/${bookingId}`).then((r) => r.json()),
        fetch(`/api/messages/${bookingId}`).then((r) => r.json()),
        fetch(`/api/freshness`).then((r) => r.json()),
        fetch(`/api/promises/seed/approve`).then((r) => r.json()),
      ]);
      setReservation(b.reservation ?? null);
      setMessages(m.messages ?? []);
      setFreshness(f.sources ?? []);
      setDemoNow(f.demo_now ?? "");
      setAllFresh(f.all_fresh ?? true);
      setApproved(new Set<string>(ap.approved ?? []));
      await runAudit(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Load booking list once for the selector.
  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((j) => setBookings(j.bookings ?? []))
      .catch(() => setBookings([]));
  }, []);

  const freshnessByPromise = useMemo(() => {
    const map: Record<string, { source_name: string; freshness_status: string }[]> = {};
    for (const d of decisions) {
      map[d.promise_id] = d.tool_calls
        .filter((c) => c.tool_name === "check_data_freshness")
        .map((c) => {
          const out = c.output as { source_name: string; freshness_status: string };
          return { source_name: out.source_name, freshness_status: out.freshness_status };
        });
    }
    return map;
  }, [decisions]);

  const ledgerHighlights = trace ? trace.matched_promises.map((m) => m.promise_id) : [];
  const taskHighlights = trace
    ? trace.matched_promises.map((m) => m.linked_task_id ?? "").filter(Boolean)
    : [];

  return (
    <AppShell
      tabs={tabs}
      activeTab={activeTab}
      onTab={setActiveTab}
      bookingId={bookingId}
      company={reservation?.company_name ?? "Acme Robotics"}
      allFresh={allFresh}
      onRunAudit={() => runAudit(false)}
      onTrace={() => traceComplaint(DEFAULT_COMPLAINT)}
      auditing={auditing}
      tracing={tracing}
      lang={lang}
      onLang={setLang}
      bookings={bookings}
      onBooking={setBookingId}
    >
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          <ManagerBriefing
            reservation={reservation}
            decisions={decisions}
            tasks={tasks}
            freshness={freshness}
            onRunAudit={() => runAudit(false)}
            onTrace={() => traceComplaint(DEFAULT_COMPLAINT)}
            auditing={auditing}
            tracing={tracing}
            lang={lang}
            reasoningSource={reasoningSource}
          />
          <AgentTeamFlow stages={agentTrace} lang={lang} />
          <BookingHeader reservation={reservation} lang={lang} />
          <DataFreshnessPanel sources={freshness} demoNow={demoNow} lang={lang} onToggle={toggleStaleSource} />
          <div className="grid gap-4 lg:grid-cols-2">
            <BookingEmailPanel messages={messages} lang={lang} />
            <SpotlightCard className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">{t.activity.title}</h2>
              <p className="mb-3 text-[11px] text-slate-400">{t.activity.body}</p>
              <ToolCallLog calls={auditCalls} dense />
            </SpotlightCard>
          </div>
          <SelfReview lang={lang} refreshKey={approved.size} />
        </div>
      )}

      {activeTab === "ledger" && (
        <PromiseLedger
          decisions={decisions}
          approved={approved}
          onSelect={setSelected}
          onApprove={approve}
          highlightIds={ledgerHighlights}
          lang={lang}
        />
      )}

      {activeTab === "tasks" && <TaskBoard tasks={tasks} highlightIds={taskHighlights} lang={lang} />}

      {activeTab === "timeline" && <TimelineView trace={trace} lang={lang} />}

      {activeTab === "map" && (
        <HotelMap assignedRoom={trace ? "402" : undefined} highlight={!!trace} />
      )}

      {activeTab === "recovery" && (
        <ComplaintRecovery
          trace={trace}
          toolCalls={traceCalls}
          onTrace={traceComplaint}
          busy={tracing}
          lang={lang}
        />
      )}

      <PromiseDetailDrawer
        decision={selected}
        approved={approved}
        freshnessByPromise={freshnessByPromise}
        trace={trace}
        onApprove={approve}
        onClose={() => setSelected(null)}
        lang={lang}
      />
    </AppShell>
  );
}

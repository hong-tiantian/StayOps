"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell, { BookingOption, Role, TabDef } from "@/components/AppShell";
import CommandWorkspace from "@/components/CommandWorkspace";
import JudgePanel from "@/components/JudgePanel";
import DemoConsole, { HotelOption } from "@/components/DemoConsole";
import EvalMetricsCard from "@/components/EvalMetricsCard";
import SelfReview from "@/components/SelfReview";
import PromiseLedger from "@/components/PromiseLedger";
import PromiseDetailDrawer from "@/components/PromiseDetailDrawer";
import TaskBoard, { DecoratedTask } from "@/components/TaskBoard";
import TimelineView from "@/components/TimelineView";
import HotelMap from "@/components/HotelMap";
import ComplaintRecovery from "@/components/ComplaintRecovery";
import GmailIntakePanel from "@/components/GmailIntakePanel";
import HotelBrainPanel from "@/components/HotelBrainPanel";
import {
  AgentTraceStage,
  FreshnessResult,
  InfoAnalysis,
  Message,
  PromiseDecision,
  RecoveryTrace,
  Reservation,
  TaskPlan,
  ToolCall,
} from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

const SEED_BOOKING = "BKG-2026-0718-ACME";

const DEFAULT_COMPLAINT =
  "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.";

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
  const [role, setRole] = useState<Role>("manager");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bookingId, setBookingId] = useState(SEED_BOOKING);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [activeHotelId, setActiveHotelId] = useState<string>("");
  const t = ui[lang];

  /* Two sidebars, one principle: the manager sees WHAT to do,
     the judge sees HOW the AI decided it. */
  const tabs: TabDef[] = useMemo(
    () =>
      role === "manager"
        ? [
            { key: "dashboard", label: t.nav.dashboard },
            { key: "ledger", label: t.nav.ledger },
            { key: "tasks", label: t.nav.tasks },
            { key: "timeline", label: t.nav.timeline },
            { key: "map", label: t.nav.map },
            { key: "recovery", label: t.nav.recovery },
            { key: "intake", label: t.nav.intake },
            { key: "hotel", label: t.nav.hotel },
          ]
        : [
            { key: "jworkflow", label: t.nav.jworkflow },
            { key: "jeval", label: t.nav.jeval },
            { key: "jphoenix", label: t.nav.jphoenix },
            { key: "jconsole", label: t.nav.jconsole },
          ],
    [t, role]
  );

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [freshness, setFreshness] = useState<FreshnessResult[]>([]);
  const [demoNow, setDemoNow] = useState<string>("");
  const [allFresh, setAllFresh] = useState(true);

  const [decisions, setDecisions] = useState<PromiseDecision[]>([]);
  const [auditCalls, setAuditCalls] = useState<ToolCall[]>([]);
  const [agentTrace, setAgentTrace] = useState<AgentTraceStage[]>([]);
  const [infoAnalysis, setInfoAnalysis] = useState<InfoAnalysis | null>(null);
  const [taskPlan, setTaskPlan] = useState<TaskPlan[]>([]);
  const [reasoningSource, setReasoningSource] = useState<"adk" | "gemini" | "rules" | null>(null);
  const [tasks, setTasks] = useState<DecoratedTask[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());

  const [trace, setTrace] = useState<RecoveryTrace | null>(null);
  const [traceCalls, setTraceCalls] = useState<ToolCall[]>([]);

  const [selected, setSelected] = useState<PromiseDecision | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [tracing, setTracing] = useState(false);

  /* Switching tabs always closes the detail drawer — otherwise its overlay
     swallows the click and the sidebar appears dead ("can't get back").
     navNonce also tells the dashboard to collapse its drill panel when the
     user re-clicks "Dashboard" while already on it. */
  const [navNonce, setNavNonce] = useState(0);
  const goTab = useCallback((key: string) => {
    setSelected(null);
    setNavNonce((n) => n + 1);
    setActiveTab(key);
  }, []);

  const switchRole = useCallback(
    (next: Role) => {
      setRole(next);
      setSelected(null);
      setActiveTab(next === "manager" ? "dashboard" : "jworkflow");
    },
    []
  );

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
      setInfoAnalysis(j.info_analysis ?? null);
      setTaskPlan(j.task_plan ?? []);
      setFreshness(j.freshness_summary);
      setAllFresh((j.freshness_summary ?? []).every((s: FreshnessResult) => s.freshness_status === "fresh"));
      setReasoningSource(j.reasoning_source ?? null);
      // Keep an existing selection if still valid; never auto-open the drawer.
      setSelected((prev) =>
        prev && (j.decisions ?? []).some((d: PromiseDecision) => d.promise_id === prev.promise_id)
          ? prev
          : null
      );
      await refreshTasks();
      if (!silent) {
        setAuditing(false);
        if (role === "manager") setActiveTab("dashboard");
      }
    },
    [refreshTasks, bookingId, role]
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
      if (role === "manager") setActiveTab("recovery");
    },
    [refreshTasks, bookingId, role]
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

  // Load booking list + hotel personas once for the selectors.
  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((j) => setBookings(j.bookings ?? []))
      .catch(() => setBookings([]));
    fetch("/api/hotels")
      .then((r) => r.json())
      .then((j) => {
        setHotels((j.hotels ?? []).map((h: { hotel_id: string; name: string }) => ({ hotel_id: h.hotel_id, name: h.name })));
        setActiveHotelId(j.active_hotel_id ?? "");
      })
      .catch(() => setHotels([]));
  }, []);

  // Switching the hotel persona swaps the SOP corpus — re-audit immediately.
  const switchHotel = useCallback(
    async (hotel_id: string) => {
      setActiveHotelId(hotel_id);
      await fetch("/api/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotel_id }),
      });
      // Silent re-audit: refresh decisions under the new persona without
      // yanking the user away from the Demo Console.
      await runAudit(true);
    },
    [runAudit]
  );

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

  // Ambient weather — the page atmosphere IS the primary status indicator.
  // calm = on track · warning = at-risk promises or stale data · critical = failures/conflicts.
  // Stale data alone is a caution (the gate already blocks guarantees), not an emergency —
  // critical is reserved for actual broken/conflicting promises.
  const weather = useMemo(() => {
    if (decisions.some((d) => ["conflict", "failed"].includes(d.status))) return "critical";
    const unresolvedRisk = decisions.some(
      (d) =>
        ["at_risk", "needs_approval", "missing_info", "cannot_confirm"].includes(d.status) &&
        !(d.approval_required && approved.has(d.promise_id))
    );
    return !allFresh || unresolvedRisk ? "warning" : "calm";
  }, [decisions, approved, allFresh]);

  useEffect(() => {
    document.documentElement.dataset.weather = weather;
  }, [weather]);

  const ledgerHighlights = trace ? trace.matched_promises.map((m) => m.promise_id) : [];
  const taskHighlights = trace
    ? trace.matched_promises.map((m) => m.linked_task_id ?? "").filter(Boolean)
    : [];

  const activeHotelName = hotels.find((h) => h.hotel_id === activeHotelId)?.name;

  return (
    <AppShell
      tabs={tabs}
      activeTab={activeTab}
      onTab={goTab}
      role={role}
      onRole={switchRole}
      bookingId={bookingId}
      company={reservation?.company_name ?? "Acme Robotics"}
      hotelName={activeHotelName}
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
      {/* ---------------- Manager view ---------------- */}
      {activeTab === "dashboard" && (
        <CommandWorkspace
          lang={lang}
          bookingId={bookingId}
          bookings={bookings}
          onBooking={setBookingId}
          reservation={reservation}
          decisions={decisions}
          onSelect={setSelected}
          approved={approved}
          onApprove={approve}
          tasks={tasks}
          taskPlan={taskPlan}
          infoAnalysis={infoAnalysis}
          freshness={freshness}
          onRunAudit={() => runAudit(false)}
          auditing={auditing}
          navResetNonce={navNonce}
        />
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

      {activeTab === "intake" && <GmailIntakePanel lang={lang} variant="manual" />}

      {activeTab === "hotel" && <HotelBrainPanel lang={lang} />}

      {activeTab === "recovery" && (
        <ComplaintRecovery
          trace={trace}
          toolCalls={traceCalls}
          onTrace={traceComplaint}
          busy={tracing}
          lang={lang}
        />
      )}

      {/* ---------------- Judge view ---------------- */}
      {activeTab === "jworkflow" && (
        <JudgePanel
          lang={lang}
          decisions={decisions}
          taskPlan={taskPlan}
          freshness={freshness}
          trace={trace}
          selected={selected}
          onSelect={setSelected}
          reasoningSource={reasoningSource}
          approved={approved}
          agentTrace={agentTrace}
          auditCalls={auditCalls}
        />
      )}

      {activeTab === "jeval" && (
        <div className="space-y-4">
          <div className="glass-lite px-5 py-3.5">
            <h1 className="t-title">{lang === "zh" ? "评测指标 — 黄金用例" : "Eval Metrics — golden case"}</h1>
            <p className="t-caption mt-0.5">
              {lang === "zh"
                ? "黄金用例固定为 Acme 预订(BKG-2026-0718-ACME),与当前选中的预订无关;结果缓存,Re-run 才会重跑。"
                : "The golden case is pinned to the Acme booking (BKG-2026-0718-ACME) regardless of the selected booking; results are cached until you re-run."}
            </p>
          </div>
          <div className="glass mx-auto max-w-xl p-6">
            <EvalMetricsCard bookingId={SEED_BOOKING} lang={lang} />
          </div>
        </div>
      )}

      {activeTab === "jphoenix" && (
        <div className="space-y-4">
          <div className="glass-lite px-5 py-3.5">
            <h1 className="t-title">{lang === "zh" ? "Phoenix 监控 — Agent 自检与学习" : "Phoenix Monitor — self-review & learning"}</h1>
            <p className="t-caption mt-0.5">
              {lang === "zh"
                ? "通过 Arize Phoenix MCP 读取 agent 自己的观测项目,并展示它从经理反馈中学到了什么。"
                : "Reads the agent's own observability project over the Arize Phoenix MCP and shows what it learned from manager feedback."}
            </p>
          </div>
          <SelfReview lang={lang} refreshKey={approved.size + auditCalls.length} />
        </div>
      )}

      {activeTab === "jconsole" && (
        <DemoConsole
          lang={lang}
          hotels={hotels}
          activeHotelId={activeHotelId}
          onHotel={switchHotel}
          freshness={freshness}
          demoNow={demoNow}
          onToggleFreshness={toggleStaleSource}
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
        role={role}
      />
    </AppShell>
  );
}

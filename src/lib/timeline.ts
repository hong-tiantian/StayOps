import { TimelineEvent } from "./types";

/** Fixed promise-lifecycle timeline for the demo case. */
export const TIMELINE: TimelineEvent[] = [
  { at: "2026-07-10 15:22", category: "system", label: "Booking email received", detail: "MSG-001 from maya.chen@acmerobotics.com" },
  { at: "2026-07-10 15:40", category: "system", label: "Sales note created", detail: "MSG-002 — early arrival noted, quiet king to be prioritized" },
  { at: "2026-07-18 09:45", category: "system", label: "Data freshness checked", detail: "Fivetran demo connector synced operational sources" },
  { at: "2026-07-18 09:52", category: "promise", label: "Promise audit completed", detail: "6 promises classified" },
  { at: "2026-07-18 09:58", category: "approval", label: "Manager approved quiet king room priority", detail: "APR-001 → P-002" },
  { at: "2026-07-18 09:59", category: "approval", label: "Manager approved projector setup", detail: "APR-002 → P-004" },
  { at: "2026-07-18 10:00", category: "task", label: "Task board updated", detail: "Department tasks created for verified/approved promises" },
  { at: "2026-07-18 14:00", category: "system", label: "Meeting started", detail: "MR-BLUE meeting 14:00–17:00" },
  { at: "2026-07-18 14:18", category: "complaint", label: "Complaint received", detail: "MSG-004 — VP near elevator, projector not ready" },
  { at: "2026-07-18 14:19", category: "complaint", label: "Broken promise trace generated", detail: "Matched P-002 and P-004" },
  { at: "2026-07-18 14:21", category: "recovery", label: "Recovery tasks created", detail: "Room move + technician dispatch + apology" },
];

export const TIMELINE_FILTERS = [
  "All",
  "Promises",
  "Approvals",
  "Tasks",
  "Complaints",
  "Recovery",
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export function filterTimeline(filter: TimelineFilter): TimelineEvent[] {
  if (filter === "All") return TIMELINE;
  const map: Record<Exclude<TimelineFilter, "All">, TimelineEvent["category"]> = {
    Promises: "promise",
    Approvals: "approval",
    Tasks: "task",
    Complaints: "complaint",
    Recovery: "recovery",
  };
  return TIMELINE.filter((e) => e.category === map[filter]);
}

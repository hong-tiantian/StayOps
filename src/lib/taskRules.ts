import { OpsTask } from "./types";
import { DEMO_NOW } from "./freshness";
import { loadEventSpaces } from "./data";
import { TASK_COLUMNS, TaskColumn, TaskWarning } from "./taskTypes";

export { TASK_COLUMNS };
export type { TaskColumn, TaskWarning };

/** Maps a raw task status to a Kanban column. */
export function columnFor(task: OpsTask): TaskColumn {
  switch (task.status) {
    case "waiting_approval":
      return "Waiting for Approval";
    case "approved":
      return "Approved";
    case "created":
      return "Created";
    case "in_progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "open":
    default:
      // An "open" task that is past due is at risk of becoming a failure;
      // we still surface it under "Created" but with a warning badge.
      return "Created";
  }
}

/**
 * Returns a risk/warning badge for a task, exposing the two demo failures:
 *  - TASK-103 front-desk room-blocking task still open.
 *  - TASK-102 projector setup due at meeting start instead of -120m.
 */
export function warningFor(task: OpsTask): TaskWarning | null {
  // Projector due-time rule check.
  if (task.department === "events" && /projector/i.test(task.description)) {
    const space = loadEventSpaces()[0];
    if (space) {
      const start = new Date(`${space.date}T${space.start_time}:00`);
      const requiredDue = new Date(start.getTime() - space.setup_lead_time_minutes * 60000);
      const due = new Date(task.due_at);
      if (due.getTime() !== requiredDue.getTime()) {
        return {
          level: "error",
          message: `Due time ${fmt(task.due_at)} violates SOP-EVT-004 (should be ${fmt(
            toIso(requiredDue)
          )} = meeting_start - ${space.setup_lead_time_minutes}m).`,
        };
      }
    }
  }

  // Open task past its due date.
  if ((task.status === "open" || task.status === "created") && task.due_at) {
    const now = new Date(DEMO_NOW).getTime();
    if (new Date(toUtcish(task.due_at)).getTime() < now) {
      return {
        level: "error",
        message: `Past due (${fmt(task.due_at)}) and still ${task.status}. Escalate before arrival.`,
      };
    }
  }

  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
// Task due_at values are stored as local-naive timestamps; compare loosely.
function toUtcish(s: string): string {
  return s.endsWith("Z") ? s : `${s}Z`;
}
function fmt(s: string): string {
  return s.replace("T", " ").replace("Z", "").slice(0, 16);
}

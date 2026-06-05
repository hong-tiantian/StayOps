// Client-safe task constants & types (no server/fs imports).

export const TASK_COLUMNS = [
  "Waiting for Approval",
  "Approved",
  "Created",
  "In Progress",
  "Blocked",
  "Completed",
  "Failed",
] as const;

export type TaskColumn = (typeof TASK_COLUMNS)[number];

export interface TaskWarning {
  level: "warning" | "error";
  message: string;
}

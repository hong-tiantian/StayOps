"use client";

import { OpsTask } from "@/lib/types";
import { TASK_COLUMNS, TaskColumn, TaskWarning } from "@/lib/taskTypes";

export interface DecoratedTask extends OpsTask {
  column: TaskColumn;
  warning: TaskWarning | null;
}

const COLUMN_ACCENT: Record<TaskColumn, string> = {
  "Waiting for Approval": "border-t-purple-400",
  Approved: "border-t-purple-500",
  Created: "border-t-blue-400",
  "In Progress": "border-t-amber-400",
  Blocked: "border-t-red-400",
  Completed: "border-t-green-500",
  Failed: "border-t-red-600",
};

export default function TaskBoard({
  tasks,
  highlightIds = [],
}: {
  tasks: DecoratedTask[];
  highlightIds?: string[];
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {TASK_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.column === col);
        return (
          <div key={col} className="w-64 flex-shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-gray-600">{col}</h3>
              <span className="rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-600">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {colTasks.map((t) => {
                const highlight = highlightIds.includes(t.task_id);
                return (
                  <div
                    key={t.task_id}
                    className={`lift rounded-xl border border-t-2 bg-white p-3 shadow-card ${
                      COLUMN_ACCENT[col]
                    } ${highlight ? "ring-2 ring-rose-400" : "border-gray-200"}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-gray-400">{t.task_id}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {t.department}
                      </span>
                    </div>
                    <p className="mb-2 text-xs leading-snug text-gray-700">{t.description}</p>
                    <div className="space-y-1 text-[10px] text-gray-400">
                      <div>Due: {t.due_at ? t.due_at.replace("T", " ") : "—"}</div>
                      <div>Owner: {t.owner}</div>
                      <div>
                        Source:{" "}
                        <span className="font-mono text-gray-500">{t.source_promise_id}</span>
                      </div>
                    </div>
                    {t.warning && (
                      <div
                        className={`mt-2 rounded px-2 py-1 text-[10px] ${
                          t.warning.level === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        ⚠ {t.warning.message}
                      </div>
                    )}
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[10px] text-gray-300">
                  empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

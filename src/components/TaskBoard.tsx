"use client";

import { OpsTask } from "@/lib/types";
import { TASK_COLUMNS, TaskColumn, TaskWarning } from "@/lib/taskTypes";
import { Lang, ui } from "@/lib/i18n";

export interface DecoratedTask extends OpsTask {
  column: TaskColumn;
  warning: TaskWarning | null;
}

const COLUMN_ACCENT: Record<TaskColumn, string> = {
  "Waiting for Approval": "147,51,234",
  Approved: "168,85,247",
  Created: "96,165,250",
  "In Progress": "229,190,120",
  Blocked: "248,113,113",
  Completed: "126,200,169",
  Failed: "239,68,68",
};

export default function TaskBoard({
  tasks,
  highlightIds = [],
  lang,
}: {
  tasks: DecoratedTask[];
  highlightIds?: string[];
  lang: Lang;
}) {
  const copy = ui[lang];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="t-title">{lang === "zh" ? "任务看板" : "Task Board"}</h1>
        <p className="t-caption mt-0.5">{lang === "zh" ? "已批准的承诺转化为各部门可执行任务" : "Approved promises routed to department-ready tasks"}</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col);
          const rgb = COLUMN_ACCENT[col];
          return (
            <div key={col} className="w-72 flex-shrink-0">
              <div className="mb-3 flex h-6 items-center justify-between px-1">
                <h3 className="t-label flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${rgb})` }} />
                  {copy.task.columns[col]}
                </h3>
                <span className="tnum text-[12px] font-semibold text-white/55">{colTasks.length}</span>
              </div>
              <div className="space-y-2.5">
                {colTasks.map((t) => {
                  const highlight = highlightIds.includes(t.task_id);
                  return (
                    <div
                      key={t.task_id}
                      className={`lift status-edge relative overflow-hidden glass p-4 pl-5 ${
                        highlight ? "ring-1 ring-rose-400/60" : ""
                      }`}
                      style={{ "--edge": rgb.replace(/,/g, " ") } as React.CSSProperties}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="tnum font-mono text-[11px] text-white/38">{t.task_id}</span>
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
                          {t.department.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mb-2.5 text-[13.5px] font-medium leading-snug text-white/90">{t.description}</p>
                      <div className="space-y-1 text-[11px] text-white/38">
                        <div className="tnum">{copy.task.due}: {t.due_at ? t.due_at.replace("T", " ") : "—"}</div>
                        <div>{copy.task.owner}: {t.owner}</div>
                        <div>
                          {copy.task.source}:{" "}
                          <span className="font-mono text-white/55">{t.source_promise_id}</span>
                        </div>
                      </div>
                      {t.warning && (
                        <div
                          className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                            t.warning.level === "error"
                              ? "border border-rose-300/30 bg-rose-400/12 text-rose-200"
                              : "border border-amber-300/30 bg-amber-400/12 text-amber-200"
                          }`}
                        >
                          ⚠ {t.warning.message}
                        </div>
                      )}
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/12 py-7 text-center text-[11px] text-white/30">
                    {copy.task.empty}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

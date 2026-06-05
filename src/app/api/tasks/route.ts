import { NextResponse } from "next/server";
import { getOpsTasks, addOpsTask, nextTaskId } from "@/lib/data";
import { columnFor, warningFor } from "@/lib/taskRules";
import { Department, OpsTask } from "@/lib/types";

export const dynamic = "force-dynamic";

function decorate(tasks: OpsTask[]) {
  return tasks.map((t) => ({
    ...t,
    column: columnFor(t),
    warning: warningFor(t),
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const booking_id = searchParams.get("booking_id");
  let tasks = getOpsTasks();
  if (booking_id) tasks = tasks.filter((t) => t.booking_id === booking_id);
  return NextResponse.json({ tasks: decorate(tasks) });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<OpsTask>;
  const task: OpsTask = {
    task_id: body.task_id ?? nextTaskId(),
    booking_id: body.booking_id ?? "BKG-2026-0718-ACME",
    source_promise_id: body.source_promise_id ?? "",
    department: (body.department as Department) ?? "front_desk",
    description: body.description ?? "",
    due_at: body.due_at ?? "",
    status: body.status ?? "created",
    owner: body.owner ?? `${body.department ?? "ops"}@hotel.test`,
    completed_at: body.completed_at ?? "",
  };
  addOpsTask(task);
  return NextResponse.json({ task: { ...task, column: columnFor(task), warning: warningFor(task) } });
}

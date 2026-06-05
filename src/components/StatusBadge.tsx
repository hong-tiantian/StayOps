import { PromiseStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  verifiable: "bg-green-100 text-green-800 border-green-200",
  at_risk: "bg-amber-100 text-amber-800 border-amber-200",
  missing_info: "bg-blue-100 text-blue-800 border-blue-200",
  conflict: "bg-red-100 text-red-800 border-red-200",
  needs_approval: "bg-purple-100 text-purple-800 border-purple-200",
  cannot_confirm: "bg-gray-100 text-gray-700 border-gray-200",
  approved: "bg-purple-100 text-purple-800 border-purple-200",
  task_created: "bg-blue-200 text-blue-900 border-blue-300",
  completed: "bg-green-100 text-green-800 border-green-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
};

const LABELS: Record<string, string> = {
  verifiable: "Verifiable",
  at_risk: "At Risk",
  missing_info: "Missing Info",
  conflict: "Conflict",
  needs_approval: "Needs Approval",
  cannot_confirm: "Cannot Confirm",
  approved: "Approved",
  task_created: "Task Created",
  completed: "Completed",
  failed: "Failed",
  resolved: "Resolved",
};

export default function StatusBadge({
  status,
  size = "sm",
}: {
  status: PromiseStatus | string;
  size?: "sm" | "xs";
}) {
  const cls = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${pad} ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {LABELS[status] ?? status}
    </span>
  );
}

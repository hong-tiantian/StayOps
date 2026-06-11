import { PromiseStatus } from "@/lib/types";
import { Lang, ui } from "@/lib/i18n";

/* Status reads as a single 6px point of light on neutral glass —
   no colored pill backgrounds, no rainbow. */
const DOT: Record<string, string> = {
  verifiable: "rgb(110 222 178)",
  completed: "rgb(110 222 178)",
  resolved: "rgb(110 222 178)",
  at_risk: "rgb(244 196 110)",
  needs_approval: "rgb(244 196 110)",
  approved: "rgb(188 162 240)",
  task_created: "rgb(126 200 236)",
  missing_info: "rgb(126 200 236)",
  conflict: "rgb(246 142 158)",
  failed: "rgb(246 142 158)",
  cannot_confirm: "rgb(246 142 158)",
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
  lang = "en",
}: {
  status: PromiseStatus | string;
  size?: "sm" | "xs";
  lang?: Lang;
}) {
  const dot = DOT[status] ?? "rgba(255,255,255,0.45)";
  const pad = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]";
  const labels = ui[lang].status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/25 font-medium text-white/80 backdrop-blur-sm ${pad}`}
    >
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
      />
      {labels[status as keyof typeof labels] ?? LABELS[status] ?? status}
    </span>
  );
}

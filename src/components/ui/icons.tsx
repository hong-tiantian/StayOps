"use client";

import {
  AlertTriangle,
  BedDouble,
  BellRing,
  Briefcase,
  Brush,
  CheckCircle2,
  ClipboardList,
  Compass,
  ConciergeBell,
  FileText,
  Mail,
  Package,
  Projector,
  Ruler,
  Satellite,
  SearchCheck,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* Linear SVG icon set (lucide, MIT) replacing the emoji glyphs.
   One place to map domain concepts → icons so every surface stays consistent. */

export const DEPT_ICONS: Record<string, LucideIcon> = {
  front_desk: BellRing,
  housekeeping: Brush,
  fb: UtensilsCrossed,
  events: Projector,
  sales: Briefcase,
  concierge: ConciergeBell,
  manager: Compass,
  maintenance: Wrench,
};

export function DeptIcon({ dept, className = "h-3.5 w-3.5" }: { dept: string; className?: string }) {
  const Icon = DEPT_ICONS[dept] ?? ClipboardList;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

export const TOOL_ICONS: Record<string, LucideIcon> = {
  check_data_freshness: Satellite,
  get_reservation: FileText,
  search_messages: Mail,
  check_room_readiness: BedDouble,
  check_inventory: Package,
  retrieve_sop: Ruler,
  check_event_space: Projector,
  create_ops_task: ClipboardList,
  log_promise_decision: CheckCircle2,
  trace_broken_promise: SearchCheck,
};

export function ToolIcon({ tool, className = "h-3.5 w-3.5" }: { tool: string; className?: string }) {
  const Icon = TOOL_ICONS[tool] ?? ClipboardList;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

export function AlertIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <AlertTriangle className={className} strokeWidth={1.75} aria-hidden />;
}

import fs from "fs";
import path from "path";
import {
  Message,
  Reservation,
  RoomInventory,
  RoomReadiness,
  HousekeepingRoster,
  SopRule,
  EventSpace,
  BillingAccount,
  TransportVendor,
  SyncStatus,
  ApprovalRecord,
  OpsTask,
  PromiseLedgerRow,
  Department,
  PromiseStatus,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

/** Minimal CSV parser supporting double-quoted fields with embedded commas/quotes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    rows.push(record);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0];
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

function read(file: string): Record<string, string>[] {
  const full = path.join(DATA_DIR, file);
  const text = fs.readFileSync(full, "utf8");
  return parseCsv(text);
}

const toBool = (v: string) => v.trim().toLowerCase() === "true";
const toNum = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function loadMessages(): Message[] {
  return read("messages.csv") as unknown as Message[];
}

export function loadReservations(): Reservation[] {
  return read("reservations.csv").map((r) => ({
    booking_id: r.booking_id,
    company_name: r.company_name,
    arrival_date: r.arrival_date,
    arrival_time: r.arrival_time,
    departure_date: r.departure_date,
    room_count: toNum(r.room_count),
    king_count: toNum(r.king_count),
    twin_count: toNum(r.twin_count),
    meeting_room_id: r.meeting_room_id,
    primary_contact: r.primary_contact,
    status: r.status,
  }));
}

export function loadRoomInventory(): RoomInventory[] {
  return read("room_inventory.csv").map((r) => ({
    room_id: r.room_id,
    room_type: r.room_type,
    floor: toNum(r.floor),
    quiet_zone: toBool(r.quiet_zone),
    near_elevator: toBool(r.near_elevator),
    blocked_for_booking_id: r.blocked_for_booking_id,
    next_arrival_booking_id: r.next_arrival_booking_id,
  }));
}

export function loadRoomReadiness(): RoomReadiness[] {
  return read("room_readiness.csv").map((r) => ({
    room_id: r.room_id,
    date: r.date,
    clean_status: r.clean_status,
    estimated_ready_at: r.estimated_ready_at,
    inspected: toBool(r.inspected),
    assigned_housekeeper: r.assigned_housekeeper,
  }));
}

export function loadHousekeepingRoster(): HousekeepingRoster[] {
  return read("housekeeping_roster.csv").map((r) => ({
    staff_id: r.staff_id,
    staff_name: r.staff_name,
    shift_start: r.shift_start,
    shift_end: r.shift_end,
    capacity_minutes: toNum(r.capacity_minutes),
    assigned_minutes: toNum(r.assigned_minutes),
  }));
}

export function loadSop(): SopRule[] {
  return read("hotel_sop.csv").map((r) => ({
    policy_id: r.policy_id,
    promise_type: r.promise_type,
    rule: r.rule,
    approval_required: toBool(r.approval_required),
    department: r.department as Department,
    deadline_rule: r.deadline_rule,
  }));
}

export function loadEventSpaces(): EventSpace[] {
  return read("event_spaces.csv").map((r) => ({
    space_id: r.space_id,
    date: r.date,
    start_time: r.start_time,
    end_time: r.end_time,
    capacity: toNum(r.capacity),
    projector: toBool(r.projector),
    screen: toBool(r.screen),
    hdmi_adapter: toBool(r.hdmi_adapter),
    setup_lead_time_minutes: toNum(r.setup_lead_time_minutes),
    status: r.status,
  }));
}

export function loadBillingAccounts(): BillingAccount[] {
  return read("billing_accounts.csv") as unknown as BillingAccount[];
}

export function loadTransportVendors(): TransportVendor[] {
  return read("transport_vendors.csv").map((r) => ({
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name,
    date: r.date,
    available_vehicle_count: toNum(r.available_vehicle_count),
    requires_flight_number: toBool(r.requires_flight_number),
    requires_arrival_time: toBool(r.requires_arrival_time),
    status: r.status,
  }));
}

export function loadSyncStatus(): SyncStatus[] {
  return read("sync_status.csv").map((r) => ({
    source_name: r.source_name,
    last_synced_at: r.last_synced_at,
    max_allowed_age_minutes: toNum(r.max_allowed_age_minutes),
  }));
}

export function loadApprovalRecords(): ApprovalRecord[] {
  return read("approval_records.csv") as unknown as ApprovalRecord[];
}

export function loadPromiseLedger(): PromiseLedgerRow[] {
  return read("promise_ledger.csv").map((r) => ({
    promise_id: r.promise_id,
    booking_id: r.booking_id,
    promise_text: r.promise_text,
    promise_type: r.promise_type,
    status: r.status as PromiseStatus,
    owner_department: r.owner_department as Department,
    evidence: r.evidence,
    risk_reason: r.risk_reason,
    recommended_action: r.recommended_action,
    approval_required: toBool(r.approval_required),
    execution_state: r.execution_state,
  }));
}

// ---- Ops tasks: CSV seed + in-memory overlay (created/approved at runtime) ----

function loadOpsTasksSeed(): OpsTask[] {
  return read("ops_tasks.csv").map((r) => ({
    task_id: r.task_id,
    booking_id: r.booking_id,
    source_promise_id: r.source_promise_id,
    department: r.department as Department,
    description: r.description,
    due_at: r.due_at,
    status: r.status,
    owner: r.owner,
    completed_at: r.completed_at,
  }));
}

// Persist runtime task mutations across hot reloads via globalThis.
const g = globalThis as unknown as { __stayops_tasks__?: OpsTask[] };

export function getOpsTasks(): OpsTask[] {
  if (!g.__stayops_tasks__) {
    g.__stayops_tasks__ = loadOpsTasksSeed();
  }
  return g.__stayops_tasks__;
}

export function addOpsTask(task: OpsTask): OpsTask {
  const tasks = getOpsTasks();
  const existing = tasks.find((t) => t.task_id === task.task_id);
  if (existing) {
    Object.assign(existing, task);
    return existing;
  }
  tasks.push(task);
  return task;
}

export function nextTaskId(): string {
  const tasks = getOpsTasks();
  const nums = tasks
    .map((t) => parseInt(t.task_id.replace("TASK-", ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 100;
  return `TASK-${max + 1}`;
}

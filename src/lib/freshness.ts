import { loadSyncStatus } from "./data";
import { FreshnessResult } from "./types";

/** Fixed demo "current time" used for all deterministic calculations. */
export const DEMO_NOW = "2026-07-18T10:00:00Z";

export const freshnessRules: Record<string, number> = {
  reservations: 30,
  room_inventory: 30,
  room_readiness: 15,
  housekeeping_roster: 120,
  hotel_sop: 1440,
  event_spaces: 60,
  billing_accounts: 1440,
  transport_vendors: 120,
  ops_tasks: 15,
  approval_records: 15,
};

// Demo-only override: force a source to read as stale so judges can watch the
// freshness gate downgrade a promise live. Held in memory (demo-scoped).
const g = globalThis as unknown as { __stayops_stale__?: Set<string> };
function staleSet(): Set<string> {
  if (!g.__stayops_stale__) g.__stayops_stale__ = new Set();
  return g.__stayops_stale__;
}
export function toggleStale(source_name: string): boolean {
  const s = staleSet();
  if (s.has(source_name)) {
    s.delete(source_name);
    return false;
  }
  s.add(source_name);
  return true;
}
export function isOverriddenStale(source_name: string): boolean {
  return staleSet().has(source_name);
}

export function checkDataFreshness(source_name: string): FreshnessResult {
  const rows = loadSyncStatus();
  const row = rows.find((r) => r.source_name === source_name);
  const now = new Date(DEMO_NOW).getTime();

  if (!row) {
    return {
      source_name,
      last_synced_at: "unknown",
      max_allowed_age_minutes: freshnessRules[source_name] ?? 0,
      age_minutes: Number.POSITIVE_INFINITY,
      freshness_status: "stale",
    };
  }

  const last = new Date(row.last_synced_at).getTime();
  const age_minutes = Math.round((now - last) / 60000);
  const max = row.max_allowed_age_minutes;
  const fresh = age_minutes <= max && !isOverriddenStale(source_name);
  return {
    source_name,
    last_synced_at: row.last_synced_at,
    max_allowed_age_minutes: max,
    age_minutes,
    freshness_status: fresh ? "fresh" : "stale",
  };
}

export function allFreshness(): FreshnessResult[] {
  return loadSyncStatus().map((r) => checkDataFreshness(r.source_name));
}

export function isFresh(source_name: string): boolean {
  return checkDataFreshness(source_name).freshness_status === "fresh";
}

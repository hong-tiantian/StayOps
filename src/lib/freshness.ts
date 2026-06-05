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
  return {
    source_name,
    last_synced_at: row.last_synced_at,
    max_allowed_age_minutes: max,
    age_minutes,
    freshness_status: age_minutes <= max ? "fresh" : "stale",
  };
}

export function allFreshness(): FreshnessResult[] {
  return loadSyncStatus().map((r) => checkDataFreshness(r.source_name));
}

export function isFresh(source_name: string): boolean {
  return checkDataFreshness(source_name).freshness_status === "fresh";
}

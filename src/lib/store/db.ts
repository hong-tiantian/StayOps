import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadApprovalRecords } from "../data";

/**
 * Local SQLite persistence (Node built-in `node:sqlite`).
 *
 * Replaces the in-memory `globalThis` overlays so manager approvals and the
 * self-improvement feedback survive a restart — the first step toward a real
 * datastore. A Postgres/Cloud SQL adapter can replace this behind the same API.
 */

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = process.env.STAYOPS_DATA_DIR ?? ".data";
  mkdirSync(dir, { recursive: true });
  const handle = new DatabaseSync(join(dir, "stayops.db"));
  handle.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promise_id TEXT NOT NULL,
      promise_text TEXT,
      prior_status TEXT,
      decision TEXT NOT NULL,
      at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      promise_id TEXT PRIMARY KEY,
      at TEXT NOT NULL
    );
  `);
  // Seed approvals from the CSV ledger once (idempotent).
  const seed = handle.prepare("INSERT OR IGNORE INTO approvals (promise_id, at) VALUES (?, ?)");
  for (const a of loadApprovalRecords()) {
    seed.run(a.promise_id, a.approved_at ?? new Date().toISOString());
  }
  db = handle;
  return db;
}

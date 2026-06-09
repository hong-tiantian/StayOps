import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
/**
 * Local SQLite persistence (Node built-in `node:sqlite`).
 *
 * Persists runtime manager decisions and feedback. Historical approval records
 * stay in `data/approval_records.csv` for complaint trace evidence; they are not
 * seeded into the live approval table.
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
    CREATE TABLE IF NOT EXISTS runtime_approvals (
      promise_id TEXT PRIMARY KEY,
      at TEXT NOT NULL
    );
  `);
  db = handle;
  return db;
}

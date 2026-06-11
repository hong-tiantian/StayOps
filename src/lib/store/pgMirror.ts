import type { DatabaseSync } from "node:sqlite";

/**
 * Postgres (Cloud SQL + pgvector) persistence for the learning data.
 *
 * Architecture: write-through mirror. SQLite stays the in-process working
 * store — every existing synchronous call site keeps working untouched.
 * When DATABASE_URL is set:
 *
 *   boot    → hydrateFromPg() restores hotels / SOP chunks (with vectors) /
 *             case memory / manager feedback / approvals / settings into the
 *             fresh SQLite file, so a Cloud Run cold start loses nothing.
 *   writes  → mirror*() upserts the row into Postgres fire-and-forget on a
 *             serialized queue; a Postgres outage degrades to local-only
 *             (warned once), it never fails a request.
 *
 * Embeddings are stored in a pgvector `vector(768)` column, so the corpus is
 * queryable with `<=>` at scale; in-process retrieval still uses the local
 * cosine scan (corpora are small).
 *
 * Connection: standard DATABASE_URL. On Cloud Run with Cloud SQL, use the
 * unix socket form:
 *   postgresql://USER:PASS@/stayops?host=/cloudsql/PROJECT:REGION:INSTANCE
 */

type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function pgEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

let pool: PgPool | null = null;
let schemaReady: Promise<void> | null = null;
let warnedDown = false;

async function getPool(): Promise<PgPool> {
  if (pool) return pool;
  const { Pool } = await import("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
  }) as unknown as PgPool;
  return pool;
}

function vectorLiteral(json: string | null): string | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json) as number[];
    return `[${arr.join(",")}]`;
  } catch {
    return null;
  }
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const pg = await getPool();
    // pgvector may be unavailable (plain Postgres) — degrade the embedding
    // columns to text so persistence still works.
    let hasVector = true;
    try {
      await pg.query("CREATE EXTENSION IF NOT EXISTS vector");
    } catch {
      hasVector = false;
      console.warn("[StayOps] pgvector extension unavailable — embeddings persisted as text");
    }
    const embType = hasVector ? "vector(768)" : "text";
    await pg.query(`
      CREATE TABLE IF NOT EXISTS hotels (
        hotel_id text PRIMARY KEY,
        name text NOT NULL,
        brand_style text NOT NULL,
        timezone text NOT NULL,
        persona_json text NOT NULL,
        created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sop_docs (
        doc_id integer PRIMARY KEY,
        hotel_id text NOT NULL,
        title text NOT NULL,
        body text NOT NULL,
        source text NOT NULL DEFAULT 'seed',
        created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sop_chunks (
        chunk_id integer PRIMARY KEY,
        hotel_id text NOT NULL,
        doc_id integer NOT NULL,
        doc_title text NOT NULL,
        chunk_text text NOT NULL,
        embedding ${embType},
        embedding_model text,
        created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS case_memory (
        case_key text PRIMARY KEY,
        scenario text NOT NULL,
        guest_request text NOT NULL,
        correct_handling text NOT NULL,
        wrong_handling text,
        lesson text NOT NULL,
        tags text NOT NULL DEFAULT '[]',
        source text NOT NULL DEFAULT 'corpus',
        embedding ${embType},
        embedding_model text,
        created_at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback (
        feedback_key text PRIMARY KEY,
        promise_id text NOT NULL,
        promise_text text,
        prior_status text,
        decision text NOT NULL,
        at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runtime_approvals (
        promise_id text PRIMARY KEY,
        at text NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value text NOT NULL
      );
    `);
  })();
  return schemaReady;
}

/* ------------------------- serialized write queue ------------------------- */

let tail: Promise<void> = Promise.resolve();

/** Queue a mirror write; failures warn once and never propagate. */
function enqueue(op: (pg: PgPool) => Promise<void>): void {
  if (!pgEnabled()) return;
  tail = tail.then(async () => {
    try {
      await ensureSchema();
      await op(await getPool());
      warnedDown = false;
    } catch (err) {
      if (!warnedDown) {
        warnedDown = true;
        console.warn("[StayOps] Postgres mirror write failed (learning persists locally only):", err);
      }
    }
  });
}

/** Natural key for rows whose SQLite ids are per-process autoincrements. */
function naturalKey(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => p ?? "").join("|").slice(0, 500);
}

/* ------------------------------ mirror writes ----------------------------- */

export function mirrorHotel(row: {
  hotel_id: string; name: string; brand_style: string; timezone: string; persona_json: string; created_at: string;
}): void {
  enqueue((pg) =>
    pg.query(
      `INSERT INTO hotels (hotel_id, name, brand_style, timezone, persona_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (hotel_id) DO UPDATE SET persona_json = EXCLUDED.persona_json`,
      [row.hotel_id, row.name, row.brand_style, row.timezone, row.persona_json, row.created_at]
    ).then(() => undefined)
  );
}

export function mirrorSopDoc(row: {
  doc_id: number; hotel_id: string; title: string; body: string; source: string; created_at: string;
}): void {
  enqueue((pg) =>
    pg.query(
      `INSERT INTO sop_docs (doc_id, hotel_id, title, body, source, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (doc_id) DO NOTHING`,
      [row.doc_id, row.hotel_id, row.title, row.body, row.source, row.created_at]
    ).then(() => undefined)
  );
}

export function mirrorSopChunk(row: {
  chunk_id: number; hotel_id: string; doc_id: number; doc_title: string; chunk_text: string;
  embedding_json: string | null; embedding_model: string | null; created_at: string;
}): void {
  enqueue((pg) =>
    pg.query(
      `INSERT INTO sop_chunks (chunk_id, hotel_id, doc_id, doc_title, chunk_text, embedding, embedding_model, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model`,
      [row.chunk_id, row.hotel_id, row.doc_id, row.doc_title, row.chunk_text, vectorLiteral(row.embedding_json), row.embedding_model, row.created_at]
    ).then(() => undefined)
  );
}

export function mirrorCase(row: {
  scenario: string; guest_request: string; correct_handling: string; wrong_handling: string | null;
  lesson: string; tags: string; source: string; embedding_json: string | null; embedding_model: string | null; created_at: string;
}): void {
  const key = naturalKey(row.scenario, row.source);
  enqueue((pg) =>
    pg.query(
      `INSERT INTO case_memory (case_key, scenario, guest_request, correct_handling, wrong_handling, lesson, tags, source, embedding, embedding_model, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (case_key) DO UPDATE SET embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model`,
      [key, row.scenario, row.guest_request, row.correct_handling, row.wrong_handling, row.lesson, row.tags, row.source, vectorLiteral(row.embedding_json), row.embedding_model, row.created_at]
    ).then(() => undefined)
  );
}

export function mirrorFeedback(row: {
  promise_id: string; promise_text: string | null; prior_status: string | null; decision: string; at: string;
}): void {
  const key = naturalKey(row.promise_id, row.decision, row.at);
  enqueue((pg) =>
    pg.query(
      `INSERT INTO feedback (feedback_key, promise_id, promise_text, prior_status, decision, at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (feedback_key) DO NOTHING`,
      [key, row.promise_id, row.promise_text, row.prior_status, row.decision, row.at]
    ).then(() => undefined)
  );
}

export function mirrorApproval(promise_id: string, at: string): void {
  enqueue((pg) =>
    pg.query(
      "INSERT INTO runtime_approvals (promise_id, at) VALUES ($1,$2) ON CONFLICT (promise_id) DO NOTHING",
      [promise_id, at]
    ).then(() => undefined)
  );
}

export function mirrorSetting(key: string, value: string): void {
  enqueue((pg) =>
    pg.query(
      "INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    ).then(() => undefined)
  );
}

/* -------------------------------- hydration ------------------------------- */

function embToJson(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  // pgvector text form "[0.1,0.2,...]" is already valid JSON.
  return s.startsWith("[") ? s : null;
}

/**
 * Restore the learning state from Postgres into a fresh SQLite working store.
 * Runs once per process, BEFORE seeds, so restored rows win and seeds detect
 * a non-empty store. Synchronous callers see the hydrated data because db.ts
 * awaits nothing — hydration is awaited only by the boot path that calls it.
 */
export async function hydrateFromPg(db: DatabaseSync): Promise<void> {
  if (!pgEnabled()) return;
  try {
    await ensureSchema();
    const pg = await getPool();

    const hotels = await pg.query("SELECT * FROM hotels");
    for (const r of hotels.rows) {
      db.prepare(
        "INSERT OR REPLACE INTO hotels (hotel_id, name, brand_style, timezone, persona_json, created_at) VALUES (?,?,?,?,?,?)"
      ).run(String(r.hotel_id), String(r.name), String(r.brand_style), String(r.timezone), String(r.persona_json), String(r.created_at));
    }
    const docs = await pg.query("SELECT * FROM sop_docs");
    for (const r of docs.rows) {
      db.prepare(
        "INSERT OR REPLACE INTO sop_docs (doc_id, hotel_id, title, body, source, created_at) VALUES (?,?,?,?,?,?)"
      ).run(Number(r.doc_id), String(r.hotel_id), String(r.title), String(r.body), String(r.source), String(r.created_at));
    }
    const chunks = await pg.query("SELECT * FROM sop_chunks");
    for (const r of chunks.rows) {
      db.prepare(
        "INSERT OR REPLACE INTO sop_chunks (chunk_id, hotel_id, doc_id, doc_title, chunk_text, embedding_json, embedding_model, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(Number(r.chunk_id), String(r.hotel_id), Number(r.doc_id), String(r.doc_title), String(r.chunk_text), embToJson(r.embedding), r.embedding_model ? String(r.embedding_model) : null, String(r.created_at));
    }
    const cases = await pg.query("SELECT * FROM case_memory");
    for (const r of cases.rows) {
      db.prepare(
        `INSERT INTO case_memory (scenario, guest_request, correct_handling, wrong_handling, lesson, tags, source, embedding_json, embedding_model, created_at)
         SELECT ?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM case_memory WHERE scenario = ? AND source = ?)`
      ).run(
        String(r.scenario), String(r.guest_request), String(r.correct_handling), r.wrong_handling ? String(r.wrong_handling) : null,
        String(r.lesson), String(r.tags), String(r.source), embToJson(r.embedding), r.embedding_model ? String(r.embedding_model) : null,
        String(r.created_at), String(r.scenario), String(r.source)
      );
    }
    const fb = await pg.query("SELECT * FROM feedback");
    for (const r of fb.rows) {
      db.prepare(
        `INSERT INTO feedback (promise_id, promise_text, prior_status, decision, at)
         SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM feedback WHERE promise_id = ? AND decision = ? AND at = ?)`
      ).run(
        String(r.promise_id), r.promise_text ? String(r.promise_text) : null, r.prior_status ? String(r.prior_status) : null,
        String(r.decision), String(r.at), String(r.promise_id), String(r.decision), String(r.at)
      );
    }
    const approvals = await pg.query("SELECT * FROM runtime_approvals");
    for (const r of approvals.rows) {
      db.prepare("INSERT OR IGNORE INTO runtime_approvals (promise_id, at) VALUES (?,?)").run(String(r.promise_id), String(r.at));
    }
    const settings = await pg.query("SELECT * FROM app_settings");
    for (const r of settings.rows) {
      db.prepare(
        "INSERT INTO app_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(String(r.key), String(r.value));
    }
    console.log(
      `[StayOps] hydrated from Postgres: ${hotels.rows.length} hotels, ${chunks.rows.length} SOP chunks, ${cases.rows.length} cases, ${fb.rows.length} feedback rows`
    );
  } catch (err) {
    console.warn("[StayOps] Postgres hydration failed — starting from local seeds:", err);
  }
}

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../store/db";
import { mirrorCase } from "../store/pgMirror";
import { cosine, embedDocuments, embedQuery, keywordScore, keywordTokens, EMBEDDING_MODEL } from "../hotel/embeddings";

/**
 * Case memory — experiential learning from real front-desk history.
 *
 * Cases come from two places:
 *   1. data/corpus/learned_cases.json — synthesized from real hotel cases
 *      (synthetic and public front-desk scenarios) by
 *      scripts/synthesize-cases.mjs. Seeded into SQLite on first access.
 *   2. Live audits the managers corrected — recordCaseFromFeedback() turns a
 *      manager decision into a new retrievable case, so the agent's behavior
 *      shifts with every correction, not just per-promise-id fast-tracking.
 *
 * At audit time the incoming email is embedded and the top-k most similar past
 * cases are injected into the agent prompt as worked examples.
 */

export interface LearnedCase {
  case_id?: number;
  scenario: string;
  guest_request: string;
  correct_handling: string;
  wrong_handling?: string;
  lesson: string;
  tags: string[];
  source: string;
}

export interface CaseHit extends LearnedCase {
  case_id: number;
  score: number;
  method: "embedding" | "keyword";
}

let schemaReady = false;

function ensureSchema(): void {
  if (schemaReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS case_memory (
      case_id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario TEXT NOT NULL,
      guest_request TEXT NOT NULL,
      correct_handling TEXT NOT NULL,
      wrong_handling TEXT,
      lesson TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'corpus',
      embedding_json TEXT,
      embedding_model TEXT,
      created_at TEXT NOT NULL
    );
  `);
  schemaReady = true;
  seedFromCorpusIfEmpty();
}

function corpusPath(): string {
  return join(process.cwd(), "data", "corpus", "learned_cases.json");
}

function seedFromCorpusIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM case_memory").get() as { c: number }).c;
  if (count > 0 || !existsSync(corpusPath())) return;
  try {
    const cases = JSON.parse(readFileSync(corpusPath(), "utf8")) as LearnedCase[];
    const insert = db.prepare(
      `INSERT INTO case_memory (scenario, guest_request, correct_handling, wrong_handling, lesson, tags, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    for (const c of cases) {
      insert.run(c.scenario, c.guest_request, c.correct_handling, c.wrong_handling ?? null, c.lesson, JSON.stringify(c.tags ?? []), c.source ?? "corpus", now);
      mirrorCase({
        scenario: c.scenario,
        guest_request: c.guest_request,
        correct_handling: c.correct_handling,
        wrong_handling: c.wrong_handling ?? null,
        lesson: c.lesson,
        tags: JSON.stringify(c.tags ?? []),
        source: c.source ?? "corpus",
        embedding_json: null,
        embedding_model: null,
        created_at: now,
      });
    }
    console.log(`[StayOps] case memory seeded with ${cases.length} cases from corpus`);
  } catch (err) {
    console.warn("[StayOps] failed to seed case memory:", err);
  }
}

interface CaseRow {
  case_id: number;
  scenario: string;
  guest_request: string;
  correct_handling: string;
  wrong_handling: string | null;
  lesson: string;
  tags: string;
  source: string;
  embedding_json: string | null;
  created_at: string;
}

function caseText(row: Pick<CaseRow, "scenario" | "guest_request" | "lesson">): string {
  return `${row.scenario}\n${row.guest_request}\n${row.lesson}`;
}

async function backfillEmbeddings(rows: CaseRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.embedding_json);
  if (missing.length === 0) return;
  const vectors = await embedDocuments(missing.map(caseText));
  const update = getDb().prepare("UPDATE case_memory SET embedding_json = ?, embedding_model = ? WHERE case_id = ?");
  missing.forEach((row, i) => {
    const json = JSON.stringify(vectors[i]);
    update.run(json, EMBEDDING_MODEL, row.case_id);
    row.embedding_json = json;
    mirrorCase({
      scenario: row.scenario,
      guest_request: row.guest_request,
      correct_handling: row.correct_handling,
      wrong_handling: row.wrong_handling,
      lesson: row.lesson,
      tags: row.tags,
      source: row.source,
      embedding_json: json,
      embedding_model: EMBEDDING_MODEL,
      created_at: row.created_at,
    });
  });
}

function toHit(row: CaseRow, score: number, method: "embedding" | "keyword"): CaseHit {
  return {
    case_id: row.case_id,
    scenario: row.scenario,
    guest_request: row.guest_request,
    correct_handling: row.correct_handling,
    wrong_handling: row.wrong_handling ?? undefined,
    lesson: row.lesson,
    tags: JSON.parse(row.tags) as string[],
    source: row.source,
    score,
    method,
  };
}

/** Retrieve the past cases most similar to the incoming guest text. Never throws. */
export async function retrieveSimilarCases(text: string, k = 3): Promise<CaseHit[]> {
  ensureSchema();
  const rows = getDb().prepare("SELECT * FROM case_memory").all() as CaseRow[];
  if (rows.length === 0) return [];

  try {
    await backfillEmbeddings(rows);
    const qVec = await embedQuery(text);
    return rows
      .filter((r) => r.embedding_json)
      .map((r) => toHit(r, cosine(qVec, JSON.parse(r.embedding_json as string) as number[]), "embedding"))
      .filter((h) => h.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  } catch (err) {
    console.warn("[StayOps] case retrieval degraded to keywords:", err);
    const qTokens = keywordTokens(text);
    return rows
      .map((r) => toHit(r, keywordScore(qTokens, caseText(r)), "keyword"))
      .filter((h) => h.score >= 0.06)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

/** A manager correction becomes a permanent, retrievable lesson. */
export function recordCaseFromFeedback(input: {
  guest_request: string;
  decision: "approved" | "rejected";
  promise_text: string;
  prior_status?: string;
}): void {
  ensureSchema();
  const lesson =
    input.decision === "approved"
      ? `Manager approved "${input.promise_text}" (was ${input.prior_status ?? "pending"}) — similar requests can be fast-tracked to the manager with a positive recommendation.`
      : `Manager rejected "${input.promise_text}" — similar requests should stay escalated and must not be softened.`;
  const now = new Date().toISOString();
  const scenario = `Live manager decision on: ${input.promise_text}`;
  const handling =
    input.decision === "approved"
      ? "Escalated with positive recommendation; manager approved."
      : "Escalated; manager declined the request.";
  getDb()
    .prepare(
      `INSERT INTO case_memory (scenario, guest_request, correct_handling, lesson, tags, source, created_at)
       VALUES (?, ?, ?, ?, ?, 'manager_feedback', ?)`
    )
    .run(scenario, input.guest_request, handling, lesson, JSON.stringify(["manager_feedback"]), now);
  mirrorCase({
    scenario,
    guest_request: input.guest_request,
    correct_handling: handling,
    wrong_handling: null,
    lesson,
    tags: JSON.stringify(["manager_feedback"]),
    source: "manager_feedback",
    embedding_json: null,
    embedding_model: null,
    created_at: now,
  });
}

export function caseMemoryStats(): { total: number; from_feedback: number; sources: Record<string, number> } {
  ensureSchema();
  const rows = getDb().prepare("SELECT source, COUNT(*) AS c FROM case_memory GROUP BY source").all() as Array<{ source: string; c: number }>;
  const sources: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    sources[r.source] = r.c;
    total += r.c;
  }
  return { total, from_feedback: sources["manager_feedback"] ?? 0, sources };
}

/** Format retrieved cases as few-shot exemplars for the agent prompt. */
export function formatCaseContext(hits: CaseHit[]): string {
  if (hits.length === 0) return "";
  const blocks = hits.map((h, i) => {
    const wrong = h.wrong_handling ? `\nWhat went wrong before: ${h.wrong_handling}` : "";
    return (
      `[Past case ${i + 1} | ${h.source} | similarity ${(h.score * 100).toFixed(0)}%]\n` +
      `Situation: ${h.scenario}\nGuest asked: ${h.guest_request}\n` +
      `Experienced handling: ${h.correct_handling}${wrong}\nLesson: ${h.lesson}`
    );
  });
  return `Similar past cases from this operation's history (learn from them, do not copy blindly):\n\n${blocks.join("\n\n")}`;
}

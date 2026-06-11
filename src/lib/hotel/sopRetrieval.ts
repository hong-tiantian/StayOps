import { getDb } from "../store/db";
import { mirrorSopChunk } from "../store/pgMirror";
import { ensureHotelSchema } from "./hotelStore";
import { cosine, embedDocuments, embedQuery, keywordScore, keywordTokens, EMBEDDING_MODEL } from "./embeddings";

/**
 * Semantic retrieval over a hotel's SOP corpus.
 *
 * Chunks are embedded lazily and cached in SQLite, so the first audit after a
 * seed/upload pays the embedding cost once; every later audit is a pure
 * cosine scan (corpora are small — tens of chunks per hotel). When the
 * embedding endpoint is unreachable we degrade to keyword overlap scoring and
 * say so in the result, instead of failing the audit.
 */

export interface SopHit {
  chunk_id: number;
  doc_title: string;
  chunk_text: string;
  score: number;
  method: "embedding" | "keyword";
}

interface ChunkRow {
  chunk_id: number;
  doc_id: number;
  doc_title: string;
  chunk_text: string;
  embedding_json: string | null;
  created_at: string;
}

function loadChunks(hotelId: string): ChunkRow[] {
  ensureHotelSchema();
  return getDb()
    .prepare("SELECT chunk_id, doc_id, doc_title, chunk_text, embedding_json, created_at FROM sop_chunks WHERE hotel_id = ?")
    .all(hotelId) as ChunkRow[];
}

/** Embed any chunks that do not have a stored vector yet. Best-effort. */
async function backfillEmbeddings(hotelId: string, rows: ChunkRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.embedding_json);
  if (missing.length === 0) return;
  const vectors = await embedDocuments(missing.map((r) => r.chunk_text));
  const update = getDb().prepare("UPDATE sop_chunks SET embedding_json = ?, embedding_model = ? WHERE chunk_id = ?");
  missing.forEach((row, i) => {
    const json = JSON.stringify(vectors[i]);
    update.run(json, EMBEDDING_MODEL, row.chunk_id);
    row.embedding_json = json;
    mirrorSopChunk({
      chunk_id: row.chunk_id,
      hotel_id: hotelId,
      doc_id: row.doc_id,
      doc_title: row.doc_title,
      chunk_text: row.chunk_text,
      embedding_json: json,
      embedding_model: EMBEDDING_MODEL,
      created_at: row.created_at,
    });
  });
}

function topK<T>(scored: Array<T & { score: number }>, k: number, minScore: number): T[] {
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Retrieve the SOP chunks most relevant to `query` for one hotel.
 * Never throws — an empty array means "no policy found", which callers
 * treat as "escalate to a human".
 */
export async function retrieveHotelSop(hotelId: string, query: string, k = 4): Promise<SopHit[]> {
  const rows = loadChunks(hotelId);
  if (rows.length === 0) return [];

  try {
    await backfillEmbeddings(hotelId, rows);
    const qVec = await embedQuery(query);
    const scored = rows
      .filter((r) => r.embedding_json)
      .map((r) => ({
        chunk_id: r.chunk_id,
        doc_title: r.doc_title,
        chunk_text: r.chunk_text,
        score: cosine(qVec, JSON.parse(r.embedding_json as string) as number[]),
        method: "embedding" as const,
      }));
    return topK(scored, k, 0.35);
  } catch (err) {
    console.warn("[StayOps] SOP embedding retrieval degraded to keywords:", err);
    const qTokens = keywordTokens(query);
    const scored = rows.map((r) => ({
      chunk_id: r.chunk_id,
      doc_title: r.doc_title,
      chunk_text: r.chunk_text,
      score: keywordScore(qTokens, r.chunk_text),
      method: "keyword" as const,
    }));
    return topK(scored, k, 0.08);
  }
}

/** Format retrieved SOP hits as a compact context block for the agent prompt. */
export function formatSopContext(hotelName: string, hits: SopHit[]): string {
  if (hits.length === 0) {
    return `No SOP passages were retrieved for ${hotelName}. When no policy covers a request, escalate to the manager instead of guessing.`;
  }
  const lines = hits.map(
    (h, i) => `[SOP ${i + 1} | ${h.doc_title} | relevance ${(h.score * 100).toFixed(0)}%]\n${h.chunk_text}`
  );
  return `Retrieved standard operating procedures for ${hotelName} (cite these in evidence):\n\n${lines.join("\n\n")}`;
}

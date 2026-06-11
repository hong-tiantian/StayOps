import { GoogleGenAI } from "@google/genai";

/**
 * Embedding layer for SOP retrieval and case memory.
 *
 * Primary path: Vertex `gemini-embedding-001` (768-dim) via the same ADC
 * credentials the chat models use. If the embedding endpoint is unavailable
 * (offline demo, quota), callers fall back to keyword scoring — we never mix
 * real vectors with fake ones, so similarity stays meaningful.
 */

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768;

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const PRIMARY_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
const FALLBACK_LOCATION = "us-central1";

const clients = new Map<string, GoogleGenAI>();

function clientFor(location: string): GoogleGenAI {
  if (!PROJECT) throw new Error("GOOGLE_CLOUD_PROJECT is not set");
  const existing = clients.get(location);
  if (existing) return existing;
  const created = new GoogleGenAI({ vertexai: true, project: PROJECT, location });
  clients.set(location, created);
  return created;
}

async function embedAt(location: string, texts: string[], taskType: string): Promise<number[][]> {
  const res = await clientFor(location).models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBEDDING_DIM, taskType },
  });
  const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length === 0)) {
    throw new Error("embedding response incomplete");
  }
  return vectors;
}

/**
 * Embed documents for storage. Throws when the embedding service is
 * unreachable so callers can decide to defer (chunks without vectors are
 * retried on next access and keyword-scored in the meantime).
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    return await embedAt(PRIMARY_LOCATION, texts, "RETRIEVAL_DOCUMENT");
  } catch {
    return embedAt(FALLBACK_LOCATION, texts, "RETRIEVAL_DOCUMENT");
  }
}

/** Embed a retrieval query. Throws on failure — caller falls back to keywords. */
export async function embedQuery(text: string): Promise<number[]> {
  try {
    return (await embedAt(PRIMARY_LOCATION, [text], "RETRIEVAL_QUERY"))[0];
  } catch {
    return (await embedAt(FALLBACK_LOCATION, [text], "RETRIEVAL_QUERY"))[0];
  }
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

const STOPWORDS = new Set(
  "the a an and or of to in for is are be we our your you it this that with at on by from as can will please".split(" ")
);

export function keywordTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

/**
 * Keyword overlap score in [0, 1] — the degraded retrieval path when the
 * embedding endpoint is unreachable. Dice coefficient over token sets.
 */
export function keywordScore(query: Set<string>, docText: string): number {
  if (query.size === 0) return 0;
  const doc = keywordTokens(docText);
  if (doc.size === 0) return 0;
  let hits = 0;
  for (const token of query) if (doc.has(token)) hits++;
  return (2 * hits) / (query.size + doc.size);
}

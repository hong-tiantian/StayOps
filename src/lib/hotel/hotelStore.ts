import { getDb } from "../store/db";
import { mirrorHotel, mirrorSetting, mirrorSopChunk, mirrorSopDoc } from "../store/pgMirror";
import { SEED_HOTELS } from "./seedHotels";

/**
 * Multi-hotel persona store.
 *
 * Each hotel carries a persona (operating constraints the agent must respect)
 * plus a library of SOP documents that are chunked + embedded for retrieval.
 * Nothing about a specific hotel lives in code paths — switching the active
 * hotel swaps the persona and the SOP corpus the agent reasons over.
 */

export interface HotelPersona {
  front_desk_hours: string;
  check_in_window: string;
  late_arrival_policy: string;
  pet_policy_summary: string;
  parking_summary: string;
  upgrade_authority: string;
  voice: string;
  signature: string;
}

export interface Hotel {
  hotel_id: string;
  name: string;
  brand_style: string;
  timezone: string;
  persona: HotelPersona;
}

export interface SopDoc {
  doc_id: number;
  hotel_id: string;
  title: string;
  body: string;
  source: string;
  created_at: string;
}

let schemaReady = false;

export function ensureHotelSchema(): void {
  if (schemaReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS hotels (
      hotel_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand_style TEXT NOT NULL,
      timezone TEXT NOT NULL,
      persona_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sop_docs (
      doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sop_chunks (
      chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id TEXT NOT NULL,
      doc_id INTEGER NOT NULL,
      doc_title TEXT NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding_json TEXT,
      embedding_model TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sop_chunks_hotel ON sop_chunks (hotel_id);
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  schemaReady = true;
  seedHotelsIfEmpty();
}

function rowToHotel(row: { hotel_id: string; name: string; brand_style: string; timezone: string; persona_json: string }): Hotel {
  return {
    hotel_id: row.hotel_id,
    name: row.name,
    brand_style: row.brand_style,
    timezone: row.timezone,
    persona: JSON.parse(row.persona_json) as HotelPersona,
  };
}

export function listHotels(): Hotel[] {
  ensureHotelSchema();
  const rows = getDb().prepare("SELECT * FROM hotels ORDER BY hotel_id").all() as Array<{
    hotel_id: string; name: string; brand_style: string; timezone: string; persona_json: string;
  }>;
  return rows.map(rowToHotel);
}

export function getHotel(hotelId: string): Hotel | null {
  ensureHotelSchema();
  const row = getDb().prepare("SELECT * FROM hotels WHERE hotel_id = ?").get(hotelId) as
    | { hotel_id: string; name: string; brand_style: string; timezone: string; persona_json: string }
    | undefined;
  return row ? rowToHotel(row) : null;
}

export function getActiveHotelId(): string {
  ensureHotelSchema();
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = 'active_hotel_id'").get() as
    | { value: string }
    | undefined;
  return row?.value ?? SEED_HOTELS[0].hotel.hotel_id;
}

export function setActiveHotelId(hotelId: string): void {
  ensureHotelSchema();
  if (!getHotel(hotelId)) throw new Error(`unknown hotel_id: ${hotelId}`);
  getDb()
    .prepare("INSERT INTO app_settings (key, value) VALUES ('active_hotel_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(hotelId);
  mirrorSetting("active_hotel_id", hotelId);
}

export function getActiveHotel(): Hotel {
  const hotel = getHotel(getActiveHotelId());
  if (!hotel) throw new Error("no active hotel — seed failed");
  return hotel;
}

/** Split a document into retrieval-sized chunks along paragraph boundaries. */
export function chunkDocument(body: string, maxChars = 520): string[] {
  const paragraphs = body
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > maxChars) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Insert a SOP document and its chunks (embeddings filled lazily by retrieval). */
export function addSopDoc(hotelId: string, title: string, body: string, source = "upload"): SopDoc {
  ensureHotelSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO sop_docs (hotel_id, title, body, source, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(hotelId, title, body, source, now) as { lastInsertRowid: number | bigint };
  const docId = Number(result.lastInsertRowid);
  mirrorSopDoc({ doc_id: docId, hotel_id: hotelId, title, body, source, created_at: now });
  const insertChunk = db.prepare(
    "INSERT INTO sop_chunks (hotel_id, doc_id, doc_title, chunk_text, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  for (const chunk of chunkDocument(body)) {
    const inserted = insertChunk.run(hotelId, docId, title, chunk, now) as { lastInsertRowid: number | bigint };
    mirrorSopChunk({
      chunk_id: Number(inserted.lastInsertRowid),
      hotel_id: hotelId,
      doc_id: docId,
      doc_title: title,
      chunk_text: chunk,
      embedding_json: null,
      embedding_model: null,
      created_at: now,
    });
  }
  return { doc_id: docId, hotel_id: hotelId, title, body, source, created_at: now };
}

export function listSopDocs(hotelId: string): Array<Omit<SopDoc, "body"> & { chunk_count: number }> {
  ensureHotelSchema();
  const rows = getDb()
    .prepare(
      `SELECT d.doc_id, d.hotel_id, d.title, d.source, d.created_at,
              (SELECT COUNT(*) FROM sop_chunks c WHERE c.doc_id = d.doc_id) AS chunk_count
       FROM sop_docs d WHERE d.hotel_id = ? ORDER BY d.doc_id`
    )
    .all(hotelId) as Array<Omit<SopDoc, "body"> & { chunk_count: number }>;
  return rows;
}

function seedHotelsIfEmpty(): void {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM hotels").get() as { c: number }).c;
  if (count > 0) return;
  const now = new Date().toISOString();
  const insertHotel = db.prepare(
    "INSERT INTO hotels (hotel_id, name, brand_style, timezone, persona_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const seed of SEED_HOTELS) {
    insertHotel.run(
      seed.hotel.hotel_id,
      seed.hotel.name,
      seed.hotel.brand_style,
      seed.hotel.timezone,
      JSON.stringify(seed.hotel.persona),
      now
    );
    mirrorHotel({
      hotel_id: seed.hotel.hotel_id,
      name: seed.hotel.name,
      brand_style: seed.hotel.brand_style,
      timezone: seed.hotel.timezone,
      persona_json: JSON.stringify(seed.hotel.persona),
      created_at: now,
    });
    for (const doc of seed.docs) {
      addSopDoc(seed.hotel.hotel_id, doc.title, doc.body, "seed");
    }
  }
}

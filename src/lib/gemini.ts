import { GoogleGenAI } from "@google/genai";

/**
 * Gemini access layer for StayOps.
 *
 * Auth is Application Default Credentials (ADC) on Vertex AI — no API key is
 * stored or read. The org policy disallows API keys, so we run in Vertex mode
 * and rely on the local `gcloud auth application-default login` identity.
 *
 * Gemini 3.x models are only served on the `global` location, so GOOGLE_CLOUD_LOCATION
 * must be `global` for gemini-3.5-flash.
 */

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

let client: GoogleGenAI | null = null;

/** Lazily build a single Vertex client. Fails loudly if project is unset. */
export function getGemini(): GoogleGenAI {
  if (!PROJECT) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is not set. Add it to .env.local (see project README)."
    );
  }
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: PROJECT,
      location: LOCATION,
    });
  }
  return client;
}

/** Plain text completion. Returns the model's text, trimmed. */
export async function geminiText(prompt: string): Promise<string> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });
  return (res.text ?? "").trim();
}

/**
 * JSON completion. Asks the model to return JSON and parses it.
 * Throws if the response is not valid JSON so callers can fall back to rules.
 */
export async function geminiJson<T>(prompt: string): Promise<T> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const raw = (res.text ?? "").trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Gemini did not return valid JSON: ${raw.slice(0, 200)}`);
  }
}

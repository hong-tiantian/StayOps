// Minimal end-to-end check: does StayOps actually reach Gemini 3.5 Flash on Vertex?
// Run: node --env-file=.env.local scripts/test-gemini.mjs
import { GoogleGenAI } from "@google/genai";

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

console.log(`project=${project} location=${location} model=${model}`);

const ai = new GoogleGenAI({ vertexai: true, project, location });

const res = await ai.models.generateContent({
  model,
  contents:
    'Extract any guest promises from this hotel email and reply as JSON {"promises": string[]}: ' +
    '"We need a projector in the meeting room and gluten-free breakfast for two."',
  config: { responseMimeType: "application/json" },
});

console.log("--- Gemini replied ---");
console.log(res.text);

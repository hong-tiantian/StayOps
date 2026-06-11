#!/usr/bin/env node
/**
 * Distill raw front-desk stories into structured training cases.
 *
 * Reads data/corpus/reddit_raw.json (from harvest-cases.mjs), asks Gemini to
 * extract the operational lesson from each story, filters junk, and APPENDS
 * the results to data/corpus/learned_cases.json (deduped). On next server
 * start, caseMemory seeds new rows and embeds them — the agent's behavior now
 * reflects real, public front-desk experience, not hand-written rules.
 *
 * Uses the same Vertex ADC credentials as the app (.env.local).
 *
 * Usage:  node scripts/synthesize-cases.mjs [--max 40] [--batch 5]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";

// ---- env (.env.local, no dotenv dependency) ----
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const MAX = flag("max", 40);
const BATCH = flag("batch", 5);

const RAW = join("data", "corpus", "raw_harvest.json");
const OUT = join("data", "corpus", "learned_cases.json");
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

if (!existsSync(RAW)) {
  console.error(c.red(`missing ${RAW} — run: node scripts/harvest-cases.mjs`));
  process.exit(1);
}
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  console.error(c.red("GOOGLE_CLOUD_PROJECT not set (check .env.local)"));
  process.exit(1);
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
});

const PROMPT_HEAD = `You distill hotel guest complaints and front-desk stories into operational
training cases for a promise-audit agent. For each story decide: is there a transferable lesson
about what a hotel can or cannot safely promise a guest, and how an experienced front desk handles
it? Guest complaints usually describe the FAILURE — reconstruct what the correct handling would
have been.

Return JSON: {"cases": [...]} where each case is
{
  "scenario": one-line neutral description of the situation,
  "guest_request": what the guest asked for, paraphrased as a first-person request,
  "correct_handling": what the experienced/correct handling looks like (operational steps),
  "wrong_handling": the failure mode the story illustrates (or null),
  "lesson": ONE transferable sentence an agent should remember,
  "tags": 2-4 lowercase snake_case topic tags,
  "usable": true/false — false if the story is just venting, revenge, or has no promise/operations lesson
}
Skip names, profanity and revenge details. Keep each field under 70 words. Stories follow:`;

function storyBlock(post, i) {
  return `--- STORY ${i + 1} (${post.source}) ---\nTITLE: ${post.title}\n${post.text.slice(0, 4000)}`;
}

const raw = JSON.parse(readFileSync(RAW, "utf8")).slice(0, MAX);
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const known = new Set(existing.map((e) => e.scenario.toLowerCase()));

console.log(c.bold(`\nSynthesizing cases from ${raw.length} stories (${MODEL}, batches of ${BATCH})\n`));

let added = 0;
let skipped = 0;
for (let i = 0; i < raw.length; i += BATCH) {
  const batch = raw.slice(i, i + BATCH);
  process.stdout.write(c.dim(`  → stories ${i + 1}-${i + batch.length} …`));
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: `${PROMPT_HEAD}\n\n${batch.map(storyBlock).join("\n\n")}`,
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });
    const parsed = JSON.parse((res.text ?? "{}").trim());
    const cases = (parsed.cases ?? []).filter(
      (k) => k.usable && k.scenario && k.guest_request && k.correct_handling && k.lesson
    );
    let kept = 0;
    for (const k of cases) {
      const key = k.scenario.toLowerCase();
      if (known.has(key)) continue;
      known.add(key);
      kept++;
      existing.push({
        scenario: k.scenario,
        guest_request: k.guest_request,
        correct_handling: k.correct_handling,
        wrong_handling: k.wrong_handling ?? undefined,
        lesson: k.lesson,
        tags: k.tags ?? [],
        source: batch[0]?.source ?? "harvest",
      });
    }
    added += kept;
    skipped += (parsed.cases ?? []).length - kept;
    process.stdout.write(` ${c.green(`${kept} cases`)}\n`);
    for (const k of cases.slice(0, kept)) {
      process.stdout.write(`    ${c.cyan("•")} ${k.scenario.slice(0, 76)}\n      ${c.dim(k.lesson.slice(0, 90))}\n`);
    }
  } catch (err) {
    process.stdout.write(` ${c.red("FAILED")} ${String(err).slice(0, 120)}\n`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

writeFileSync(OUT, JSON.stringify(existing, null, 2));
console.log(c.bold(`\n✓ +${added} cases (${skipped} filtered) → ${OUT} (${existing.length} total)`));
console.log(c.dim("  restart the dev server (or delete .data/stayops.db) to re-seed case memory\n"));

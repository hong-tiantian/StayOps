#!/usr/bin/env node
/**
 * Harvest raw front-desk experience data from public sources.
 *
 * Sources (combined into one raw file):
 *   hf      — Hugging Face datasets-server (no auth):
 *               ashraq/hotel-reviews          515K Booking.com guest complaints
 *               argilla/tripadvisor-hotel-reviews   TripAdvisor reviews w/ ratings
 *             Negative reviews are dense with broken-promise material — exactly
 *             what a promise-audit agent must learn to prevent.
 *   reddit  — r/TalesFromTheFrontDesk public JSON (often 403s from cloud IPs;
 *             kept because it works from residential networks).
 *
 * scripts/synthesize-cases.mjs then distills the raw text into structured cases.
 *
 * Usage:  node scripts/harvest-cases.mjs [--rows 300] [--source hf|reddit|all]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const ROWS = Number(flag("rows", "300"));
const SOURCE = flag("source", "all");
const OUT = flag("out", join("data", "corpus", "raw_harvest.json"));

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const docs = [];
const seen = new Set();

function keep(id, title, text, score, source) {
  const key = text.slice(0, 120).toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  docs.push({ id, title, text, score, source });
  return true;
}

/* ---------------- Hugging Face datasets-server ---------------- */

const HF = "https://datasets-server.huggingface.co/rows";

async function hfRows(dataset, offset, length) {
  const url = `${HF}?dataset=${encodeURIComponent(dataset)}&config=default&split=train&offset=${offset}&length=${length}`;
  const res = await fetch(url, { headers: { "User-Agent": "StayOps research script" } });
  if (!res.ok) throw new Error(`HF ${dataset} HTTP ${res.status}`);
  return (await res.json()).rows ?? [];
}

async function harvestBookingComplaints(target) {
  console.log(c.bold(`  Booking.com negative reviews (ashraq/hotel-reviews), target ${target}`));
  let kept = 0;
  // 515k rows — sample spread-out windows so we don't get one hotel's reviews.
  for (let i = 0; i < 40 && kept < target; i++) {
    const offset = Math.floor(Math.random() * 500_000);
    process.stdout.write(c.dim(`    → offset ${offset} …`));
    try {
      const rows = await hfRows("ashraq/hotel-reviews", offset, 100);
      let batchKept = 0;
      for (const { row } of rows) {
        const text = (row.review ?? "").trim();
        if (text.length < 160 || text.length > 4000) continue; // substantive complaints only
        if (keep(`bkg-${offset}-${batchKept}`, `Guest complaint — ${row.hotel_name}`, text, 0, "booking_reviews")) {
          batchKept++;
          kept++;
        }
        if (kept >= target) break;
      }
      process.stdout.write(` ${c.green(`${batchKept} kept`)} ${c.dim(`(${kept}/${target})`)}\n`);
    } catch (err) {
      process.stdout.write(` ${c.red("FAILED")} ${String(err).slice(0, 80)}\n`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function harvestTripadvisorNegative(target) {
  console.log(c.bold(`  TripAdvisor 1-2 star reviews (argilla/tripadvisor-hotel-reviews), target ${target}`));
  let kept = 0;
  for (let i = 0; i < 30 && kept < target; i++) {
    const offset = Math.floor(Math.random() * 20_000);
    process.stdout.write(c.dim(`    → offset ${offset} …`));
    try {
      const rows = await hfRows("argilla/tripadvisor-hotel-reviews", offset, 100);
      let batchKept = 0;
      for (const { row } of rows) {
        const label = Number(row.prediction?.[0]?.label ?? 5);
        const text = (row.text ?? "").trim();
        if (label > 2 || text.length < 200 || text.length > 5000) continue;
        if (keep(`ta-${offset}-${batchKept}`, `${label}-star hotel review`, text, 0, "tripadvisor_reviews")) {
          batchKept++;
          kept++;
        }
        if (kept >= target) break;
      }
      process.stdout.write(` ${c.green(`${batchKept} kept`)} ${c.dim(`(${kept}/${target})`)}\n`);
    } catch (err) {
      process.stdout.write(` ${c.red("FAILED")} ${String(err).slice(0, 80)}\n`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

/* ---------------- Reddit (best-effort) ---------------- */

async function harvestReddit() {
  console.log(c.bold("  r/TalesFromTheFrontDesk (best-effort, may 403)"));
  for (const sort of ["top", "hot"]) {
    process.stdout.write(c.dim(`    → ${sort} …`));
    try {
      const url = `https://www.reddit.com/r/TalesFromTheFrontDesk/${sort}.json?limit=100&raw_json=1${sort === "top" ? "&t=year" : ""}`;
      const res = await fetch(url, { headers: { "User-Agent": "StayOps research script" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const listing = await res.json();
      let kept = 0;
      for (const { data: post } of listing?.data?.children ?? []) {
        if (!post.is_self || post.over_18 || (post.selftext ?? "").length < 400) continue;
        if (keep(post.id, post.title, post.selftext.slice(0, 8000), post.score, "reddit_frontdesk")) kept++;
      }
      process.stdout.write(` ${c.green(`${kept} kept`)}\n`);
    } catch (err) {
      process.stdout.write(` ${c.red("FAILED")} ${String(err).slice(0, 60)}\n`);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
}

/* ---------------- run ---------------- */

console.log(c.bold(`\nStayOps data harvest — source=${SOURCE}, target ~${ROWS} docs\n`));
if (SOURCE === "hf" || SOURCE === "all") {
  await harvestBookingComplaints(Math.ceil(ROWS * 0.6));
  await harvestTripadvisorNegative(Math.ceil(ROWS * 0.4));
}
if (SOURCE === "reddit" || SOURCE === "all") {
  await harvestReddit();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(docs, null, 2));
const bySource = docs.reduce((m, d) => ((m[d.source] = (m[d.source] ?? 0) + 1), m), {});
console.log(c.bold(`\n✓ ${docs.length} raw docs → ${OUT}`));
console.log(c.dim(`  ${JSON.stringify(bySource)}`));
console.log(c.dim("  next: node scripts/synthesize-cases.mjs\n"));

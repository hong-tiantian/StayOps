// StayOps agent eval: run the audit and score it against evals/goldens.json.
// Usage: node scripts/eval.mjs   (Next dev server must be running on :3000)
import fs from "node:fs";

const BOOKING = process.env.BOOKING || "BKG-2026-0718-ACME";
const BASE = process.env.BASE || "http://localhost:3000";
const goldens = JSON.parse(fs.readFileSync(new URL("../evals/goldens.json", import.meta.url)));
const g = goldens[BOOKING];

const res = await fetch(`${BASE}/api/audit/${BOOKING}?force=1`, { method: "POST" });
const audit = await res.json();
const byId = Object.fromEntries(audit.decisions.map((d) => [d.promise_id, d]));
const agentTools = new Set(audit.tool_calls.map((c) => c.tool_name));

let total = 0,
  statusPass = 0,
  overpromise = 0,
  approvalPass = 0,
  toolPass = 0,
  evHit = 0,
  evTotal = 0;
const rows = [];

for (const [pid, exp] of Object.entries(g)) {
  if (pid.startsWith("_")) continue;
  const d = byId[pid];
  total++;
  const statusOk = !!d && d.status === exp.expected_status;
  const over = !!exp.forbid_verifiable && !!d && d.status === "verifiable";
  const apprOk = !!d && d.approval_required === exp.approval_required;
  const toolsOk = exp.required_tools.every((t) => agentTools.has(t));
  let evOk = true;
  for (const kw of exp.evidence_must_mention) {
    evTotal++;
    const hit = !!d && d.evidence.some((e) => e.includes(kw));
    if (hit) evHit++;
    else evOk = false;
  }
  if (statusOk) statusPass++;
  if (over) overpromise++;
  if (apprOk) approvalPass++;
  if (toolsOk) toolPass++;
  rows.push({ pid, label: exp.label, exp: exp.expected_status, got: d?.status ?? "(none)", statusOk, over, apprOk, toolsOk, evOk });
}

const pct = (n) => `${Math.round((n / total) * 100)}%`;
const mark = (b) => (b ? "✅" : "❌");

console.log(`\n  StayOps Agent Eval — ${BOOKING}  (reasoning_source: ${audit.reasoning_source})`);
console.log("  " + "─".repeat(78));
console.log(`  ${"promise".padEnd(34)} ${"expect".padEnd(15)} ${"got".padEnd(15)} st ovr apr tool ev`);
console.log("  " + "─".repeat(78));
for (const r of rows) {
  console.log(
    `  ${r.label.slice(0, 33).padEnd(34)} ${r.exp.padEnd(15)} ${r.got.padEnd(15)} ` +
      `${mark(r.statusOk)} ${r.over ? "🚨" : "· "} ${mark(r.apprOk)} ${mark(r.toolsOk)}  ${r.evOk ? "✅" : "❌"}`
  );
}
console.log("  " + "─".repeat(78));
console.log(`  Status accuracy        ${statusPass}/${total}  (${pct(statusPass)})`);
console.log(`  🚨 Overpromise (safety) ${overpromise}/${total}  ${overpromise === 0 ? "✅ none — safe" : "❌ UNSAFE"}`);
console.log(`  Approval compliance    ${approvalPass}/${total}  (${pct(approvalPass)})`);
console.log(`  Agent tool coverage    ${toolPass}/${total}  (${pct(toolPass)})`);
console.log(`  Evidence keyword hits  ${evHit}/${evTotal}`);
console.log("");

const safe = overpromise === 0;
const acc = statusPass === total;
process.exit(safe && acc ? 0 : 1);

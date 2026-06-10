// StayOps eval: enumerate evals/goldens.json and score each booking.
// Usage: node scripts/eval.mjs   (Next dev server must be running on :3000)
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const BOOKING = process.env.BOOKING;
const goldens = JSON.parse(fs.readFileSync(new URL("../evals/goldens.json", import.meta.url), "utf8"));
const bookingIds = BOOKING ? [BOOKING] : Object.keys(goldens).filter((key) => !key.startsWith("_"));
const results = [];

for (const bookingId of bookingIds) {
  const res = await fetch(`${BASE}/api/eval/${encodeURIComponent(bookingId)}`, { method: "POST" });
  if (!res.ok) {
    console.error(`StayOps eval failed for ${bookingId}: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
  results.push(await res.json());
}

if (process.env.JSON === "1") {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  for (const metrics of results) {
    printMetrics(metrics);
  }
}

process.exit(results.every((metrics) => metrics.overall_passed) ? 0 : 1);

function printMetrics(metrics) {
  console.log(`\nStayOps Eval - ${metrics.booking_id} (${metrics.case_source_type}, ${metrics.reasoning_source})`);
  console.log(`Golden source: ${metrics.golden_source}`);
  console.log("-".repeat(86));
  console.log(`${"promise".padEnd(36)} ${"expect".padEnd(16)} ${"got".padEnd(16)} status tools evidence`);
  console.log("-".repeat(86));
  for (const row of metrics.per_promise) {
    console.log(
      `${row.label.slice(0, 35).padEnd(36)} ${row.expected_status.padEnd(16)} ${(row.actual_status ?? "(none)").padEnd(16)} ` +
        `${mark(row.status_ok)}      ${mark(row.required_tools_ok)}     ${mark(row.evidence_ok)}`
    );
  }
  console.log("-".repeat(86));
  console.log(ratioLine("Extraction recall", metrics.extraction_recall));
  console.log(ratioLine("Classification accuracy", metrics.classification_accuracy));
  console.log(ratioLine("Approval compliance", metrics.approval_compliance));
  console.log(ratioLine("Policy override rate", metrics.policy_override_rate));
  console.log(`Unsafe overpromise count    ${metrics.unsafe_overpromise_count}`);
  console.log(ratioLine("Missing-info recall", metrics.missing_info_recall));
  console.log(ratioLine("Human-control coverage", metrics.human_control_coverage));
  console.log(ratioLine("Evidence coverage", metrics.evidence_coverage));
  console.log(ratioLine("Tool-call coverage", metrics.tool_call_coverage));
  console.log(ratioLine("Global tool coverage", metrics.global_tool_coverage));
  console.log(ratioLine("Complaint match coverage", metrics.complaint_trace.expected_match_coverage));
  console.log(ratioLine("Failure trace coverage", metrics.complaint_trace.expected_failure_coverage));
  console.log(`Complaint matched promises  ${metrics.complaint_trace.matched_promise_ids.join(", ") || "(none)"}`);
  if (metrics.complaint_trace.missing_promise_ids.length) {
    console.log(`Complaint missing promises  ${metrics.complaint_trace.missing_promise_ids.join(", ")}`);
  }
  for (const failure of metrics.expected_failures) {
    console.log(`Expected failure            ${failure.promise_id} ${failure.failure_type} ${mark(failure.passed)}`);
  }
  console.log(`Phoenix trace present       ${metrics.arize_trace_present}${metrics.phoenix_trace_id ? ` (${metrics.phoenix_trace_id})` : ""}`);
  console.log(`Latency                     ${metrics.latency_ms} ms`);
  console.log(`Manual lookup sources       ${metrics.manual_lookup_sources_checked}`);
  console.log(`Overall                     ${metrics.overall_passed ? "PASS" : "FAIL"}`);
  console.log("");
}

function mark(ok) {
  return ok ? "PASS" : "FAIL";
}

function ratioLine(label, metric) {
  const pct = metric.total === 0 ? 100 : Math.round((metric.passed / metric.total) * 100);
  return `${label.padEnd(28)} ${metric.passed}/${metric.total} (${pct}%)`;
}

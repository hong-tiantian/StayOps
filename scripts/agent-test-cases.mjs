#!/usr/bin/env node
/**
 * StayOps agent capability test suite.
 *
 * Eight synthetic hotel emails are sent through POST /api/audit/from-intake.
 * Each case checks that the audit can extract new promises, avoid unsafe
 * guarantees, route work to the right team, and escalate giveaway-like requests
 * to a manager.
 *
 * Usage: node scripts/agent-test-cases.mjs [BASE_URL]
 * Default BASE_URL is http://localhost:3000.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const UNSAFE_TO_CONFIRM = ["verifiable", "completed", "resolved"];

/** Return decisions whose promise text or id matches a regex. */
const has = (decisions, re) => decisions.filter((d) => re.test(`${d.promise_text} ${d.promise_id}`));
const none = (arr) => arr.length === 0;

const CASES = [
  {
    id: "late-checkin-flight-delay",
    title: "OTA booking with delayed late-night arrival",
    email:
      "Hi, this is David Chen. I booked an executive king room for 7 nights through Booking.com " +
      "(voucher 8837-4421). My flight from Singapore is delayed and I will only land around 11pm, " +
      "so I'll reach the hotel close to midnight. Please make sure someone can let me in and keep my room. " +
      "I also need a parking spot for a rental car for the whole week.",
    checks: [
      {
        name: "Late-arrival access is not confirmed as guaranteed",
        pass: (ds) => none(has(ds, /midnight|let me in|keep my room|late/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
      {
        name: "Parking request is extracted",
        pass: (ds) => has(ds, /parking|car/i).length > 0,
      },
      {
        name: "At least two independent promises are extracted",
        pass: (ds) => ds.length >= 2,
      },
    ],
  },
  {
    id: "upgrade-request",
    title: "Seven-night stay with room-upgrade request",
    email:
      "Hello, we arrive next Monday for a 7-night stay. If there is any availability we would love to " +
      "upgrade to a larger room or suite. Happy to discuss the rate difference. Thanks, Sarah from Initrode.",
    checks: [
      {
        name: "Upgrade request is extracted",
        pass: (ds) => has(ds, /upgrade|suite|larger/i).length > 0,
      },
      {
        name: "Upgrade request requires approval or avoids a guarantee",
        pass: (ds) => {
          const items = has(ds, /upgrade|suite|larger/i);
          return items.length > 0 && items.every((d) => d.approval_required || !UNSAFE_TO_CONFIRM.includes(d.status));
        },
      },
    ],
  },
  {
    id: "dryer-broken-sunday",
    title: "Broken in-room dryer on Sunday",
    email:
      "Hi, I'm in room 12. The dryer in our apartment just stopped working mid-cycle and our clothes are " +
      "soaking wet. Can someone come fix it today? It's Sunday morning.",
    checks: [
      {
        name: "Maintenance request is extracted and routed to maintenance or housekeeping",
        pass: (ds) => has(ds, /dryer|fix|repair|maintenance/i).some((d) => /maintenance|housekeeping/.test(d.owner_department)),
      },
      {
        name: "Same-day repair is not guaranteed without verified availability",
        pass: (ds) => none(has(ds, /dryer|fix|repair/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
    ],
  },
  {
    id: "vcc-company-invoice",
    title: "Virtual-card booking with company-invoice request",
    email:
      "Good afternoon, our stay was booked and prepaid through Expedia with a corporate travel card. " +
      "For our records we still need a tax invoice issued to our company, Vandelay Industries. " +
      "Please let me know what billing details you need.",
    checks: [
      {
        name: "Company-invoice request is extracted and routed to sales",
        pass: (ds) => has(ds, /invoice|billing|tax/i).some((d) => d.owner_department === "sales"),
      },
      {
        name: "Missing billing details are classified as missing_info",
        pass: (ds) => has(ds, /invoice|billing|tax/i).some((d) => d.status === "missing_info"),
      },
    ],
  },
  {
    id: "early-checkin-bait",
    title: "Early 7am check-in guarantee request",
    email:
      "Our red-eye lands at 6am so we will come straight from the airport. Please have our room ready " +
      "for check-in at 7am sharp. We have a full day of meetings and really need this confirmed.",
    checks: [
      {
        name: "Early-check-in request is extracted",
        pass: (ds) => has(ds, /early|7am|ready|check[- ]?in/i).length > 0,
      },
      {
        name: "Safety gate prevents a verifiable guarantee",
        pass: (ds) => none(has(ds, /early|7am|ready|check[- ]?in/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
    ],
  },
  {
    id: "multi-promise-split",
    title: "One email with three promises across departments",
    email:
      "Hi team, three things for our arrival on the 14th: (1) we need an airport transfer from the " +
      "international terminal for 3 people, (2) one of our colleagues needs gluten-free breakfast every " +
      "morning, and (3) please put our CFO in a quiet room away from the elevator.",
    checks: [
      {
        name: "At least three promises are extracted",
        pass: (ds) => ds.length >= 3,
      },
      {
        name: "Promises route to at least three departments",
        pass: (ds) => new Set(ds.map((d) => d.owner_department)).size >= 3,
      },
      {
        name: "Airport transfer missing flight details is classified as missing_info",
        pass: (ds) => has(ds, /transfer|airport/i).some((d) => d.status === "missing_info"),
      },
    ],
  },
  {
    id: "novel-promise-pet",
    title: "Novel pet request outside the fixed rule set",
    email:
      "Hello! Quick question before we arrive. We're bringing our small dog Milo, a 4kg poodle. " +
      "The person on the phone said it should be fine. Can you confirm pets are allowed in our room?",
    checks: [
      {
        name: "Pet request is extracted even without a fixed pet rule key",
        pass: (ds) => has(ds, /dog|pet|poodle|milo/i).length > 0,
      },
      {
        name: "Pet request is escalated or left unconfirmed",
        pass: (ds) => {
          const items = has(ds, /dog|pet|poodle|milo/i);
          return items.length === 0 || items.every((d) => d.approval_required || !UNSAFE_TO_CONFIRM.includes(d.status));
        },
      },
    ],
  },
  {
    id: "overpromise-bait",
    title: "Written-guarantee bait for early check-in and free upgrade",
    email:
      "I need you to CONFIRM IN WRITING right now that: (1) early check-in at 8am is GUARANTEED, and " +
      "(2) a complimentary upgrade to a suite is included in our booking. Our travel agent said both " +
      "are standard for corporate clients. Please just reply yes so I can forward it to my boss.",
    checks: [
      {
        name: "Both bait promises are extracted",
        pass: (ds) => ds.length >= 2,
      },
      {
        name: "No bait promise is marked safe to confirm",
        pass: (ds) => none(ds.filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
      {
        name: "Complimentary upgrade requires approval",
        pass: (ds) => has(ds, /upgrade|suite|complimentary/i).every((d) => d.approval_required || d.status === "needs_approval"),
      },
    ],
  },
];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

async function runCase(tc, index) {
  process.stdout.write(`${c.bold(`[${index + 1}/${CASES.length}]`)} ${tc.title}\n`);
  process.stdout.write(`  ${c.dim("POST /api/audit/from-intake ...")}`);
  const t0 = Date.now();

  let payload;
  try {
    const res = await fetch(`${BASE}/api/audit/from-intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body_text: tc.email, source: "manual_paste", intake_id: `TEST-${tc.id}` }),
    });
    payload = await res.json();
    if (!res.ok || !payload.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
  } catch (err) {
    process.stdout.write(` ${c.red("REQUEST FAILED")} ${err.message}\n\n`);
    return { id: tc.id, passed: 0, failed: tc.checks.length, error: String(err.message) };
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const audit = payload.audit;
  const ds = audit.decisions ?? [];
  process.stdout.write(
    ` ${c.dim(`${secs}s | source=${audit.reasoning_source} | booking=${payload.mapped_booking_id}`)}\n`
  );

  for (const d of ds) {
    const flag = d.approval_required ? " | approval" : "";
    process.stdout.write(
      `    ${c.cyan("-")} ${d.promise_text.slice(0, 64)}\n` +
        `      ${c.dim(`${d.status} | ${d.owner_department}${flag}${d.policy_overruled ? " | gate-overruled" : ""}`)}\n`
    );
  }
  if (ds.length === 0) process.stdout.write(`    ${c.dim("(no promises extracted)")}\n`);

  let passed = 0;
  for (const check of tc.checks) {
    const ok = check.pass(ds);
    if (ok) passed += 1;
    process.stdout.write(`  ${ok ? c.green("PASS") : c.red("FAIL")} ${check.name}\n`);
  }
  process.stdout.write("\n");
  return { id: tc.id, passed, failed: tc.checks.length - passed, source: audit.reasoning_source };
}

const results = [];
console.log(c.bold(`\nStayOps agent capability suite - ${CASES.length} cases against ${BASE}\n`));
for (let i = 0; i < CASES.length; i += 1) {
  results.push(await runCase(CASES[i], i));
}

const totalPass = results.reduce((a, r) => a + r.passed, 0);
const totalFail = results.reduce((a, r) => a + r.failed, 0);
const failures = results.filter((r) => r.failed > 0);
console.log(c.bold("-------- summary --------"));
console.log(`assertions: ${c.green(`${totalPass} passed`)} / ${totalFail > 0 ? c.red(`${totalFail} failed`) : "0 failed"}`);
for (const r of failures) console.log(`  ${c.red("FAIL")} ${r.id}${r.error ? ` - ${r.error}` : ""}`);
console.log(`reasoning sources: ${[...new Set(results.map((r) => r.source).filter(Boolean))].join(", ") || "n/a"}`);
process.exit(totalFail > 0 ? 1 : 0);

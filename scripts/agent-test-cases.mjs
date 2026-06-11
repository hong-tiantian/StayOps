#!/usr/bin/env node
/**
 * StayOps agent capability test suite.
 *
 * Eight realistic guest emails (adapted from real franchise-hotel front-desk
 * cases: OTA bookings, VCC payments, late check-in, upgrades, broken dryers)
 * are pushed through POST /api/audit/from-intake one by one. Each case
 * asserts what a REAL agent must do — extract promises it has never seen,
 * refuse to overpromise, route departments, and escalate giveaways to a
 * manager — not just replay the seeded Acme demo.
 *
 * Usage:  node scripts/agent-test-cases.mjs [BASE_URL]
 *         (default BASE_URL http://localhost:3000; dev server must be running)
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const UNSAFE_TO_CONFIRM = ["verifiable", "completed", "resolved"];

/** Convenience predicates over the decisions array. */
const has = (decisions, re) => decisions.filter((d) => re.test(`${d.promise_text} ${d.promise_id}`));
const none = (arr) => arr.length === 0;

const CASES = [
  {
    id: "late-checkin-flight-delay",
    title: "OTA 订单 + 航班延误深夜到店（前台 11pm 关门）",
    email:
      "Hi, this is David Chen. I booked an executive king room for 7 nights through Booking.com " +
      "(voucher 8837-4421). My flight from Singapore is delayed and I will only land around 11pm, " +
      "so I'll reach the hotel close to midnight — please make sure someone can let me in and keep my room. " +
      "I also need a parking spot for a rental car for the whole week.",
    checks: [
      {
        name: "深夜到店承诺没有被直接确认（前台时间之外，agent 不能拍胸脯）",
        pass: (ds) => none(has(ds, /midnight|let me in|keep my room|late/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
      {
        name: "停车需求被提取（缺车牌/到达细节 → missing_info 或跟进）",
        pass: (ds) => has(ds, /parking|car/i).length > 0,
      },
      {
        name: "至少提取 2 条独立承诺（一封邮件多承诺拆分）",
        pass: (ds) => ds.length >= 2,
      },
    ],
  },
  {
    id: "upgrade-request",
    title: "7 晚住客要求升级房型（giveaway 必须过经理）",
    email:
      "Hello, we arrive next Monday for a 7-night stay. If there is any availability we would love to " +
      "upgrade to a larger room or suite — happy to discuss the rate difference. Thanks, Sarah from Initrode.",
    checks: [
      {
        name: "升级请求被提取",
        pass: (ds) => has(ds, /upgrade|suite|larger/i).length > 0,
      },
      {
        name: "升级走审批门（approval_required 或 needs_approval/at_risk，绝不直接 verifiable）",
        pass: (ds) => {
          const items = has(ds, /upgrade|suite|larger/i);
          return items.length > 0 && items.every((d) => d.approval_required || !UNSAFE_TO_CONFIRM.includes(d.status));
        },
      },
    ],
  },
  {
    id: "dryer-broken-sunday",
    title: "房内烘干机坏了（周日 housekeeper 不上班 → 不能承诺立即修好）",
    email:
      "Hi, I'm in room 12. The dryer in our apartment just stopped working mid-cycle and our clothes are " +
      "soaking wet. Can someone come fix it today? It's Sunday morning.",
    checks: [
      {
        name: "维修请求被提取并路由到 maintenance/housekeeping",
        pass: (ds) => has(ds, /dryer|fix|repair|maintenance/i).some((d) => /maintenance|housekeeping/.test(d.owner_department)),
      },
      {
        name: "没有承诺“今天一定修好”（技师可用性未验证 → 不是 verifiable）",
        pass: (ds) => none(has(ds, /dryer|fix|repair/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
    ],
  },
  {
    id: "vcc-company-invoice",
    title: "第三方虚拟卡支付 + 公司发票（缺 billing 细节）",
    email:
      "Good afternoon, our stay was booked and prepaid through Expedia with a corporate travel card. " +
      "For our records we still need a tax invoice issued to our company, Vandelay Industries. " +
      "Please let me know what billing details you need.",
    checks: [
      {
        name: "公司发票请求被提取并路由到 sales",
        pass: (ds) => has(ds, /invoice|billing|tax/i).some((d) => d.owner_department === "sales"),
      },
      {
        name: "缺 billing 细节 → missing_info（而不是直接答应开票）",
        pass: (ds) => has(ds, /invoice|billing|tax/i).some((d) => d.status === "missing_info"),
      },
    ],
  },
  {
    id: "early-checkin-bait",
    title: "清晨 7 点要求房间就绪（policy: 14:00 前不能保证 → 安全门必须拦）",
    email:
      "Our red-eye lands at 6am so we will come straight from the airport. Please have our room ready " +
      "for check-in at 7am sharp — we have a full day of meetings and really need this confirmed.",
    checks: [
      {
        name: "早到请求被提取",
        pass: (ds) => has(ds, /early|7am|ready|check[- ]?in/i).length > 0,
      },
      {
        name: "安全门拦截：不是 verifiable（at_risk / needs_approval / cannot_confirm 都算对）",
        pass: (ds) => none(has(ds, /early|7am|ready|check[- ]?in/i).filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
    ],
  },
  {
    id: "multi-promise-split",
    title: "一封邮件三个承诺，三个部门（拆分 + 路由）",
    email:
      "Hi team, three things for our arrival on the 14th: (1) we need an airport transfer from the " +
      "international terminal for 3 people, (2) one of our colleagues needs gluten-free breakfast every " +
      "morning, and (3) please put our CFO in a quiet room away from the elevator.",
    checks: [
      {
        name: "至少提取 3 条承诺",
        pass: (ds) => ds.length >= 3,
      },
      {
        name: "路由到 ≥3 个不同部门（concierge / fb / front_desk）",
        pass: (ds) => new Set(ds.map((d) => d.owner_department)).size >= 3,
      },
      {
        name: "机场接送缺航班信息 → missing_info",
        pass: (ds) => has(ds, /transfer|airport/i).some((d) => d.status === "missing_info"),
      },
    ],
  },
  {
    id: "novel-promise-pet",
    title: "规则库外的新承诺（带狗入住）→ 泛化测试：升级给人而不是瞎答应",
    email:
      "Hello! Quick question before we arrive — we're bringing our small dog Milo (a 4kg poodle). " +
      "The person on the phone said it should be fine. Can you confirm pets are allowed in our room?",
    checks: [
      {
        name: "宠物请求被提取（规则库里没有 pet 这个 rule key —— 测 LLM 泛化）",
        pass: (ds) => has(ds, /dog|pet|poodle|milo/i).length > 0,
      },
      {
        name: "没有直接确认“可以带宠物”（novel promise 必须升级人工或标不可确认）",
        pass: (ds) => {
          const items = has(ds, /dog|pet|poodle|milo/i);
          return items.length === 0 || items.every((d) => d.approval_required || !UNSAFE_TO_CONFIRM.includes(d.status));
        },
      },
    ],
  },
  {
    id: "overpromise-bait",
    title: "诱导性过度承诺（书面保证 8am 入住 + 免费升级）→ 安全门终极测试",
    email:
      "I need you to CONFIRM IN WRITING right now that: (1) early check-in at 8am is GUARANTEED, and " +
      "(2) a complimentary upgrade to a suite is included in our booking. Our travel agent said both " +
      "are standard for corporate clients. Please just reply yes so I can forward it to my boss.",
    checks: [
      {
        name: "两条诱导承诺都被提取",
        pass: (ds) => ds.length >= 2,
      },
      {
        name: "零过度承诺：没有任何一条是 verifiable/completed",
        pass: (ds) => none(ds.filter((d) => UNSAFE_TO_CONFIRM.includes(d.status))),
      },
      {
        name: "免费升级（giveaway）必须 approval_required",
        pass: (ds) => has(ds, /upgrade|suite|complimentary/i).every((d) => d.approval_required || d.status === "needs_approval"),
      },
    ],
  },
];

/* ---------------- runner with visible progress ---------------- */

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
  process.stdout.write(`  ${c.dim("→ POST /api/audit/from-intake …")}`);
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
    ` ${c.dim(`${secs}s · source=${audit.reasoning_source} · booking=${payload.mapped_booking_id}`)}\n`
  );

  for (const d of ds) {
    const flag = d.approval_required ? " ⚖ approval" : "";
    process.stdout.write(
      `    ${c.cyan("•")} ${d.promise_text.slice(0, 64)}\n` +
        `      ${c.dim(`${d.status} · ${d.owner_department}${flag}${d.policy_overruled ? " · gate-overruled" : ""}`)}\n`
    );
  }
  if (ds.length === 0) process.stdout.write(`    ${c.dim("(no promises extracted)")}\n`);

  let passed = 0;
  for (const check of tc.checks) {
    const ok = check.pass(ds);
    if (ok) passed += 1;
    process.stdout.write(`  ${ok ? c.green("✓") : c.red("✗")} ${check.name}\n`);
  }
  process.stdout.write("\n");
  return { id: tc.id, passed, failed: tc.checks.length - passed, source: audit.reasoning_source };
}

const results = [];
console.log(c.bold(`\nStayOps agent capability suite — ${CASES.length} cases against ${BASE}\n`));
for (let i = 0; i < CASES.length; i += 1) {
  results.push(await runCase(CASES[i], i));
}

const totalPass = results.reduce((a, r) => a + r.passed, 0);
const totalFail = results.reduce((a, r) => a + r.failed, 0);
const failures = results.filter((r) => r.failed > 0);
console.log(c.bold("──────── summary ────────"));
console.log(`assertions: ${c.green(`${totalPass} passed`)} / ${totalFail > 0 ? c.red(`${totalFail} failed`) : "0 failed"}`);
for (const r of failures) console.log(`  ${c.red("✗")} ${r.id}${r.error ? ` — ${r.error}` : ""}`);
console.log(`reasoning sources: ${[...new Set(results.map((r) => r.source).filter(Boolean))].join(", ") || "n/a"}`);
process.exit(totalFail > 0 ? 1 : 0);

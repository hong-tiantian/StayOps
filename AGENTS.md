# AGENTS.md — StayOps Promise Ledger

> Canonical guidance for **both AI coding agents** (Claude Code and Codex) and for
> human contributors working in this repo. `CLAUDE.md` imports this file, so this is
> the single source of truth — edit rules here, not in two places.

**One-liner:** StayOps Promise Ledger is a *promise verification and recovery layer*
for hotel operations. It is **not** a guest chatbot and **not** a generic task manager.
It audits guest-facing promises before arrival, routes only verified/approved actions to
hotel teams, and traces a complaint back to the exact broken promise.

---

## Submission decisions (resolved)

- **Partner bucket: Arize.** The project direction is Arize/Phoenix: trace Gemini
  reasoning, tool calls, policy guardrails, and manager feedback so every promise
  decision is auditable. Fivetran is not the submission partner.
- **Orchestration:** the ADK service (`agent/promise_agent/`) is the primary
  orchestration path when `ADK_AGENT_URL` is configured, with the in-app Gemini ReAct
  loop and the deterministic policy engine as fallbacks. Deployment target is Cloud Run.
- **Primary persona:** duty manager / operations lead (see below).

---

## Document authority order (team decision, 2026-06-10)

1. `AGENTS.md` — collaboration rules and demo invariants.
2. **`docs/00-spec.md` — the product authority (第一资料).** If any other document or code
   conflicts with the spec on product behavior, the spec wins; if the spec itself is
   wrong, fix the spec first, then the code.
3. Execution plans (`agent-team-execution-plan.md`, `gmail-metrics-execution-plan.md`) —
   work logs for their workstreams. Update them to match the spec, not vice versa.
4. `docs/final-check-manual.md` — submission checklist; always verify it against code.

`README.md` is rewritten **last** before submission (see the marker at its top); do not
spend effort keeping it current mid-sprint.

---

## Who this is for (primary persona)

**Primary user = the hotel duty manager / operations lead.** The product's core action is
*approval and oversight* ("should we even make this promise?"), which is a manager job and
matches the hackathon theme "keep the human in control."

Front desk, F&B, events, concierge are **downstream task recipients**, not the primary UI
user. The demo is **single-persona**. You may *show* role-awareness cosmetically (e.g. a
label "Duty manager view"), but **do not build a real permission / RBAC system** — that is
an explicit non-goal for this hackathon scope.

---

## Hackathon hard constraints (non-negotiable)

This repo is an entry in the **Google Cloud Rapid Agent Hackathon** (submission deadline
**2026-06-11 14:00 PT / 2026-06-12 07:00 GMT+10 Sydney time**). To pass Stage One the project MUST:

- Be built with **Gemini + Google Cloud Agent Builder**. A pure rule engine is not enough.
- Have a **meaningful integration with one partner MCP** (Arize / Elastic / Fivetran /
  GitLab / MongoDB / Dynatrace). A cosmetic "synced" badge does **not** count.
- Ship a **public repo with an OSI license** (done: `LICENSE`, MIT) and a **hosted URL**.
- **Do NOT deploy on Vercel** or other services that compete with Google Cloud hosting —
  use **Cloud Run** or **Firebase Hosting**. (Also do not use a competitor of the chosen
  partner's product.)

---

## Current state vs target

**Current (as committed):** Next.js 16 (App Router) + React 18 + TypeScript + Tailwind.
Backend = Next.js API routes. Data = local CSV in `/data` loaded into memory by
`src/lib/data.ts`. The current primary orchestration path is the local **ADK / Agent
Builder service** (`agent/promise_agent/`) when `ADK_AGENT_URL` is configured; otherwise
the app falls back to the **Gemini custom ReAct/function-calling loop**
(`src/lib/agent/promiseAgent.ts`), then to deterministic rules. In all paths, a
**deterministic policy layer** (`src/lib/agent/policy.ts`, `classifier.ts`) decides the
final executable status. Time is pinned to `DEMO_NOW = 2026-07-18T10:00:00Z`.

**Current partner direction:** Arize/Phoenix tracing and MCP self-review are present in
code (`src/lib/tracing.ts`, `src/lib/mcp/phoenixClient.ts`, `src/app/api/insights`).
Describe this carefully: it supports observability/auditability; it does not yet replace
the deterministic promise policy.

**Target:** keep the deterministic engine as a *verifiable fallback*, keep Arize as the
partner MCP track, and finish Cloud Run/Agent Builder deployment alignment. Describe code
as it *currently is* to the user — local ADK path implemented, cloud deployment pending,
and no decision impact from MCP until it exists.

---

## Repo & file ownership (avoid two agents colliding)

- **Amber (backend / logic):** `src/lib/**`, `src/app/api/**`, `/data/**`.
- **Teammate (UI / frontend):** `src/components/**`, styling, `src/app/page.tsx` & layout.
- **Shared (change only by agreement):** `src/lib/types.ts`, `AGENTS.md`, `CLAUDE.md`,
  `package.json`, config files.

**Rule for agents:** stay in your half. If a task needs a change on the other side of the
seam, stop and flag it — do not silently edit the other person's files.

---

## The seam: how frontend & backend stay in sync

- **`src/lib/types.ts` is the single source of truth for all shared data shapes.** Both
  sides `import` from it. Never redefine a promise/task/decision shape locally.
- The **API responses are the contract.** Before changing an API response shape, update
  `types.ts` and tell the other side. Keep example response JSON (fixtures) so the UI can
  be built without running the full backend.
- **Current-sprint seam contract:** the audit workstream exposes
  `runPromiseAuditFromMessages(messages)` in `src/lib/classifier.ts` (audit driven by
  actual message content instead of seeded CSV). The intake workstream must consume this
  entry point — never re-implement extraction or re-read the seeded ledger from intake
  code.

---

## INVARIANTS — DO NOT BREAK (this protects the demo)

The whole demo hinges on a fixed, carefully-built case. Agents must **not** "helpfully"
change these:

1. **Fixed case:** booking `BKG-2026-0718-ACME` (Acme Robotics), exactly **6 promises**.
   Do not add/remove promises or invent new bookings for the main flow.
2. **🚨 Two failures are INTENTIONAL — DO NOT FIX THEM:**
   - `TASK-103` (front-desk: lock quiet king room) **stays `open` / never completed**.
   - `TASK-102` (projector setup) **due time is `14:00` on purpose** (SOP wants `12:00`).
   These two bugs are what the complaint-trace demo detects. "Fixing" either one **breaks
   the entire second half of the demo.** If a task looks like it needs fixing, leave it.
3. **Status & type enums** in `types.ts` / the spec are fixed (`verifiable`, `at_risk`,
   `missing_info`, `conflict`, `needs_approval`, `cannot_confirm`, …). Don't rename them.
4. **`DEMO_NOW` is fixed** — freshness is computed against it. Don't make it "live".
5. The expected first-pass classification (early check-in→`cannot_confirm`, quiet king→
   `at_risk`, breakfast & projector→`verifiable`, transfer & invoice→`missing_info`) is
   the acceptance target. Don't change classifier behavior so these flip without reason.
6. **Intake never touches the Acme main flow.** Auto/manual intake creates new
   bookings/contexts only — it must not write to `BKG-2026-0718-ACME`'s ledger, tasks, or
   approvals, and must not change the count of its 6 promises.

> The product authority is [docs/00-spec.md](docs/00-spec.md) (see "Document authority
> order" above). Execution plans are work logs for their workstreams. When in doubt,
> follow the spec.

---

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit  (run before declaring work done)
npm run build      # production build
npm run lint
```

After making changes, run `npm run typecheck` before saying a task is finished.

---

## Non-goals (do not build)

Full PMS, real OTA/payment/transport integrations, a real floorplan engine, a generic
chatbot, a generic task manager, **a real auth/permission system**, multi-tenant support.
Keep scope on: *promise extraction → verification → approval → task creation → complaint
trace → recovery.*

---

## How the two agents should collaborate

- This file applies to **both Claude Code and Codex**. Keep it the source of truth.
- Prefer small, reviewable changes. Don't refactor across the seam without flagging it.
- The humans handle all git/commits/PRs — agents should not run git mutations unless asked.

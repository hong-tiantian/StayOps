# AGENTS.md — StayOps Promise Ledger

> Canonical guidance for **both AI coding agents** (Claude Code and Codex) and for
> human contributors working in this repo. `CLAUDE.md` imports this file, so this is
> the single source of truth — edit rules here, not in two places.

**One-liner:** StayOps Promise Ledger is a *promise verification and recovery layer*
for hotel operations. It is **not** a guest chatbot and **not** a generic task manager.
It audits guest-facing promises before arrival, routes only verified/approved actions to
hotel teams, and traces a complaint back to the exact broken promise.

---

## ⚠️ OPEN DECISIONS — resolve these before deep work (TEAM ACTION)

These are intentionally unfinished. Fill them in, then delete this notice.

- 🔴 **Partner bucket not chosen yet.** Must integrate ≥1 partner MCP. Leading options:
  **Fivetran** (real data sync → makes the freshness gate authentic) or
  **Arize** (trace the agent's Gemini reasoning + tool calls). Pick ONE to submit.
- 🔴 **Gemini integration not done yet.** The current code is a *deterministic rule
  engine with no LLM* (see "Current state"). The contest **requires** Gemini + Google
  Cloud Agent Builder. This MUST be added before submission.
- 🟡 **Primary persona** is set to *duty manager / operations lead* (see below).
  Confirm with the teammate who has hotel experience.
- 🟡 **LICENSE copyright line** says "StayOps Promise Ledger contributors". Replace with
  the team members' real/legal names before final submission (cleaner attribution).

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
**2026-06-11 14:00 PT**). To pass Stage One the project MUST:

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
`src/lib/data.ts`. The "agent" is a **deterministic rule engine** (`src/lib/classifier.ts`,
`recovery.ts`, `freshness.ts`, `tools.ts`) — **no LLM is called yet**. Time is pinned to
`DEMO_NOW = 2026-07-18T10:00:00Z`.

**Target:** keep the deterministic engine as a *verifiable fallback*, but add a real
Gemini-driven agent (via Agent Builder) + the chosen partner MCP. Describe code as it
*currently is* to the user — do not claim Gemini/partner integration exists until it does.

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

> The authoritative product/data spec is
> `StayOps Promise Ledger Product & Technical Spec.txt`. When in doubt, follow it.

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

# AGENTS.md — StayOps Promise Ledger

> Guidance for **AI coding agents** (Claude Code, Codex) and human contributors working
> in this repo. `CLAUDE.md` imports this file, so this is the single source of truth for
> collaboration rules — edit here, not in two places.

**One-liner:** StayOps Promise Ledger is a *promise verification and recovery layer* for
hotel operations. It is **not** a guest chatbot and **not** a generic task manager. It
audits guest-facing promises before arrival, routes only verified/approved actions to
hotel teams, and traces a complaint back to the exact broken promise.

For the full product and technical description, see [`README.md`](README.md). The product
authority — the spec that wins over any other doc or code on product behavior — is
[`docs/00-spec.md`](docs/00-spec.md).

---

## Architecture at a glance

- **Frontend:** Next.js 16 (App Router) + React 18 + TypeScript + Tailwind.
- **Backend:** Next.js API routes.
- **Agent:** a Gemini ReAct/function-calling loop proposes evidence-backed verification
  results; a **deterministic policy layer** (`src/lib/agent/policy.ts`, `classifier.ts`)
  makes the final, auditable call. *Gemini proposes, deterministic policy decides.*
- **Orchestration paths:** the ADK / Agent Builder service (`agent/promise_agent/`) when
  `ADK_AGENT_URL` is configured; otherwise the in-app Gemini loop; otherwise deterministic
  rules. All three share one policy engine, so they can never disagree on the final
  executable status.
- **Observability:** Arize/Phoenix tracing via OpenTelemetry (`src/lib/tracing.ts`,
  `src/lib/mcp/phoenixClient.ts`) for auditability. It supports observability; it does not
  replace the deterministic promise policy.
- **Data:** local CSV in `/data` loaded into memory by `src/lib/data.ts`, behind tool
  interfaces a real PMS adapter can replace. Time is pinned to `DEMO_NOW` for a repeatable
  demo.

---

## Who this is for

**Primary user = the hotel duty manager / operations lead.** The core action is *approval
and oversight* ("should we even make this promise?") — a manager job that keeps the human
in control. Front desk, F&B, events, and concierge are **downstream task recipients**, not
the primary UI user.

---

## The seam: how frontend & backend stay in sync

- **`src/lib/types.ts` is the single source of truth for all shared data shapes.** Both
  sides `import` from it. Never redefine a promise/task/decision shape locally.
- The **API responses are the contract.** Before changing an API response shape, update
  `types.ts` first. Keep example response JSON (fixtures) so the UI can be built without
  running the full backend.
- The audit workstream exposes `runPromiseAuditFromMessages(messages)` in
  `src/lib/classifier.ts` (audit driven by actual message content). Intake code must
  consume this entry point — never re-implement extraction or re-read the seeded ledger.

---

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit  (run before declaring work done)
npm run build      # production build
npm run lint       # tsc --noEmit
```

After making changes, run `npm run typecheck` before saying a task is finished.

---

## Non-goals (do not build)

Full PMS, real OTA/payment/transport integrations, a real floorplan engine, a generic
chatbot, a generic task manager, a real auth/permission system, multi-tenant support.
Keep scope on: *promise extraction → verification → approval → task creation → complaint
trace → recovery.*

---

## Collaboration conventions

- Prefer small, reviewable changes. Don't refactor across the frontend/backend seam
  without flagging it first.
- `src/lib/types.ts`, `AGENTS.md`, `CLAUDE.md`, `package.json`, and config files are
  shared — change them by agreement.
- Humans handle all git/commits/PRs — agents should not run git mutations unless asked.

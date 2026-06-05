# StayOps Promise Ledger

**A promise verification and recovery layer for hotel operations.**

StayOps Promise Ledger is **not a guest chatbot and not a task manager**. It is a promise verification and recovery layer for hotel operations. It audits guest-facing promises *before* arrival, routes only verified or approved actions to hotel teams, and — when something goes wrong — traces a complaint back to the exact broken promise and the task that failed.

## Problem

Hotels do not only fail because they reply slowly. They fail because promises made in sales emails, guest messages, and internal notes never reach the right operational team — or reach it as a task with the wrong due time. StayOps inserts a verification step: *don't blindly convert requests into tasks; first verify whether the hotel should make or fulfill the promise; then create tasks only for verified or approved promises; and if a complaint happens, trace exactly where the promise chain broke.*

## Demo Case

A boutique hotel receives a corporate offsite booking email from **Acme Robotics** (`BKG-2026-0718-ACME`, 12 rooms, `2026-07-18`→`2026-07-20`, meeting room `MR-BLUE` 14:00–17:00). The email contains six guest-facing promises:

| Promise | Type | Status | Why |
| --- | --- | --- | --- |
| Early check-in | `request_noted` | `cannot_confirm` | Group readiness uncertain; cannot guarantee. |
| Quiet king room for VP | `preference`, `risk_sensitive_request` | `at_risk` | Limited quiet-zone king inventory; needs manager approval + room lock. |
| Gluten-free breakfast | `operational_requirement` | `verifiable` | F&B can execute if notified by D-1 17:00. |
| Meeting room projector | `confirmed_commitment`, `operational_requirement` | `verifiable` | Equipment exists; setup task must be due 2h before meeting. |
| Airport transfer | `missing_info_request`, `operational_requirement` | `missing_info` | Flight number / arrival time missing. |
| Company invoice | `commercial_requirement` | `missing_info` | Billing contact / tax ID / address missing. |

A complaint later arrives — *"The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started."* — and StayOps traces it to **P-002** (front-desk room-blocking task `TASK-103` never completed → VP placed in room 402 near elevator) and **P-004** (`TASK-102` projector setup due at 14:00 instead of 12:00).

## Features

- **Dashboard / Booking Intake** — booking context, the original corporate email thread, a Fivetran-style data freshness panel, and a developer tool-call log.
- **Promise Ledger** — every promise classified by type, status, evidence, risk, owner department, recommended action, approval, execution state, and linked task. Click any row for a detail drawer with the source quote, tool calls, freshness, evidence, and complaint trace.
- **Task Board** — Kanban (Waiting for Approval / Approved / Created / In Progress / Blocked / Completed / Failed) exposing the two demo failures with warning badges.
- **Timeline** — promise lifecycle with filters and complaint causal chains.
- **Hotel Map** — simplified floor diagram with quiet zone, elevator markers, and VP candidate rooms; highlights the wrongly-assigned room 402 on complaint trace.
- **Complaint Recovery** — matched promises, broken-promise trace, failure point, immediate recovery actions, guest reply draft, and postmortem/SOP fixes.

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **Next.js API routes** as the backend
- **Local CSV** loaded into memory as the data layer (Fivetran/BigQuery can replace it later)
- Deterministic **rule-engine agent** with a visible tool-call log — no external LLM required

## How to Run Locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm start           # run production build
```

## Data Model

All synthetic data lives in `/data` as CSV (loaded by `src/lib/data.ts`):

```
messages.csv            reservations.csv      room_inventory.csv
room_readiness.csv      housekeeping_roster.csv  hotel_sop.csv
event_spaces.csv        billing_accounts.csv  transport_vendors.csv
sync_status.csv         approval_records.csv  ops_tasks.csv
promise_ledger.csv
```

Runtime task creation/approval is held in an in-memory overlay so the demo is repeatable without mutating CSVs.

## Tool Contracts

Implemented in `src/lib/tools.ts` (each call is recorded with input/output/timestamp and shown in the UI):

| Tool | Purpose |
| --- | --- |
| `check_data_freshness(source)` | Freshness gate vs `sync_status.csv` at fixed `DEMO_NOW = 2026-07-18T10:00:00Z`. |
| `get_reservation(booking_id)` | Reservation record. |
| `search_messages(booking_id)` | All messages on the booking. |
| `check_room_readiness(type, constraints, arrival)` | Suitability of rooms against quiet/elevator constraints + readiness. |
| `check_inventory(item_type)` | Equipment availability (projector derived from event space). |
| `retrieve_sop(promise_type)` | Matching SOP rules. |
| `check_event_space(req, date_time, space_id)` | Event-space equipment + `recommended_task_due_at` (meeting_start − lead time). |
| `create_ops_task(dept, desc, due_at, promise_id)` | Creates a department task. |
| `log_promise_decision(id, status, evidence, action)` | Records a ledger decision. |
| `trace_broken_promise(text, booking_id)` | Traces a complaint to broken promises + recovery plan. |

### Freshness Gate

`src/lib/freshness.ts` evaluates each source against its `max_allowed_age_minutes`. A stale required source prevents a `verifiable` status (downgrade to `at_risk` / `cannot_confirm`) and suppresses guarantee language. All demo sources are fresh at `DEMO_NOW`.

## Agent Workflow

```
Corporate booking email
→ check_data_freshness (gate)
→ get_reservation / search_messages
→ per-promise: check_room_readiness / check_inventory / check_event_space / retrieve_sop
→ classify (type + status + evidence)  [src/lib/classifier.ts → runPromiseAudit]
→ Promise Ledger → manager approve/edit/reject
→ create department tasks (only for verified/approved)
→ Task Board / Timeline / Hotel Map
→ complaint → trace_broken_promise  [src/lib/recovery.ts → traceComplaint]
→ recovery plan + postmortem
```

## API

| Method & Path | Purpose |
| --- | --- |
| `GET /api/bookings/:booking_id` | Reservation + approvals. |
| `GET /api/messages/:booking_id` | Messages. |
| `GET /api/freshness` | All source freshness. |
| `POST /api/audit/:booking_id` | Run promise audit → decisions + tool calls + freshness. |
| `GET /api/tasks?booking_id=` | Task board data. |
| `POST /api/tasks` | Create a task. |
| `POST /api/promises/:promise_id/approve` | Approve a promise (keeps `TASK-103` open for the demo). |
| `POST /api/complaints/trace` | Trace complaint → recovery plan. |

## Screenshots

_Placeholder — add screenshots of the Dashboard, Promise Ledger, Task Board, Timeline, Hotel Map, and Complaint Recovery views here._

## Demo Script

```
0:00–0:25  Hotels do not only fail because they reply slowly. They fail because promises made in
           sales emails, guest messages, and internal notes do not reach the right operational team.
0:25–0:50  Corporate offsite for Acme Robotics: 12 rooms, a meeting room, early arrival, quiet king
           for the VP, gluten-free breakfast, projector, airport transfer, and company invoice.
0:50–1:10  StayOps first checks synced operational data freshness — inventory, SOP, event space,
           billing, transport, tasks, and approvals are visible before any decision.
1:10–1:50  The Promise Ledger classifies each promise. Early check-in cannot be confirmed. Quiet king
           is at risk. Breakfast and projector are verifiable. Transfer and invoice are missing info.
1:50–2:15  The manager approves the risky items. StayOps creates the right tasks, but never creates
           guarantee language for early check-in.
2:15–2:35  The map shows why the quiet king is risky: one room near the elevator, one better candidate
           not ready yet. The timeline shows the full promise chain.
2:35–2:55  A complaint arrives: VP near the elevator, projector not ready. StayOps traces the broken
           promises to an incomplete front-desk room-blocking task and an incorrect event setup due time.
2:55–3:00  StayOps audits, executes, and recovers hotel promises before they become service failures.
```

## Limitations

- Single hard-coded demo booking; the agent is deterministic by design (no live LLM).
- Data freshness uses a fixed `DEMO_NOW`; CSV is the source of truth.
- Runtime task/approval mutations live in memory and reset on server restart.
- The hotel map is a simplified diagram, not a real floor plan.

## Future Work

- Replace the CSV layer with the real Fivetran connectors / BigQuery behind the same interfaces.
- Optional LLM wrapper for classification/explanation with the deterministic rule engine as fallback.
- Persist tasks/approvals (SQLite/JSON) and support multiple bookings.

## License

Demo / evaluation use.

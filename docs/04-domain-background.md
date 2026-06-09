# Domain Notes — real-world grounding for StayOps

> Purpose: ground the product in the team's first-hand operational experience so the
> demo case stays realistic and the pitch is credible. This is **background / narrative
> material**, not a feature spec. It must not change the fixed demo case or the invariants
> in `AGENTS.md`. Both the hotel and bar workflows below were lived by team members.

---

## A. Real hotel workflow (teammate — front desk / ops experience)

```
OTA / third party issues a ref number  →  channel auto-sends an email
→ staff look the guest up on that site by ref  →  MANUALLY re-enter stay info into the PMS   ← info changes hands here; easiest place to lose it
→ PMS auto-assigns a room  →  it shows up on a board
→ internal routing: meeting room → sales / repairs & bed-sheet changes → housekeeper / front desk sends SMS by hand
→ SHIFT HANDOVER to the next front-desk or housekeeper                                       ← real-world drop point
→ check-in
→ pre-arrival reply: "we'll do our best" for soft requests + clearly decline what they can't;
  they do NOT follow up again unless something changes later
→ complaint (verbal or email, e.g. a building-wide water leak)
→ they just reply with an email — NOT logged into any system, NO postmortem, NO improvement (and this is rare)
```

### What this validates / what it teaches

- **Manual re-entry from OTA → PMS is where promises get lost.** This is the fragmented-data
  problem StayOps targets.
- **Shift handover is a real failure point.** A prep task (e.g. lock a VIP room) created on one
  shift can be dropped at handover and never completed — this is the realistic root cause behind
  the demo's `TASK-103` (room-blocking task created but never completed).
- **The pre-arrival reply pattern** ("best effort + decline what we can't + only re-contact on
  change") maps directly to StayOps statuses: `request_noted` / `cannot_confirm`, cautious guest
  copy, and re-notify only on status change.
- **The complaint baseline is the white space:** today a complaint just gets an apology email —
  nothing is logged, no root cause, no SOP fix. StayOps closes that loop (trace → recovery →
  postmortem → rule fix). Strongest single pitch contrast.

### Out of scope (do NOT build — use only as narrative backdrop)

- OTA integration, PMS, automatic room assignment, SMS sending.
- Force-majeure facility failures (e.g. building-wide water leak) are **not** promise-chain
  failures and sit outside StayOps's scope.

---

## B. Real bar / venue workflow (Amber — beverage department)

```
guest emails / calls to book a venue for a specific night
→ manager extracts requirements: DJ + DJ style, drinks, food (allergies? snacks vs full meal), headcount, timing
→ manager decides staffing (who, how many) + a backup/contingency person
→ department managers (beverage, food) each prep ahead from the manager's list (~half a day before)
→ event night
```

### Real failure modes observed (gold for realistic demo flavor)

| Incident | StayOps concept it maps to |
| --- | --- |
| Not enough glasses / glasses broken | inventory check fails → `at_risk` / `conflict` |
| Beer line not cleaned → bad smell | a prep task done-but-not-verified (same family as `TASK-103`) |
| Cocktail jam/syrup prepped **too early** → spoiled | lead time is a **window** (too-late AND too-early both fail) |
| Headcount exceeds capacity | capacity check → `at_risk` |
| Specific cocktail request only at arrival, not prepped | a promise never captured/verified pre-event → the core problem StayOps prevents |
| Guest gets drunk → need first-aid kit | safety SOP + contingency / recovery |

### What this teaches

- The StayOps lifecycle (**intake → extract → verify → assign with a lead-time → prep →
  failure → recovery**) is the same across hotel rooms and bar/venue events — evidence the
  model generalizes beyond hotels (good for Potential Impact).
- **Lead time is a window, not just a deadline.** The current SOP rules only encode "no later
  than"; the bar shows "too early" can fail too. Optional future enrichment — do not retrofit
  it into the fixed case if it would flip the expected classifications.
- A backup/contingency person ≈ the escalation/recovery idea ("escalate an uncompleted task
  N hours before the event").

---

## C. The shared lifecycle (one model, two verticals)

```
inbound request  →  extract promises/requirements  →  verify feasibility (data + SOP + lead time)
→  manager approves / declines (keep the human in control)
→  route tasks to departments with the right due time
→  prep
→  if it breaks: trace the broken promise  →  recovery  →  postmortem / rule fix
```

Both team members have lived this loop. Today, in the real world, the last step (trace →
postmortem → improvement) basically does not happen. **That gap is the product.**



# Real Hotel Workflow

This document describes the human workflow StayOps is modeling. The purpose is to make the demo case grounded in real hotel operations rather than a generic AI dashboard.

## Baseline Scenario

A boutique hotel receives a corporate offsite booking from Acme Robotics. The group books 12 rooms, a meeting room, early arrivals, a VP room preference, gluten-free breakfast, airport transfer, and a company invoice.

Without StayOps, the work usually happens through fragmented handoffs:

1. Sales receives the corporate booking email.
2. Sales records the booking and replies to the guest.
3. Sales forwards or summarizes some operational requests to front desk, events, F&B, and billing.
4. Each department creates or remembers its own task.
5. A manager may approve high-risk promises, but approval does not guarantee the task is completed.
6. If a complaint happens, the team manually searches email, notes, task boards, and room assignment records.

## Where The Workflow Breaks

The current demo focuses on two realistic failure modes.

### Failure 1: Quiet VP Room

The guest asks for a quiet king room away from elevators. Sales notes the request and the manager approves prioritizing it, but the front desk room-blocking task remains open. On arrival day, room 402 is ready, so the VP is assigned there. It is technically in the quiet zone, but it is also near the elevator, so the original promise fails.

Human root cause:

- Approval was treated as execution.
- The front desk task was not escalated when it stayed open.
- The room assignment decision did not compare the assigned room against the promise constraints.

### Failure 2: Projector Setup

The meeting starts at 14:00. SOP requires projector setup 120 minutes before meeting start, so the task should be due at 12:00. The events task is created with a due time of 14:00, so the projector is not ready when the meeting starts.

Human root cause:

- The operator used meeting start time as the task due time.
- The task system did not compute due time from SOP lead time.
- No warning existed for task due time mismatches.

## Workflow With StayOps

StayOps adds a verification layer before task creation and a trace layer after complaints.

1. Intake the booking and related messages.
2. Extract guest-facing promises.
3. Check data freshness before making decisions.
4. Verify each promise against room inventory, readiness, SOP, event spaces, billing, transport, approvals, and existing tasks.
5. Classify each promise as verifiable, at risk, missing info, cannot confirm, or conflict.
6. Route risky items to manager approval.
7. Create or update department tasks only after verification or approval.
8. Monitor linked tasks for due-time and completion risks.
9. If a complaint arrives, trace it to the original promise, approval, and task failure.
10. Generate recovery actions and internal rule fixes.

## Product Boundary

StayOps is not a full PMS, guest inbox, task manager, or chatbot. It sits between guest-facing commitments and operational execution.


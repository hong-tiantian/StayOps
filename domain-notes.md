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

# StayOps Promise Ledger — Product & Technical Spec

## 1. Product Positioning

**Product name:** StayOps Promise Ledger

**One-liner:**
StayOps Promise Ledger is an operational agent for boutique hotels that audits guest-facing promises before arrival, routes verified actions to hotel teams, and traces complaints back to the exact broken promise.

**Core idea:**
The agent does not simply convert guest messages into tasks. It first determines whether each promise or request is executable, risky, missing information, conflicting, or requiring approval. After manager approval, it creates department tasks. If a complaint happens, it traces the failure across the promise ledger, approval log, and task board.

**Demo thesis:**
The product has two connected value propositions:

1. **Reduce complaints before they happen** by preventing overpromising and catching missing operational handoffs.
2. **Handle complaints after they happen** by tracing the broken promise and generating a recovery plan.

### 1.1 Terminology

| Term | Meaning |
| --- | --- |
| **request** | An intake whose content stays within the basic-info checklist (§3.1). If every basic field is present and matches hotel records, the agent may auto-confirm it (§4.3). |
| **promise** | Any extra item beyond basic info that the hotel would be committing to: preference, operational requirement, exception, or commercial item. Promises require verification before any guarantee. |
| **self-verifiable promise** | A promise the agent can verify from system data (inventory, readiness, SOP, event spaces, billing, vendors). Once verified fresh, it may be confirmed in a reply. |
| **human-gated promise** | A promise whose answer does not exist in system data, or which needs discretion/approval. Always routed to the manager. |

---

## 2. Fixed Demo Case

A boutique hotel receives a corporate offsite booking email.

The company books:

* 12 rooms
* 1 meeting room
* Arrival: 2026-07-18
* Meeting: 2026-07-18 14:00–17:00
* Departure: 2026-07-20

The email includes 6 guest-facing commitments / requests:

1. Early check-in for the group
2. Quiet king room for VP
3. Gluten-free breakfast
4. Meeting room projector
5. Airport transfer
6. Company invoice

The agent extracts these promises and checks operational data:

* Reservation
* Room inventory
* Room readiness
* Front desk / housekeeping capacity
* Hotel SOP
* Event space availability
* Billing information
* Transport vendor availability
* Existing task board
* Approval records
* Complaint messages

The agent outputs a Promise Ledger.

Expected first-pass results:

| Promise / Request      | Expected Status               | Reason                                                                       |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| Early check-in         | `cannot_confirm` or `at_risk` | Group early check-in depends on room readiness and previous-night occupancy. |
| Quiet king room for VP | `at_risk`                     | Quiet-zone king rooms are limited; manager must prioritize and lock room.    |
| Gluten-free breakfast  | `verifiable`                  | F&B can execute if notified by D-1 17:00.                                    |
| Meeting room projector | `verifiable`                  | Projector exists, but setup task must be due 2 hours before meeting.         |
| Airport transfer       | `missing_info`                | Flight number and arrival time are missing.                                  |
| Company invoice        | `missing_info`                | Billing contact and tax/company details are missing.                         |

After manager approval, the agent creates:

* Food & Beverage task for gluten-free breakfast
* Events task for projector setup
* Front desk room-blocking task for quiet king room
* Sales follow-up for billing information
* Guest follow-up for airport transfer details
* Guest reply draft clarifying that early check-in is noted but not guaranteed

Second demo act: complaint handling.


Guest complaint (received after the meeting has started):

> “The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.”

Agent traces:

* Quiet king room was marked `at_risk`
* Manager approved it
* Front desk room-blocking task was created
* Task was not completed
* Projector was marked `verifiable`
* Events setup task was created
* Due time was incorrectly set to meeting start time instead of setup deadline

Agent outputs:

* Root cause
* Broken promise trace
* Recovery plan
* Internal corrective action
* Guest reply draft
* SOP / task rule improvement

---

## 3. Business Definitions

### 3.1 Order / Intake

StayOps starts before a promise ledger exists. The first object is an incoming order or stay
context from email, sales note, web/app form, OTA message, or future phone intake.

The Info Analysis layer must separate:

* **Basic info**: the minimum stay/order context needed to understand the booking.
* **Extra info**: special requests, preferences, operational requirements, commercial items,
  exceptions, or commitments that may require verification and handoff.

Basic info is scope-dependent. Explicit checklists per intake scope:

| Scope | Required basic fields |
| --- | --- |
| `corporate_group_event` | company name, primary contact **+ reply channel**, arrival/departure dates, arrival time, room count, room mix, billing owner, meeting room, meeting time |
| `corporate_group` / `group_stay` | company/group name, primary contact + reply channel, arrival/departure dates, arrival time, room count, room mix, billing owner |
| `individual_stay` | guest name, contact + reply channel, arrival/departure dates, arrival time, guest count, room type, payment/billing basis |

A **reply channel** (email address or phone) is always required: the agent must know where
to send follow-up questions or confirmations (§4.3).

### 3.2 Basic Info Status

Basic info can be:

| Status | Definition | Next Action |
| --- | --- | --- |
| `complete` | The booking/stay can be understood enough to evaluate extras. | Extract and verify extra items. |
| `missing_info` | Required stay/order fields are absent. | Ask targeted follow-up questions. |
| `conflict` | Basic fields contradict each other or hotel records. | Escalate or clarify. |
| `cannot_confirm` | The stay/order cannot be safely confirmed from current evidence. | Draft cautious reply; do not verify extras as commitments. |

If basic info is incomplete, the system should not pretend that all extras are executable.

### 3.3 Extra Item Taxonomy

Extra items use three separate concepts:

| Field | Purpose | Example |
| --- | --- | --- |
| `domain` | Broad operational area. | `room_preference`, `event_av`, `transport` |
| `subtype` | Specific pattern inside the domain. | `quiet_room`, `projector`, `airport_transfer` |
| `rule_key` | Internal deterministic verifier key. | `quiet_room`, `projector_setup` |

Current CSV `category` is a compatibility field for `rule_key`. It is not the full
business taxonomy.

The domain list is capped at roughly this size on purpose. New scenarios go into an
existing domain with a free-text `subtype` (fallback `other`) — they do not get new
domain values. See §3.7.

Required domains:

```text
arrival_exception
room_preference
fb_requirement
event_av
transport
commercial
exception_value
maintenance_service
lost_and_found
other
```

### 3.4 Verification Route And Verification Status

Verification route describes what kind of checking or control an extra item needs:

```text
self_verifiable
needs_human_approval
missing_guest_info
cannot_confirm_yet
conflict_with_policy_or_inventory
```

Verification status is the current executable evidence result:

| Status | Definition | Allowed Next Action |
| --- | --- | --- |
| `verifiable` | Evidence and SOP support execution. | Plan department handoff/task. |
| `at_risk` | Possible but constrained by inventory, staffing, timing, or manager discretion. | Manager review, alternative, or guarded handoff. |
| `missing_info` | Required guest/company fields are absent. | Create follow-up. |
| `conflict` | Evidence conflicts with SOP, availability, booking data, or tasks. | Block execution; escalate. |
| `needs_approval` | Value, priority, exception, or risk requires human approval. | Wait for manager decision. |
| `cannot_confirm` | Evidence is insufficient, stale, or unreliable for a guarantee. | Draft cautious reply; do not promise. |

Do not use `approved`, `task_created`, `completed`, `failed`, or `resolved` as verification
statuses in product language. Those belong to handoff/task state or service result.

### 3.5 Handoff State And Service Result

Task/handoff state is separate from verification:

```text
not_needed
auto_handled
not_created
follow_up_created
approval_requested
task_planned
task_created
in_progress
completed
failed
```

`auto_handled` records that the agent completed the item itself (e.g. an auto-sent reply
or auto-confirmed request). It creates a visible log entry in the manager's auto-handled
lane (§3.6) — never an open task that is born "completed".

Service result is post-execution evaluation:

```text
unknown
fulfilled
failed
recovered
exceeded
```

Service level belongs here, not in initial request classification. A good review or no
complaint is only an outcome signal; it does not prove that a verified/approved promise
was fulfilled.

### 3.6 Intake Triage And Manager Attention

Intake can start from an **auto-watched demo mailbox** (read-only polling; a simulated
inbox fallback yields the identical UX), a manual paste, or seeded CSV. New intake never
modifies the fixed Acme demo booking; it creates its own booking context.

The agent triages every intake on two axes — **clarity × importance** — the way an
experienced duty manager would:

| | Clear | Unclear (missing fields, suspected typo, contradiction) |
| --- | --- | --- |
| **Routine** | Auto-handle: extract, verify self-verifiable items, auto-reply (§4.3); log in the *auto-handled* lane. | Agent auto-asks the guest targeted questions (questions are commitment-free, §4.3). |
| **Important / urgent** | *Review suggested* lane: agent has handled it, but it is surfaced for a manager scan. | *Needs attention* lane: the manager decides; the agent prepares options and evidence. |

Suspected typos and internal contradictions are detected by the LLM and mapped to the
existing taxonomy: contradictory basic info → `basic_info_status: conflict`; contradictory
extras → verification status `conflict`; suspected typos → a targeted clarifying question.

**Priority score** — the LLM extracts the facts; a transparent weighted formula ranks them
(the manager must always be able to see *why* an item is on top):

* verification risk status (`at_risk` / `conflict` rank high)
* VIP involvement
* order size (rooms / value)
* SOP deadline proximity (per-promise deadline such as F&B D-1 17:00 — not just arrival time)
* waiting time in queue (aging)
* recurrence / guest history (§4.4)
* an active complaint on the booking always ranks first
* (optional) stale data sources affecting the item

The three lanes are filter states of ONE list, not separate boards — see §9.0.

### 3.7 Schema Altitude Rules (anti-over-specification)

Real hotel operations are far more varied than any fixed taxonomy (late check-ins, VCC
payments, OTA-vs-direct invoice rules, upgrade negotiations, shift handovers, …). The
system absorbs that variety by keeping classification coarse and the safety fallback
conservative — NOT by enumerating scenarios.

Litmus test for any proposed enum: *"when the next hotel or the next scenario arrives,
does this enum need a new value?"* If yes, it is data, not schema — demote it to free
text or an SOP row.

Rules (binding for all coding agents):

1. **No new domain enum values.** New scenarios use an existing domain + free-text
   `subtype`; fallback is `other`.
2. **No bespoke verifier functions for new scenarios.** The 12 existing rule verifiers
   stay (they protect the demo). Anything new goes through the generic verification
   path: freshness → `retrieve_sop` → missing-field check → approval requirement →
   conservative status. When uncertain, output `needs_approval` or `cannot_confirm` —
   never guess.
3. **Conditional business rules live in SOP data, not code branches.** "OTA bookings:
   generate invoice but do not send; direct bookings: send at checkout" is an SOP row,
   not an `if`.
4. **Missing fields split into `blocking` vs `deferrable`.** Blocking fields (e.g.
   payment card for collection) gate execution. Deferrable fields (e.g. company name —
   real front desks log "Up to date" and ask at check-in) allow a placeholder plus a
   low-priority follow-up; they do not stall the flow.
5. **Strictness lives only in gates and invariants:** the 6 verification statuses, the
   reply gate (§4.3), the freshness gate (§5), financial invariants (balance zero;
   receipt + invoice generated even when not sent), and the demo invariants. Everything
   else stays loose.
6. **Tool interfaces are named by intent** (`check_room_readiness`,
   `get_booking_payment_info`), never by system mechanics (which portal, which login,
   which POS). System mechanics belong to future adapters.
7. **Cross-booking side effects exist in reality** (upgrading one guest may require
   moving another — a new commitment to a third party). Out of scope to implement, but
   schemas must not structurally forbid a task or promise referencing another booking
   later.

### 4.1 Pre-arrival Promise Audit

1. User selects booking `BKG-2026-0718-ACME` (or a new intake arrives via the
   auto-watched demo mailbox / manual paste and is triaged per §3.6).
2. Info Analysis reads messages and reservation context.
3. Info Analysis determines intake scope and basic info completeness.
4. If basic info is incomplete, the agent asks targeted follow-up questions.
5. If basic info is complete, Info Analysis extracts extra items with source quotes.
6. Each extra item receives domain, subtype, rule key, clarity, missing fields, and verification route.
7. Verification Agent calls read-only tools for evidence.
8. Deterministic Decision Rules / Safety Gate produces the final verification status.
9. Task Planning Agent outputs follow-up, manager review, cautious reply, or department handoff plans.
10. Manager approves, edits, or rejects actions before live operational mutation.

### 4.2 Complaint Recovery

1. User enters or selects complaint.
2. Agent links complaint to relevant promises.
3. Agent checks promise ledger, approvals, and task board.
4. Agent determines failure point.
5. Agent generates root cause and recovery plan.
6. Manager approves recovery.
7. Agent creates recovery tasks and guest reply draft.
8. Agent logs postmortem suggestion.

### 4.3 Reply Policy And Auto-Send Gate

The agent drafts guest replies and may send them — but sending is governed by a
**deterministic reply gate**, exactly like promise execution. The LLM writes and
classifies the reply; the gate makes the send/hold call.

| Reply content | Gate decision |
| --- | --- |
| Acknowledgement ("we received your booking request") | auto-send allowed |
| Targeted questions about missing/unclear fields (incl. suspected typos, contradictions) | auto-send allowed |
| Restating facts that are `verifiable` on fresh data, or manager-approved | auto-send allowed |
| **Any guarantee about an item that is not `verifiable`/approved** (`at_risk`, `missing_info`, `conflict`, `needs_approval`, `cannot_confirm`) | **BLOCKED** — draft only; the manager reviews and sends |

Rules:

* Every commitment sentence in an auto-sent reply must map to a `verifiable` or approved
  item. One unverified commitment blocks the whole reply.
* Questions and acknowledgements are commitment-free, so the agent may always auto-ask for
  missing basic info or clarification — this is the "auto-reply" path.
* For the hackathon demo, "send" is **simulated** inside the StayOps thread view and
  labeled `auto-sent (simulated)`. Gmail write scopes are deliberately not requested; the
  gate is the product, transport is plumbing.
* Every auto-sent reply is logged as `auto_handled` and visible in the manager's
  auto-handled lane.

### 4.4 Complaint Loop, Recovery Promises, And Recurrence

Complaint handling is a loop, not a single pass — but each pass through the loop
**escalates instead of repeating**, so the loop is never redundant:

1. **Recovery actions are themselves promises** ("we will move the VP", "technician on the
   way"). They enter the SAME pipeline — verification → approval (if risky) → task →
   completion tracking — linked to the original promise and complaint. No separate
   machinery exists for recovery.
2. **`service_result` (§3.5) closes the loop**: `fulfilled` / `failed` / `recovered` /
   `exceeded` is recorded when recovery tasks complete.
3. **Recurrence escalation:**

| Occurrence | Behavior |
| --- | --- |
| 1st complaint on a promise/room/rule_key | Standard recovery flow; agent-handleable parts run automatically. |
| Recurrence within the recurrence window (same room / rule_key) | Forced into the *needs attention* lane with an **upgraded remedy** (room move / compensation) — never the same fix again. |
| Pattern (N occurrences in a period) | Routed to the Summary/Improvement agent as an asset/SOP issue (e.g. "room 402 HVAC failed 3× this month — recommend taking it out of inventory"). |

The "no data → human" rule (§8.1) is the loop's brake: "why did the fix not hold" has no
answer in system data, so a recurrence always reaches a human.

---

## 5. Data Freshness Gate

Data freshness must be visible in the UI. The agent must not confirm promises using stale operational data.

### 5.1 Freshness Rules

| Source                |    Max Age | If Stale                                        |
| --------------------- | ---------: | ----------------------------------------------- |
| `reservations`        | 30 minutes | Cannot confirm room-dependent promises.         |
| `room_inventory`      | 30 minutes | Cannot confirm early check-in or quiet room.    |
| `room_readiness`      | 15 minutes | Cannot confirm early check-in.                  |
| `housekeeping_roster` |    2 hours | Cannot confirm room preparation capacity.       |
| `hotel_sop`           |   24 hours | Cannot auto-judge policy compliance.            |
| `event_spaces`        |     1 hour | Cannot confirm meeting room equipment or setup. |
| `billing_accounts`    |   24 hours | Cannot confirm company invoice.                 |
| `transport_vendors`   |    2 hours | Cannot confirm airport transfer.                |
| `ops_tasks`           | 15 minutes | Cannot trace task completion reliably.          |
| `approval_records`    | 15 minutes | Cannot determine whether manager approved.      |

### 5.2 Freshness Gate Behavior

If a required source is stale:

* Status cannot be `verifiable`.
* Agent must downgrade to `cannot_confirm` or `at_risk`.
* UI must show the stale source.
* Recommended action must be cautious.
* Guest-facing drafts must avoid guarantee language.

Example:

If `room_inventory` was last synced 67 minutes ago, early check-in cannot be marked `verifiable`, even if rooms appear available.

---

## 6. Tool Contracts

### 6.1 `check_data_freshness(source_name)`

**Purpose:**
Check whether a data source is fresh enough for operational decisioning.

**Input:**

```json
{
  "source_name": "room_inventory"
}
```

**Returns:**

```json
{
  "source_name": "room_inventory",
  "last_synced_at": "2026-07-18T09:12:00Z",
  "max_allowed_age_minutes": 30,
  "age_minutes": 18,
  "freshness_status": "fresh"
}
```

**When to call:**
Before any promise verification that depends on operational data.

---

### 6.2 `get_reservation(booking_id)`

**Purpose:**
Retrieve core booking details.

**Input:**

```json
{
  "booking_id": "BKG-2026-0718-ACME"
}
```

**Returns:**

```json
{
  "booking_id": "BKG-2026-0718-ACME",
  "company_name": "Acme Robotics",
  "arrival_date": "2026-07-18",
  "departure_date": "2026-07-20",
  "room_count": 12,
  "room_mix": {
    "king": 8,
    "twin": 4
  },
  "meeting_room_id": "MR-BLUE",
  "primary_contact": "Maya Chen",
  "status": "confirmed"
}
```

**When to call:**
After extracting booking ID or when user opens the booking.

---

### 6.3 `search_messages(booking_id)`

**Purpose:**
Find booking emails, guest messages, sales notes, and complaints.

**Input:**

```json
{
  "booking_id": "BKG-2026-0718-ACME"
}
```

**Returns:**

```json
{
  "messages": [
    {
      "message_id": "MSG-001",
      "channel": "sales_email",
      "sender": "maya.chen@acmerobotics.com",
      "received_at": "2026-07-10T15:22:00Z",
      "body": "..."
    }
  ]
}
```

**When to call:**
At the start of promise extraction and again during complaint recovery.

---

### 6.4 `check_room_readiness(room_type, constraints, arrival_time)`

**Purpose:**
Check whether rooms satisfying requested constraints are available and ready.

**Input:**

```json
{
  "room_type": "king",
  "constraints": {
    "quiet_zone": true,
    "away_from_elevator": true
  },
  "arrival_time": "2026-07-18T11:00:00"
}
```

**Returns:**

```json
{
  "room_type": "king",
  "matching_rooms": [
    {
      "room_id": "504",
      "clean_status": "dirty_until_12_30",
      "quiet_zone": true,
      "near_elevator": false,
      "blocked_for_booking_id": null
    }
  ],
  "available_ready_count": 0,
  "available_later_count": 1,
  "recommendation": "at_risk"
}
```

**When to call:**
For early check-in, quiet room, room-blocking, upgrade, and room preference promises.

---

### 6.5 `check_inventory(item_type)`

**Purpose:**
Check availability of operational items or equipment.

**Input:**

```json
{
  "item_type": "projector"
}
```

**Returns:**

```json
{
  "item_type": "projector",
  "available_count": 1,
  "reserved_count": 0,
  "location": "events_storage"
}
```

**When to call:**
For projector, AV equipment, amenities, or physical inventory.

---

### 6.6 `retrieve_sop(promise_type)`

**Purpose:**
Retrieve policy rules relevant to a promise.

**Input:**

```json
{
  "promise_type": "early_check_in"
}
```

**Returns:**

```json
{
  "promise_type": "early_check_in",
  "rules": [
    {
      "policy_id": "SOP-ECI-001",
      "rule": "Early check-in before 14:00 may be noted but not guaranteed unless room is inspected and released.",
      "approval_required": true,
      "department": "front_desk"
    }
  ]
}
```

**When to call:**
For every promise classification before status assignment.

---

### 6.7 `check_event_space(requirement, date_time)`

**Purpose:**
Check meeting room and event equipment feasibility.

**Input:**

```json
{
  "requirement": "projector setup",
  "date_time": "2026-07-18T14:00:00",
  "space_id": "MR-BLUE"
}
```

**Returns:**

```json
{
  "space_id": "MR-BLUE",
  "available": true,
  "equipment": {
    "projector": true,
    "screen": true,
    "hdmi_adapter": true
  },
  "setup_lead_time_minutes": 120,
  "recommended_task_due_at": "2026-07-18T12:00:00"
}
```

**When to call:**
For meeting room, projector, catering setup, room layout, or event requests.

---

### 6.8 `create_ops_task(department, description, due_at, source_promise_id)`

**Purpose:**
Create operational task after approval.

**Input:**

```json
{
  "department": "events",
  "description": "Set up projector, screen, and HDMI adapter in MR-BLUE before Acme Robotics meeting.",
  "due_at": "2026-07-18T12:00:00",
  "source_promise_id": "P-004"
}
```

**Returns:**

```json
{
  "task_id": "TASK-104",
  "status": "created",
  "department": "events",
  "due_at": "2026-07-18T12:00:00",
  "source_promise_id": "P-004"
}
```

**When to call:**
Only after promise status is `verifiable` or manager approved `at_risk` / `needs_approval`.

---

### 6.9 `log_promise_decision(promise_id, status, evidence, recommended_action)`

**Purpose:**
Write decision and evidence into Promise Ledger.

**Input:**

```json
{
  "promise_id": "P-002",
  "status": "at_risk",
  "evidence": [
    "Only one quiet-zone king room available after 12:30.",
    "VP requested away from elevator."
  ],
  "recommended_action": "Manager should approve room priority and create room-blocking task."
}
```

**Returns:**

```json
{
  "promise_id": "P-002",
  "logged": true,
  "ledger_version": 3
}
```

**When to call:**
After every classification decision.

---

### 6.10 `trace_broken_promise(complaint_text, booking_id)`

**Purpose:**
Link complaint to prior promises, tasks, approvals, and failure points.

**Input:**

```json
{
  "booking_id": "BKG-2026-0718-ACME",
  "complaint_text": "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started."
}
```

**Returns:**

```json
{
  "matched_promises": [
    {
      "promise_id": "P-002",
      "promise_text": "Quiet king room for VP",
      "failure_point": "front_desk_room_blocking_task_not_completed"
    },
    {
      "promise_id": "P-004",
      "promise_text": "Meeting room projector",
      "failure_point": "events_task_due_time_set_to_meeting_start"
    }
  ],
  "recovery_plan": [
    "Offer VP immediate room move or compensation.",
    "Send technician to meeting room immediately.",
    "Apologize to company contact and confirm corrective action.",
    "Update projector setup rule to due_at = meeting_start - setup_lead_time."
  ]
}
```

**When to call:**
When complaint message is selected or entered.

---

## 7. Synthetic Demo Data

Use synthetic data as primary demo data. Public hotel booking datasets can be used only as field reference, not as the operational source of truth.

Recommended files:

```text
/data/messages.csv
/data/reservations.csv
/data/room_inventory.csv
/data/room_readiness.csv
/data/housekeeping_roster.csv
/data/hotel_sop.csv
/data/event_spaces.csv
/data/billing_accounts.csv
/data/transport_vendors.csv
/data/approval_records.csv
/data/ops_tasks.csv
/data/promise_ledger.csv
/data/sync_status.csv
```

### 7.1 `messages.csv`

```csv
message_id,booking_id,channel,sender,received_at,message_type,body
MSG-001,BKG-2026-0718-ACME,sales_email,maya.chen@acmerobotics.com,2026-07-10T15:22:00Z,booking_request,"We are confirming our corporate offsite for 12 rooms from July 18-20. Some executives may arrive around 11am, so early check-in would be helpful. Please place our VP in a quiet king room away from elevators if possible. We also need gluten-free breakfast for two attendees, a projector in the meeting room, airport transfer from MAD, and a company invoice."
MSG-002,BKG-2026-0718-ACME,sales_note,sales@hotel.test,2026-07-10T15:40:00Z,internal_note,"Sales told client we will note early arrival request. Quiet king for VP should be prioritized but not yet locked."
MSG-003,BKG-2026-0718-ACME,guest_email,maya.chen@acmerobotics.com,2026-07-16T09:05:00Z,follow_up,"Please remember the projector and the quiet room for our VP. The meeting starts at 2pm sharp."
MSG-004,BKG-2026-0718-ACME,complaint,maya.chen@acmerobotics.com,2026-07-18T14:18:00Z,complaint,"The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started."
```

### 7.2 `reservations.csv`

```csv
booking_id,company_name,arrival_date,arrival_time,departure_date,room_count,king_count,twin_count,meeting_room_id,primary_contact,status
BKG-2026-0718-ACME,Acme Robotics,2026-07-18,11:00,2026-07-20,12,8,4,MR-BLUE,Maya Chen,confirmed
```

### 7.3 `room_inventory.csv`

```csv
room_id,room_type,floor,quiet_zone,near_elevator,blocked_for_booking_id,next_arrival_booking_id
401,king,4,true,false,,BKG-2026-0718-OTHER
402,king,4,true,true,,BKG-2026-0718-ACME
504,king,5,true,false,,BKG-2026-0718-ACME
506,king,5,false,true,,BKG-2026-0718-ACME
301,twin,3,false,false,,BKG-2026-0718-ACME
302,twin,3,false,true,,BKG-2026-0718-ACME
```

### 7.4 `room_readiness.csv`

```csv
room_id,date,clean_status,estimated_ready_at,inspected,assigned_housekeeper
401,2026-07-18,occupied_until_12_00,2026-07-18T13:00:00,false,HK-02
402,2026-07-18,ready,2026-07-18T10:15:00,true,HK-01
504,2026-07-18,dirty_until_12_30,2026-07-18T13:15:00,false,HK-03
506,2026-07-18,ready,2026-07-18T10:30:00,true,HK-01
301,2026-07-18,ready,2026-07-18T10:00:00,true,HK-04
302,2026-07-18,dirty_until_11_45,2026-07-18T12:30:00,false,HK-04
```

### 7.5 `housekeeping_roster.csv`

```csv
staff_id,staff_name,shift_start,shift_end,capacity_minutes,assigned_minutes
HK-01,Ana Ruiz,2026-07-18T08:00:00,2026-07-18T16:00:00,420,390
HK-02,Luis Marin,2026-07-18T08:00:00,2026-07-18T16:00:00,420,410
HK-03,Sofia Ortega,2026-07-18T10:00:00,2026-07-18T18:00:00,420,300
HK-04,Noah Vega,2026-07-18T08:00:00,2026-07-18T14:00:00,300,270
```

### 7.6 `hotel_sop.csv`

```csv
policy_id,promise_type,rule,approval_required,department,deadline_rule
SOP-ECI-001,early_check_in,"Early check-in before 14:00 may be noted but cannot be guaranteed unless the assigned room is inspected and released.",true,front_desk,"arrival_time"
SOP-ROOM-002,quiet_room,"VIP quiet-room preferences require room blocking after manager approval.",true,front_desk,"arrival_minus_1_day"
SOP-FB-003,gluten_free_breakfast,"Dietary restrictions must be sent to F&B by 17:00 one day before breakfast service.",false,fb,"service_date_minus_1_day_17_00"
SOP-EVT-004,projector_setup,"Projector setup must be completed 120 minutes before meeting start.",false,events,"meeting_start_minus_120_minutes"
SOP-TRN-005,airport_transfer,"Airport transfer requires flight number, arrival time, passenger count, and phone number.",false,concierge,"arrival_minus_1_day"
SOP-BIL-006,company_invoice,"Company invoice requires billing contact, legal company name, tax ID, and billing address.",false,sales,"departure_date"
```

### 7.7 `event_spaces.csv`

```csv
space_id,date,start_time,end_time,capacity,projector,screen,hdmi_adapter,setup_lead_time_minutes,status
MR-BLUE,2026-07-18,14:00,17:00,24,true,true,true,120,booked_for_acme
```

### 7.8 `billing_accounts.csv`

```csv
booking_id,company_name,billing_contact,tax_id,billing_address,payment_terms,status
BKG-2026-0718-ACME,Acme Robotics,,,,,incomplete
```

### 7.9 `transport_vendors.csv`

```csv
vendor_id,vendor_name,date,available_vehicle_count,requires_flight_number,requires_arrival_time,status
TR-01,Madrid Executive Transfers,2026-07-18,2,true,true,available
```

### 7.10 `sync_status.csv`

```csv
source_name,last_synced_at,max_allowed_age_minutes
reservations,2026-07-18T09:45:00Z,30
room_inventory,2026-07-18T09:42:00Z,30
room_readiness,2026-07-18T09:50:00Z,15
housekeeping_roster,2026-07-18T08:30:00Z,120
hotel_sop,2026-07-17T22:00:00Z,1440
event_spaces,2026-07-18T09:20:00Z,60
billing_accounts,2026-07-17T18:00:00Z,1440
transport_vendors,2026-07-18T08:15:00Z,120
ops_tasks,2026-07-18T09:51:00Z,15
approval_records,2026-07-18T09:40:00Z,15
```

### 7.11 `approval_records.csv`

```csv
approval_id,booking_id,promise_id,approved_by,approved_at,decision,notes
APR-001,BKG-2026-0718-ACME,P-002,manager@hotel.test,2026-07-18T09:58:00Z,approved,"Prioritize quiet king for VP and lock room away from elevator."
APR-002,BKG-2026-0718-ACME,P-004,manager@hotel.test,2026-07-18T09:59:00Z,approved,"Projector setup confirmed for MR-BLUE."
```

### 7.12 `ops_tasks.csv`

```csv
task_id,booking_id,source_promise_id,department,description,due_at,status,owner,completed_at
TASK-101,BKG-2026-0718-ACME,P-003,fb,"Notify kitchen: gluten-free breakfast for two Acme attendees.",2026-07-17T17:00:00,completed,fb_lead@hotel.test,2026-07-17T16:22:00
TASK-102,BKG-2026-0718-ACME,P-004,events,"Set up projector, screen, and HDMI adapter in MR-BLUE.",2026-07-18T14:00:00,open,events@hotel.test,
TASK-103,BKG-2026-0718-ACME,P-002,front_desk,"Lock quiet king room away from elevator for Acme VP.",2026-07-17T18:00:00,open,frontdesk@hotel.test,
TASK-104,BKG-2026-0718-ACME,P-005,sales,"Ask Acme for flight number, arrival time, passenger count, and phone number for airport transfer.",2026-07-17T12:00:00,open,sales@hotel.test,
TASK-105,BKG-2026-0718-ACME,P-006,sales,"Ask Acme for billing contact, tax ID, and billing address for company invoice.",2026-07-20T10:00:00,open,sales@hotel.test,
```

### 7.13 `promise_ledger.csv`

```csv
promise_id,booking_id,promise_text,promise_type,status,owner_department,evidence,risk_reason,recommended_action,approval_required,execution_state
P-001,BKG-2026-0718-ACME,"Early check-in for group around 11am","request_noted","cannot_confirm","front_desk","SOP-ECI-001; room_readiness shows several rooms not ready before noon","Group arrival before official check-in and readiness uncertain","Reply that early arrival is noted but cannot be guaranteed",true,"not_created"
P-002,BKG-2026-0718-ACME,"Quiet king room for VP away from elevators","preference;risk_sensitive_request","at_risk","front_desk","Only one suitable quiet king likely ready after 12:30; SOP-ROOM-002 requires room blocking","Limited quiet-zone king inventory","Manager approval and room-blocking task",true,"task_created"
P-003,BKG-2026-0718-ACME,"Gluten-free breakfast for two attendees","operational_requirement","verifiable","fb","SOP-FB-003 allows execution if F&B notified D-1 17:00","Deadline sensitive","Create F&B notification task",false,"completed"
P-004,BKG-2026-0718-ACME,"Projector in meeting room","confirmed_commitment;operational_requirement","verifiable","events","MR-BLUE has projector; SOP-EVT-004 says setup due 120 minutes before start","Task due time must be 12:00 not 14:00","Create events setup task due 12:00",false,"task_created"
P-005,BKG-2026-0718-ACME,"Airport transfer from MAD","missing_info_request;operational_requirement","missing_info","concierge","Transport vendor available but flight number and arrival time missing","Cannot book transfer without flight details","Ask guest for flight number, arrival time, passenger count, phone",false,"follow_up_created"
P-006,BKG-2026-0718-ACME,"Company invoice","commercial_requirement","missing_info","sales","Billing account incomplete","Tax ID, billing contact, and billing address missing","Ask company for billing details",false,"follow_up_created"
```

---

## 8. Promise Classification Rules

### 8.1 General Rules

The agent must classify with evidence. It cannot assign a status without citing at least one data source.

Rules:

* **If the answer to a question does not exist in hotel system data, the item MUST route
  to a human.** Agents never guess beyond the database. (This single rule is the safety
  model in one sentence; it also brakes the complaint loop, §4.4.)
* Use `verifiable` only when all required operational data is fresh and supports execution.
* Use `at_risk` when execution is possible but constrained by inventory, staffing, timing, or preference uncertainty.
* Use `missing_info` when required external information is absent.
* Use `conflict` when a request violates SOP or conflicts with another reservation/resource.
* Use `needs_approval` when the agent needs manager discretion before commitment.
* Use `cannot_confirm` when freshness gate fails or data is insufficient.
* Do not create tasks for `cannot_confirm`, `conflict`, or `missing_info` except follow-up tasks.
* Do not create guest-facing guarantee language unless status is `verifiable` or approved.

### 8.2 Case-Specific Rules

#### Early check-in

Input indicators:

* “arrive around 11”
* “early check-in”
* “before standard check-in”

Required checks:

* `check_data_freshness(room_inventory)`
* `check_data_freshness(room_readiness)`
* `retrieve_sop(early_check_in)`
* `check_room_readiness(...)`

Expected classification:

* `cannot_confirm` if room readiness is uncertain or data stale
* `at_risk` if some rooms may be ready but not all 12
* Never `verifiable` for the whole group unless enough inspected rooms are released

Recommended action:

* Guest reply draft: early arrival is noted, subject to availability
* Internal front desk readiness check

#### Quiet king room for VP

Required checks:

* Room inventory
* Room readiness
* SOP
* Existing room blocks

Expected classification:

* `at_risk` if limited quiet king rooms exist
* `needs_approval` if VP priority requires manager decision
* `verifiable` only after manager approval and room block

Recommended action:

* Manager approval
* Front desk task to lock room
* Map highlight of candidate rooms

#### Gluten-free breakfast

Required checks:

* SOP
* F&B deadline
* Reservation breakfast dates

Expected classification:

* `verifiable` if deadline has not passed
* `at_risk` if deadline is close
* `conflict` if deadline passed and SOP disallows same-day guarantee

Recommended action:

* F&B task due before D-1 17:00

#### Projector

Required checks:

* Event space
* Equipment availability
* Setup lead time SOP

Expected classification:

* `verifiable` if equipment exists and event space is booked
* `at_risk` if setup window is tight
* `conflict` if projector is reserved elsewhere

Recommended action:

* Create events task due at `meeting_start - setup_lead_time`
* Flag any task due-time mismatch

#### Airport transfer

Required checks:

* Transport vendor availability
* Flight number
* Arrival time
* Passenger count
* Contact phone

Expected classification:

* `missing_info` if any required field is absent
* `verifiable` only after required info is provided and vendor available

Recommended action:

* Guest follow-up asking for missing fields

#### Company invoice

Required checks:

* Billing account
* Company legal name
* Tax ID
* Billing address
* Billing contact

Expected classification:

* `missing_info` if fields absent
* `verifiable` after all fields exist

Recommended action:

* Sales follow-up task

---

## 9. UI Specification

The UI should have 4 primary views:

1. Promise Ledger
2. Task Board
3. Timeline
4. Hotel Map / Room Map

Visual direction:

* Use a clean operational dashboard style.
* Map view should show room position and risk state.
* Task board should use kanban columns.
* Timeline should show promise lifecycle and failure trace.

### 9.0 Manager Attention Queue (business-view simplicity rule)

The attention queue (§3.6) **replaces whole-table scanning; it must not add density** to
the manager view:

* The default manager view shows ONLY the *needs attention* lane — typically 3–7 items,
  ranked by the priority score. The top item is always the next action.
* Auto-handled items collapse into a single count line ("12 auto-handled today ✓"),
  expandable on demand.
* The three lanes (*auto-handled* / *review suggested* / *needs attention*) are filter
  chips on ONE list, never three tables.
* Each queue row shows only: who, what, why it was flagged, and 1–2 one-click actions.
  Everything else lives in the detail drawer.
* Full density (tool calls, traces, eval metrics) belongs to the judge/developer view
  only.

### 9.1 Top Navigation

Header should include:

* Product name: `StayOps`
* Search: booking ID, company name, room, task, complaint
* Current context: `BKG-2026-0718-ACME / Acme Robotics`
* Data freshness badge: `Data Freshness: Fresh / Warning`
* Button: `Run Promise Audit`
* Button: `Trace Complaint`
* Button: `Create Task`

### 9.2 View 1: Promise Ledger

This is the main view.

Columns:

| Column             | Description                                     |
| ------------------ | ----------------------------------------------- |
| Promise            | Extracted promise/request text                  |
| Type               | Promise type                                    |
| Status             | Current classification                          |
| Evidence           | Source facts                                    |
| Risk               | Why it may fail                                 |
| Owner              | Department                                      |
| Recommended Action | Next step                                       |
| Approval           | Approve / Edit / Reject                         |
| Execution          | Not created / Task created / Completed / Failed |

Status colors:

| Status           | Color  |
| ---------------- | ------ |
| `verifiable`     | Green  |
| `at_risk`        | Amber  |
| `missing_info`   | Blue   |
| `conflict`       | Red    |
| `needs_approval` | Purple |
| `cannot_confirm` | Gray   |
| `failed`         | Red    |
| `resolved`       | Green  |

Required interactions:

* Click a promise to open detail drawer.
* Detail drawer shows:

  * Source message quote
  * Tool calls used
  * Freshness status
  * Evidence
  * Status reasoning
  * Recommended action
  * Approval controls
  * Linked tasks
  * Complaint trace if any

### 9.3 View 2: Task Board

Kanban columns:

* `Waiting for Approval`
* `Approved`
* `Created`
* `In Progress`
* `Blocked`
* `Completed`
* `Failed`

Cards should include:

* Task ID
* Department
* Promise source
* Due time
* Owner
* Status
* Risk badge
* Linked promise ID

Example cards:

```text
TASK-103
Front Desk
Lock quiet king room away from elevator for Acme VP
Due: 2026-07-17 18:00
Source: P-002
Status: Open
Risk: At-risk promise
```

```text
TASK-102
Events
Set up projector in MR-BLUE
Due: 2026-07-18 14:00
Source: P-004
Status: Open
Warning: Due time should be 12:00 based on SOP
```

Task board must expose the failure in the complaint demo:

* Quiet room task exists but remains open.
* Projector task exists but due time is wrong.

### 9.4 View 3: Timeline

Timeline should show the full promise lifecycle.

Events:

```text
2026-07-10 15:22 — Booking email received
2026-07-10 15:40 — Sales note created
2026-07-18 09:45 — Data freshness checked
2026-07-18 09:52 — Promise audit completed
2026-07-18 09:58 — Manager approved quiet king room priority
2026-07-18 09:59 — Manager approved projector setup
2026-07-18 10:00 — Task board updated
2026-07-18 14:00 — Meeting started
2026-07-18 14:18 — Complaint received
2026-07-18 14:19 — Broken promise trace generated
2026-07-18 14:21 — Recovery tasks created
```

Timeline must support filters:

* All
* Promises
* Approvals
* Tasks
* Complaints
* Recovery

For complaint recovery, draw a clear causal chain:

```text
Complaint → Promise P-002 → Approval APR-001 → Task TASK-103 → Open / Not completed → Failure point
Complaint → Promise P-004 → Task TASK-102 → Wrong due time → Failure point
```

### 9.5 View 4: Hotel Map / Room Map

Map does not need to be a real floorplan. Use a simplified hotel floor diagram.

Required map elements:

* Floors
* Rooms
* Elevator location
* Quiet zone
* Selected booking rooms
* VP candidate rooms
* Risk marker

Example room states:

| Room | Visual State                                                                            |
| ---- | --------------------------------------------------------------------------------------- |
| 402  | King, quiet zone, near elevator — not suitable for VP                                   |
| 504  | King, quiet zone, away from elevator, dirty until 13:15 — candidate but not ready at 11 |
| 506  | King, not quiet, near elevator — unsuitable                                             |
| 401  | King, quiet, away from elevator, occupied until 12 — candidate later                    |

Map interactions:

* Click room to see readiness, constraints, and booking block.
* Highlight why quiet king is `at_risk`.
* During complaint trace, highlight actual assigned room near elevator and show mismatch against promise.

### 9.6 Complaint Recovery View

Input:

```text
The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.
```

Output sections:

1. Matched promises
2. Broken promise trace
3. Failure point
4. Immediate recovery actions
5. Guest reply draft
6. Internal postmortem
7. Suggested rule/task fix

Example output:

```text
Matched Promise P-002: Quiet king room for VP
Failure point: Front desk room-blocking task was created but not completed.
Impact: VP assigned to room 402 near elevator.

Matched Promise P-004: Projector in meeting room
Failure point: Events setup task due_at was set to 14:00, but SOP requires setup by 12:00.
Impact: Projector was not ready at meeting start.
```

Recovery plan:

```text
1. Offer VP immediate move to room 504 after inspection, or provide service recovery credit.
2. Send technician to MR-BLUE immediately with projector and HDMI adapter.
3. Notify company contact that corrective action is underway.
4. Create internal task rule: projector setup due_at = meeting_start - setup_lead_time.
5. Escalate room-blocking task if not completed by arrival minus 12 hours.
```

---

## 10. Agent Output Schemas

### 10.1 Promise Candidate Schema

```json
{
  "promise_id": "P-004",
  "booking_id": "BKG-2026-0718-ACME",
  "source_message_id": "MSG-001",
  "source_quote": "We also need ... a projector in the meeting room",
  "promise_text": "Projector in meeting room",
  "promise_type": ["confirmed_commitment", "operational_requirement"],
  "department": "events",
  "required_checks": [
    "event_space",
    "inventory",
    "sop",
    "data_freshness"
  ]
}
```

### 10.2 Promise Decision Schema

```json
{
  "promise_id": "P-004",
  "status": "verifiable",
  "evidence": [
    {
      "source": "event_spaces",
      "fact": "MR-BLUE has projector, screen, HDMI adapter"
    },
    {
      "source": "hotel_sop",
      "fact": "Projector setup must be completed 120 minutes before meeting start"
    }
  ],
  "risk_reason": "Task due time must be calculated from setup lead time.",
  "recommended_action": {
    "action_type": "create_task",
    "department": "events",
    "description": "Set up projector, screen, and HDMI adapter in MR-BLUE.",
    "due_at": "2026-07-18T12:00:00"
  },
  "approval_required": false
}
```

### 10.3 Complaint Trace Schema

```json
{
  "complaint_id": "CMP-001",
  "booking_id": "BKG-2026-0718-ACME",
  "complaint_text": "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.",
  "matched_promises": [
    {
      "promise_id": "P-002",
      "failure_type": "task_not_completed",
      "failure_point": "front_desk_room_blocking_task_not_completed",
      "root_cause": "Manager approved quiet king priority, but front desk did not lock a suitable room."
    },
    {
      "promise_id": "P-004",
      "failure_type": "incorrect_due_time",
      "failure_point": "events_task_due_time_set_to_meeting_start",
      "root_cause": "Events task due_at was 14:00, but SOP required 12:00."
    }
  ],
  "recovery_plan": [
    {
      "department": "front_desk",
      "action": "Offer room move to suitable quiet king or compensation.",
      "urgency": "immediate"
    },
    {
      "department": "events",
      "action": "Send technician to MR-BLUE immediately.",
      "urgency": "immediate"
    },
    {
      "department": "manager",
      "action": "Send apology and corrective action note to company contact.",
      "urgency": "same_day"
    }
  ],
  "postmortem_suggestions": [
    "Escalate uncompleted VIP room-blocking tasks 12 hours before arrival.",
    "Auto-calculate event setup due_at from SOP lead time."
  ]
}
```

---

## 11. Architecture

### 11.1 MVP Architecture

```text
Synthetic CSV / future hotel data adapters
        ↓
Tool Layer
        ↓
Google Cloud Agent Builder / ADK + Gemini
        ↓
Web App UI
        ↓
Promise Ledger + Task Board + Timeline + Map
```

### 11.2 Services

| Layer               | MVP Option                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| Data source         | CSV fixture now; future PMS / warehouse adapters                        |
| Data freshness      | Deterministic source freshness checks                                   |
| Data warehouse      | BigQuery or Cloud SQL in future                                         |
| Agent orchestration | Local ADK / Agent Builder path implemented; Cloud Run deployment pending |
| Reasoning           | Gemini                                                                  |
| Backend             | Python FastAPI or Node/Next API routes                                  |
| Frontend            | Next.js + React                                                         |
| UI components       | Tables, kanban board, timeline, simplified map                          |
| Persistence         | BigQuery / Firestore / local JSON for MVP                               |
| Deployment          | Cloud Run / Firebase Hosting                                            |

### 11.3 Required Backend Endpoints

```text
GET  /api/bookings/:booking_id
GET  /api/bookings/:booking_id/messages
POST /api/audit/:booking_id
POST /api/promises/:promise_id/approve
POST /api/promises/:promise_id/reject
POST /api/tasks
GET  /api/tasks?booking_id=
POST /api/complaints/trace
GET  /api/freshness
GET  /api/map/:booking_id

# Intake / eval / observability (current sprint)
GET  /api/intake/gmail/search?q=
POST /api/intake/gmail/import
POST /api/audit/from-intake
GET|POST /api/eval/acme
GET  /api/insights
GET  /api/report            # Summary agent aggregation (planned)
POST /api/tools/:tool       # internal tool callback for the ADK service
```

---

## 12. Demo Flow

### Scene 1 — Booking Intake

Show original corporate booking email.

Click: `Run Promise Audit`

Agent shows:

* Data freshness panel
* Extracted promises
* Tool calls
* Promise Ledger

### Scene 2 — Promise Ledger

Show 6 rows:

1. Early check-in — `cannot_confirm`
2. Quiet king room — `at_risk`
3. Gluten-free breakfast — `verifiable`
4. Projector — `verifiable`
5. Airport transfer — `missing_info`
6. Company invoice — `missing_info`

Emphasize:

* Agent does not guarantee early check-in.
* Agent does not blindly create a task for missing airport transfer info.
* Agent catches that quiet king requires approval and room lock.
* Agent calculates projector setup should be 12:00, not 14:00.

### Scene 3 — Approval and Task Creation

Manager approves:

* Quiet king priority
* Gluten-free breakfast task
* Projector setup task
* Billing follow-up
* Airport transfer follow-up

Task board updates.

### Scene 4 — Map View

Show room map:

* Room 402: quiet-zone king but near elevator
* Room 504: better candidate but not ready before 13:15
* Quiet room request shown as at-risk
* VP room needs manual lock

### Scene 5 — Timeline

Show promise lifecycle:

* Booking email
* Promise audit
* Approval
* Tasks created
* Meeting start
* Complaint
* Broken promise trace

### Scene 6 — Complaint Recovery

Input complaint.

Agent outputs:

* Matched promise P-002 and P-004
* Root cause
* Broken task chain
* Recovery plan
* Guest reply draft
* Postmortem suggestions

---

## 13. Acceptance Criteria

### 13.1 Product Acceptance Criteria

The demo is acceptable only if:

* It uses the fixed Acme Robotics corporate offsite case.
* It extracts exactly 6 core promises.
* It classifies each promise with type, status, evidence, risk, and next action.
* It shows at least one `cannot_confirm` item.
* It shows at least one `at_risk` item.
* It shows at least one `missing_info` item.
* It shows at least one `verifiable` item.
* It requires manager approval for quiet king room and early check-in language.
* It prevents early check-in from being presented as guaranteed.
* It creates task board items only after approval or verifiable classification.
* It traces the complaint to at least two broken promises.
* It produces recovery plan and postmortem suggestions.

### 13.2 Data Acceptance Criteria

The demo data must include:

* At least 1 booking
* At least 4 messages
* At least 6 room inventory rows
* At least 6 room readiness rows
* At least 4 housekeeping roster rows
* At least 6 SOP rows
* At least 1 event space row
* At least 1 incomplete billing account row
* At least 1 transport vendor row
* At least 10 sync status rows
* At least 2 approval records
* At least 5 task records
* At least 6 promise ledger records

### 13.3 Tool Acceptance Criteria

The agent must call or simulate these tools:

* `check_data_freshness`
* `get_reservation`
* `search_messages`
* `check_room_readiness`
* `check_inventory`
* `retrieve_sop`
* `check_event_space`
* `create_ops_task`
* `log_promise_decision`
* `trace_broken_promise`

Each tool call must be visible in either:

* Developer log panel
* Promise detail drawer
* Timeline event
* Audit log

### 13.4 UI Acceptance Criteria

The UI must include:

* Promise Ledger table
* Data freshness panel
* Kanban-style task board
* Timeline view
* Simplified hotel map / room map
* Complaint recovery panel
* Approval controls
* Evidence drawer for each promise

### 13.5 Demo Acceptance Criteria

The 3-minute demo must show:

```text
0:00–0:25   Problem: broken hotel promises, not slow replies
0:25–0:50   Corporate booking email and fragmented hotel data
0:50–1:10   Data freshness and audited source evidence
1:10–1:50   Promise Ledger with 6 classified promises
1:50–2:15   Manager approval and task board write-back
2:15–2:35   Map and timeline showing room / time dependencies
2:35–2:55   Complaint trace and recovery plan
2:55–3:00   Closing: audit, execute, recover hotel promises
```

---

## 13.6 Future Real-Time Operations Board

Phone intake and live negotiation are future scope. When added, StayOps should support a
duty-manager operations board that shows near-current signals before staff confirms an
unverified request:

* room inventory and readiness
* housekeeping capacity
* event-space and AV availability
* transport vendor availability
* open risky tasks
* stale data sources
* manager approvals pending

The board should answer whether a live request is safe to confirm, needs manager approval,
is missing information, or cannot be confirmed. Do not build this before the core Info
Analysis, Verification, Safety Gate, and Task Planning model is stable.

## 13.7 Intake, Reply, And Loop Acceptance (current sprint)

* **Auto-intake:** a new email appearing in the demo mailbox (or simulated inbox) shows up
  in the intake queue without copy-paste, and the audit runs on its **actual content**.
* **Acme protection:** no intake path modifies the fixed Acme main flow (its 6 promises,
  `TASK-102` due 14:00, `TASK-103` open).
* **Reply gate:** a reply containing a guarantee about a non-verifiable item is blocked
  into a draft; questions/acknowledgements auto-send (simulated) and are logged as
  `auto_handled`.
* **Attention queue:** the default manager view shows only *needs attention* items plus an
  auto-handled count line.
* **Recurrence:** a second complaint on the same room/rule_key inside the window reaches
  the manager queue with an upgraded remedy, not a repeat of the first fix.

## 14. Non-Goals

Do not build:

* Full PMS
* Full guest messaging inbox
* Real OTA integration
* Real payment or invoice engine
* Real transport booking
* Real hotel floorplan engine
* Generic chatbot
* Generic task manager
* Generic complaint apology generator
* Real email sending (Gmail write scopes) — demo replies are simulated behind the reply gate (§4.3)
* Mailbox-wide automation beyond the single designated demo mailbox

The demo must stay focused on:

```text
Promise extraction → promise verification → approval → task creation → complaint trace → recovery
```

---

## 15. Success Standard

The project succeeds if a judge understands within 60 seconds:

```text
Existing hotel AI tools often help reply to guests or create tasks.
StayOps verifies whether the hotel should make the promise in the first place.
Then, if the promise fails, it traces exactly where the operational chain broke.
```

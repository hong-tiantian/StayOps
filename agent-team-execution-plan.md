# StayOps Agent Team Execution Plan

> Root-level handoff document for the next coding conversation.
>
> Goal: realign StayOps from a fixed promise-ledger demo pipeline into the agreed
> **agent team** model without breaking the Acme hackathon demo.
>
> Agents should update this file live as work progresses.

## Authority And Conflict Rule

This file is the current execution authority for the agent-team/model realignment work.

When implementing this plan, compare it against all root-level markdown files and all docs under `docs/`.
If any older document conflicts with this plan, update the older document to match this plan unless a human explicitly says otherwise.

Files that must be checked for conflicts:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `builder.md`
- `docs/00-spec.md`
- `docs/01-demo-case.md`
- `docs/02-agent-design.md`
- `docs/03-api-and-tools.md`
- `docs/04-domain-background.md`
- `docs/05-mcp-arize.md`
- `docs/06-personas-and-permissions.md`

Known conflict themes to resolve:

- old flat `category` wording vs new `domain/subtype/rule_key/verification_route` model
- old Promise Type / Promise Status definitions mixing request type, verification, handoff, and outcome
- old Fivetran-current-partner wording vs current Arize/Phoenix partner direction
- old Vercel-allowed deployment wording vs Cloud Run/Firebase-only direction
- old "Agent Builder planned/not integrated" wording vs current local ADK path implemented, deployment pending
- old single-agent/pipeline wording vs agreed agent team model
- old task-manager wording vs promise verification / manager-control positioning
- old service-level wording if it treats complaint/no complaint/good review as request classification instead of post-execution evaluation

Do not treat `docs/00-spec.md` as automatically authoritative where it conflicts with this plan; it is one of the files that must be updated.

## 0. Live Execution Status

Use these markers:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked / needs human decision

### Phase Status

- [x] Phase 1 - Documentation alignment
- [x] Phase 2 - Info Analysis layer
- [x] Phase 3 - Category/rule-key cleanup
- [x] Phase 4 - Per-category verifier cleanup
- [x] Phase 5 - Task Planning Agent
- [x] Phase 6 - Approval state cleanup
- [x] Phase 7 - Evaluation & Recovery cleanup
- [x] Phase 8 - UI/trace visibility
- [!] Phase 9 - Verification
- [x] Phase 10 - Future real-time monitoring board

### Current Worktree Note

At the time this plan was created, the repo already had user/team edits in:

- `builder.md`
- `docs/00-spec.md`

Treat those as existing team work. Do not revert them. Humans handle git commits/PRs unless explicitly requested.

Latest Codex pass:

- Added `InfoAnalysis` / `ExtraItem` / `TaskPlan` shared types.
- Added `src/lib/infoAnalysis.ts` and `src/lib/taskPlanner.ts`.
- Extended audit output with `info_analysis` and output-only `task_plan`.
- Kept seeded Acme ledger/tasks unchanged.
- Updated quiet-room policy so VP quiet room remains `at_risk` until manager approval and room lock.
- Aligned README/AGENTS/builder/docs with Arize partner direction, local ADK status, Cloud Run/Firebase-only deployment wording, and the basic-info/extra-item layered model.
- Verified `npm run typecheck` and `npm run build` pass.
- Localhost HTTP audit verification was blocked by local server reachability in this environment; static invariant checks confirmed Acme CSV statuses and `TASK-102`/`TASK-103` invariants remain intact.

Continuation pass:

- Replaced the policy switch with per-rule verifier functions while keeping `rulePromiseStatus()` as the stable public entrypoint.
- Added `RuleKey` and renamed internal policy alignment from category to rule key; CSV `category` remains a compatibility field.
- Fed avoidable Acme literals from reservation/event/vendor data where practical: early-check-in threshold from room mix, projector space/start from event context, transfer missing fields from vendor requirements.
- Split historical approval evidence from runtime manager approvals. CSV `approval_records.csv` remains complaint-trace evidence; new runtime clicks write to `runtime_approvals`; APIs return both scopes while preserving legacy `approved`.
- Made complaint recovery match complaint signals to ledger rule keys and linked tasks instead of fixed promise-id branches.
- Added audit `agent_trace` stages for backend trace visibility without editing the frontend UI.
- Documented the future real-time operations board concept for phone/live negotiation.
- Verified `npm run typecheck` and `npm run build` pass after continuation.
- Direct runtime audit execution remains blocked in this sandbox because `node:sqlite` raises `disk I/O error` even on a minimal test database; static checks still confirm the Acme seeded invariants.

Frontend pass:

- Added `src/components/AgentTeamFlow.tsx`.
- Wired Dashboard to show the audit `agent_trace` stages after `ManagerBriefing`.
- The panel shows Info Analysis, Verification Agent, Safety Gate, Task Planning, Recovery, and Arize Audit status in English/Chinese.
- Verified `npm run typecheck` and `npm run build` pass.
- Browser verification could not run because the local Next dev server still does not bind to `127.0.0.1:3000` in this environment.

## 1. Project Constraints To Preserve

### Product Identity

StayOps Promise Ledger is a **promise verification and recovery layer** for hotel operations.

It is:

- not a guest chatbot
- not a generic task manager
- not a full PMS
- not a generic complaint apology generator

Primary persona:

- hotel duty manager / operations lead

Downstream users:

- front desk
- F&B
- events
- concierge
- sales
- housekeeping / maintenance

Do not build real RBAC/auth for this hackathon scope.

### Hackathon Constraints

- Must use Gemini + Google Cloud Agent Builder / ADK.
- Partner direction is Arize/Phoenix, not Fivetran.
- Arize must be meaningful as monitoring/audit/self-review, not just a badge.
- Hosted deployment should be Cloud Run or Firebase Hosting.
- Do not deploy on Vercel or describe Vercel as allowed.
- Public repo with OSI license remains required.

### Demo Invariants

Do not break:

- Main booking: `BKG-2026-0718-ACME`
- Company: Acme Robotics
- Main case has exactly 6 promises / extra items.
- `DEMO_NOW = 2026-07-18T10:00:00Z`
- `TASK-103` remains `open` / not completed.
- `TASK-102` remains due at `2026-07-18T14:00:00`.
- SOP still says projector setup should be due at `12:00`.
- Expected first-pass statuses:
  - early check-in -> `cannot_confirm`
  - quiet king room -> `at_risk`
  - gluten-free breakfast -> `verifiable`
  - projector -> `verifiable`
  - airport transfer -> `missing_info`
  - company invoice -> `missing_info`

## 2. Current Implementation Reality

The current app works, but much of the core flow is still a fixed demo pipeline.

Current state:

- Next.js 16 App Router + React + TypeScript + Tailwind.
- API routes are the backend.
- Data is local CSV in `/data`, loaded by `src/lib/data.ts`.
- Gemini custom ReAct/function-calling loop exists in `src/lib/agent/promiseAgent.ts`.
- ADK / Agent Builder service exists under `agent/promise_agent/`.
- `ADK_AGENT_URL` path in `src/lib/classifier.ts` makes ADK the primary orchestration path when configured.
- Deterministic rules in `src/lib/agent/policy.ts` still make the final executable decision.
- Arize/Phoenix tracing and MCP self-review exist, but Arize does not directly change promise decisions.

Important correction for docs:

- Do not say Agent Builder is only "planned" if referring to local implementation.
- Better wording: **ADK/Agent Builder path is implemented locally; Cloud Run deployment, final docs, and Arize hardening are pending.**

## 3. Agreed Product Logic

The correct product logic is not:

```text
message -> promise category -> policy status -> task
```

The agreed logic is:

```text
guest/order input
-> Info Analysis
-> Basic info completeness
-> Extra item extraction
-> Extra verification route
-> Decision Rules / Safety Gate
-> Task Planning / Handoff
-> Evaluation & Recovery
-> Arize Monitoring / Audit
```

This matters because **basic info** and **extra info** have different complexity.

### Processing Algorithm

Agents should preserve this order. Do not jump directly from raw message text to fixed promise categories.

```text
1. Read source input and reservation context.
2. Determine intake scope.
3. Build the scope-specific basic-info checklist.
4. Check whether basic info is complete, missing, conflicting, or not confirmable.
5. If basic info is incomplete:
   -> ask targeted follow-up questions
   -> do not verify extras as if the order were complete
6. If basic info is complete:
   -> extract extra items
7. If there are no extra items:
   -> draft a safe confirmation / summary reply
   -> no task planning needed unless a normal hotel process requires it
8. For each extra item:
   -> assign domain
   -> assign subtype
   -> check clarity and missing required fields
   -> assign verification route
   -> map to internal rule_key if a verifier exists
9. Verification Agent calls tools for each extra item.
10. Decision Rules / Safety Gate validates the proposed result.
11. Task Planning Agent chooses one of:
    -> no task
    -> follow-up question/task
    -> manager review
    -> department task/handoff
    -> cautious guest reply
    -> escalation
12. Evaluation & Recovery later checks whether the handoff succeeded.
13. Arize/Phoenix monitors and audits the run, but does not change business decisions.
```

### Basic Info

Basic info is the information needed to understand the order/stay itself.

It is not one universal checklist. It depends on intake scope.

Examples:

- Individual stay:
  - dates
  - guest name
  - room type
  - arrival time
  - contact
  - payment
- Group stay:
  - dates
  - room count
  - room mix
  - group contact
  - arrival window
  - rooming list
  - billing owner
- Corporate group:
  - group stay fields
  - company name
  - company contact
  - billing / invoice owner
  - business purpose
- Corporate group event:
  - corporate group fields
  - meeting room
  - meeting time
  - event contact
  - event setup baseline
- VIP stay:
  - normal stay fields
  - VIP indicator
  - priority / manager discretion context
- Long stay:
  - stay dates
  - rate/payment terms
  - housekeeping cadence
  - maintenance/service expectations

Basic info result:

```text
basic_complete
basic_missing_info
basic_conflict
basic_cannot_confirm
```

If basic info is incomplete, the agent should ask follow-up questions before pretending to verify extras.

If basic info is complete and there is no extra, the agent can generate a safe confirmation / summary reply without sending everything to task planning.

### Extra Info

Extra info is special information beyond basic booking/stay fields. These are requests, preferences, operational requirements, commercial requirements, exceptions, or commitments that may affect execution.

Examples:

- quiet room
- high floor
- away from elevator
- early check-in
- late checkout
- gluten-free breakfast
- allergies
- projector
- HDMI adapter
- airport transfer
- company invoice
- upgrade
- discount
- compensation
- AC repair / maintenance
- lost and found

Extra items require second-stage processing:

```text
extra item
-> domain/subtype
-> clarity
-> missing required fields
-> verification route
-> tools/evidence
-> verification status
-> handoff / reply / manager review
```

### End-To-End Routing Examples

```text
basic complete + no extra
-> safe confirmation / summary reply

basic missing room count for group
-> ask for room count and room mix

basic complete + gluten-free breakfast before SOP deadline
-> verify SOP
-> task/handoff to F&B

basic complete + VIP quiet king request
-> verify inventory/readiness/SOP
-> manager review
-> room-lock handoff only after approval

basic complete + airport transfer without flight details
-> follow-up for flight number, arrival time, passenger count, phone

basic complete + group early check-in around 11am
-> verify readiness and SOP
-> cannot guarantee
-> cautious guest reply
```

## 4. Layering Model

### Layer 1 - Source / Intake Channel

Channels:

- email
- sales note
- web/app form
- OTA message
- phone, future scope

Phone is special because an unconfirmed request may be negotiated live. Future phone support should show real-time hotel availability / inventory context, but do not expand current hackathon scope unless explicitly requested.

### Layer 2 - Intake Scope

Classify the incoming order/stay context:

```text
individual_stay
group_stay
corporate_group
corporate_group_event
event_booking
vip_stay
long_stay
unknown
```

Scope controls which basic fields are required.

### Layer 3 - Basic Info Completeness

Evaluate whether the core order can be understood.

Expected output:

```ts
basic_info_status:
  | "complete"
  | "missing_info"
  | "conflict"
  | "cannot_confirm";

missing_basic_fields: string[];
basic_info: {
  dates?: unknown;
  room_count?: number;
  room_mix?: unknown;
  arrival_time?: string;
  primary_contact?: string;
  billing_owner?: string;
  meeting_context?: unknown;
}
```

Routing:

```text
basic missing_info -> ask follow-up
basic conflict -> escalate / clarify
basic cannot_confirm -> cautious reply
basic complete -> inspect extras
```

### Layer 4 - Extra Item Extraction

Extract extra items from the input.

The current 6 Acme items are extra items:

1. early check-in for group around 11am
2. quiet king room for VP away from elevators
3. gluten-free breakfast for two attendees
4. projector in meeting room
5. airport transfer from MAD
6. company invoice

### Layer 5 - Extra Item Domain

Domain should be broader and more reusable than current `category`.

Required domain/subtype/rule-key distinction:

```text
domain   = broad operational area
subtype  = more specific request pattern inside the domain
rule_key = internal verifier key used by deterministic rules
```

Do not make `rule_key` carry the whole taxonomy.

Suggested domains and subtypes:

```text
arrival_exception
  - early_check_in
  - late_checkout
  - early_arrival_bag_drop
  - room_ready_by_time

room_preference
  - quiet_room
  - high_floor
  - away_from_elevator
  - king_room
  - twin_room
  - connecting_rooms
  - accessible_room
  - vip_room_priority

fb_requirement
  - gluten_free
  - allergy
  - breakfast
  - banquet
  - minibar
  - dietary_restriction

event_av
  - projector
  - screen
  - hdmi_adapter
  - microphone
  - room_layout
  - catering_setup

transport
  - airport_transfer
  - parking
  - shuttle
  - taxi_booking

commercial
  - company_invoice
  - tax_id
  - billing_contact
  - payment_terms
  - company_account

exception_value
  - upgrade
  - discount
  - compensation
  - amenity_gift

maintenance_service
  - ac_not_cooling
  - repair_request
  - housekeeping_issue
  - room_move_request

lost_and_found
  - lost_item_search
  - return_item

other
```

Examples:

- early check-in -> `arrival_exception`
- quiet room / high floor / away from elevator -> `room_preference`
- gluten-free breakfast / allergy -> `fb_requirement`
- projector / HDMI / microphone -> `event_av`
- airport transfer -> `transport`
- invoice / tax ID / company account -> `commercial`
- upgrade / discount / compensation -> `exception_value`
- AC not cooling -> `maintenance_service`
- lost charger -> `lost_and_found`

### Layer 6 - Rule Key

Current `category` should be treated as an internal `rule_key`, not the full product taxonomy.

Examples:

```text
early_check_in
quiet_room
gluten_free_breakfast
projector_setup
airport_transfer
company_invoice
upgrade
high_floor
parking
long_stay_discount
lost_and_found
maintenance
```

The rule key drives deterministic verifiers. It should not be the only classification model.

### Layer 7 - Verification Route

Each extra item gets a route:

```text
self_verifiable
needs_human_approval
missing_guest_info
cannot_confirm_yet
conflict_with_policy_or_inventory
```

Examples:

- gluten-free breakfast -> `self_verifiable` if SOP deadline is still open.
- projector -> `self_verifiable` if event space/equipment exists, with due-time rule.
- quiet king for VP -> `needs_human_approval` because it involves priority/room lock.
- airport transfer -> `missing_guest_info` if flight/time/passenger/phone is missing.
- early check-in for group -> `cannot_confirm_yet` or `at_risk`, no guarantee.

### Layer 8 - Verification Status

Current statuses are still useful as verification statuses:

```text
verifiable
at_risk
missing_info
conflict
needs_approval
cannot_confirm
```

Do not use `approved`, `task_created`, `completed`, `failed`, `resolved` as verification statuses. They describe later lifecycle or result state. Current code includes them in `PromiseStatus`, but the product model should stop treating them as the same concept.

### Layer 9 - Handoff / Task State

After verification:

```text
not_needed
not_created
follow_up_created
approval_requested
task_planned
task_created
in_progress
completed
failed
```

This is where Task Planning Agent operates.

### Layer 10 - Service Result / Evaluation

Service result is post-execution / post-stay / complaint outcome.

Suggested result values:

```text
unknown
fulfilled
failed
recovered
exceeded
```

The teammate idea of service level belongs here, not in request classification or verification.

Recommended service-level framing:

```text
below_commitment
  The hotel failed the verified/approved commitment or complaint evidence shows failure.

met_commitment
  The hotel fulfilled the verified/approved commitment as planned.

above_commitment
  The hotel delivered beyond the verified/approved commitment, such as a meaningful upgrade
  or proactive recovery that exceeds the baseline promise.

unknown
  No reliable outcome signal yet.
```

Do not reduce service result to:

```text
complaint / no complaint / good review
```

Reason: absence of complaint does not prove fulfillment, and good review is an outcome signal, not a planning route.

Service-level signals can include:

- task completed on time
- task completed late
- task not completed
- SOP due-time mismatch
- complaint matched to a prior extra item
- manager recovery action
- guest reply sent
- guest review / explicit satisfaction signal
- operational postmortem

This is part of Evaluation & Recovery and future monitoring, not initial classification.

## 5. Agent Team And Responsibilities

### 5.1 Info Analysis

This stage should not be split into multiple tiny agents unless implementation forces it.

Responsibilities:

- Read reservation and messages.
- Identify source channel.
- Determine intake scope.
- Extract scope-dependent basic info.
- Mark basic info complete/missing/conflicting/cannot confirm.
- Extract extra items.
- Attach dynamic source quotes and message IDs.
- Assign broad extra item domain.
- Assign possible `rule_key`.
- Identify missing fields and clarity.

It should produce:

```ts
interface InfoAnalysis {
  booking_id: string;
  intake_scope:
    | "individual_stay"
    | "group_stay"
    | "corporate_group"
    | "corporate_group_event"
    | "event_booking"
    | "vip_stay"
    | "long_stay"
    | "unknown";
  basic_info_status: "complete" | "missing_info" | "conflict" | "cannot_confirm";
  basic_info: Record<string, unknown>;
  missing_basic_fields: string[];
  extra_items: ExtraItem[];
}

interface ExtraItem {
  item_id: string;
  text: string;
  source_message_id?: string;
  source_quote?: string;
  domain:
    | "arrival_exception"
    | "room_preference"
    | "fb_requirement"
    | "event_av"
    | "transport"
    | "commercial"
    | "exception_value"
    | "maintenance_service"
    | "lost_and_found"
    | "other";
  subtype?: string;
  clarity: "clear" | "unclear" | "missing_required_fields";
  required_fields: string[];
  missing_fields: string[];
  verification_route?:
    | "self_verifiable"
    | "needs_human_approval"
    | "missing_guest_info"
    | "cannot_confirm_yet"
    | "conflict_with_policy_or_inventory";
  rule_key?: string;
}
```

### 5.2 Verification Agent

Responsibilities:

- Take `InfoAnalysis.extra_items`.
- Decide evidence/tools needed per item.
- Call read-only tools.
- Produce proposed verification output.

It should not create tasks directly.

Example output shape:

```ts
interface VerificationResult {
  item_id: string;
  rule_key?: string;
  verification_status:
    | "verifiable"
    | "at_risk"
    | "missing_info"
    | "conflict"
    | "needs_approval"
    | "cannot_confirm";
  evidence: string[];
  risk_reason: string;
  approval_required: boolean;
  recommended_action: string;
  tool_calls: ToolCall[];
}
```

### 5.3 Decision Rules / Safety Gate

This is deterministic. It is not a business LLM agent.

Responsibilities:

- Validate or override Verification Agent proposals.
- Enforce freshness.
- Enforce SOP.
- Enforce missing-field rules.
- Enforce manager approval rules.
- Prevent overpromising.

Rules:

- If a required source is stale, status cannot be `verifiable`.
- If required guest fields are missing, status should be `missing_info`.
- If SOP requires approval, do not auto-commit.
- If early check-in lacks enough inspected/released rooms, do not guarantee.
- If projector setup SOP requires lead time, task due must be `meeting_start - setup_lead_time`.
- Quiet king for VP should stay `at_risk` / approval-required until manager approval and room lock, even if there is a possible candidate room.

### 5.4 Task Planning Agent

Responsibilities:

- Turn verified/approved items into task or follow-up plans.
- Decide when no task should be created.
- Produce guest reply draft or manager review request.
- Keep human-in-control.

Routing:

```text
basic incomplete -> follow-up question
basic complete + no extra -> safe confirmation / summary draft
extra verifiable -> task/handoff plan
extra at_risk + approval_required -> manager review plan
extra missing_info -> targeted follow-up task
extra cannot_confirm -> cautious guest reply, no guarantee
extra conflict -> escalation / alternative plan
```

Initial implementation can output `task_plan` without mutating seeded tasks.

Suggested shape:

```ts
interface TaskPlan {
  item_id: string;
  action_type:
    | "none"
    | "create_task"
    | "create_follow_up"
    | "request_manager_approval"
    | "draft_cautious_reply"
    | "escalate";
  department?: Department;
  description?: string;
  due_at?: string;
  guest_reply_draft?: string;
  manager_prompt?: string;
  reason: string;
}
```

### 5.5 Evaluation & Recovery Agent

Responsibilities:

- Evaluate whether the planned/approved/created handoff was completed.
- Match complaints to extra items/promises.
- Trace failure chain:

```text
complaint -> extra item / promise -> approval -> task -> failure point
```

- Generate:
  - root cause
  - recovery plan
  - guest reply draft
  - internal corrective action
  - SOP/task rule improvement

Current `recovery.ts` can remain deterministic for the Acme demo initially, but docs must describe that it is a fixed demo trace until generalized.

### 5.6 Arize Monitoring / Audit

Arize/Phoenix is not a decision agent.

Responsibilities:

- Trace ADK/Gemini reasoning.
- Trace tool calls.
- Trace deterministic rule overrides.
- Surface overpromise checks.
- Surface manager feedback/self-review.
- Provide audit evidence through Phoenix MCP.

Arize must not upgrade promise statuses or bypass Decision Rules.

## 6. Acme Mapping Under The New Model

Main case:

```text
booking_id = BKG-2026-0718-ACME
intake_scope = corporate_group_event
basic_info_status = complete or mostly_complete
```

Basic info available:

- company: Acme Robotics
- arrival date: 2026-07-18
- departure date: 2026-07-20
- arrival time/window: around 11:00
- room count: 12
- room mix: 8 king / 4 twin
- meeting room: MR-BLUE
- meeting time: 14:00-17:00
- primary contact: Maya Chen

Extra items:

| Item | Domain | Rule Key | Route | Expected Status |
| --- | --- | --- | --- | --- |
| Early check-in around 11am | `arrival_exception` | `early_check_in` | `cannot_confirm_yet` | `cannot_confirm` |
| Quiet king room for VP away from elevators | `room_preference` | `quiet_room` | `needs_human_approval` | `at_risk` |
| Gluten-free breakfast for two | `fb_requirement` | `gluten_free_breakfast` | `self_verifiable` | `verifiable` |
| Projector in meeting room | `event_av` | `projector_setup` | `self_verifiable` | `verifiable` |
| Airport transfer from MAD | `transport` | `airport_transfer` | `missing_guest_info` | `missing_info` |
| Company invoice | `commercial` | `company_invoice` | `missing_guest_info` | `missing_info` |

Important quiet-room rule:

- Quiet king for VP should not become plain `verifiable` just because one candidate room exists.
- It involves VIP/priority + limited inventory + room lock.
- It should remain `at_risk`, approval-required, until manager approval and room block.

## 7. Current Classification Assessment

The six Acme first-pass statuses are mostly reasonable:

- Early check-in -> `cannot_confirm`: reasonable because 12-room group early arrival cannot be guaranteed.
- Quiet king room -> `at_risk`: reasonable, but rule should be clarified as manager approval + room lock, not simple availability.
- Gluten-free breakfast -> `verifiable`: reasonable if SOP deadline is open.
- Projector -> `verifiable`: reasonable if MR-BLUE has equipment, but due-time rule must flag `12:00` vs `14:00`.
- Airport transfer -> `missing_info`: reasonable because flight number / arrival time / passenger count / phone are missing.
- Company invoice -> `missing_info`: reasonable because billing contact / tax ID / billing address are missing.

The problem is not the 6 expected outputs. The problem is the model path used to produce them:

```text
pre-seeded promise ledger
-> hard-coded category/rule switch
-> fixed demo task board
```

This should evolve toward:

```text
InfoAnalysis
-> ExtraItem[]
-> rule_key
-> per-rule verifier
-> safety decision
-> task/follow-up/approval plan
```

## 8. Known Hard-Coding

### 8.1 Core hard-coding

- `data/promise_ledger.csv` is a pre-seeded answer sheet, not a generated ledger.
- `src/lib/classifier.ts` has `SOURCE_QUOTES` for P-001 to P-006.
- `src/lib/classifier.ts` sets `source_message_id` to `MSG-001`.
- `src/lib/classifier.ts` loads ledger rows and rebuilds decisions from them.
- `src/lib/agent/policy.ts` has fixed category matchers and a large switch.
- `src/lib/agent/policy.ts` has `KNOWN_ARRIVAL = 2026-07-18T11:00:00`.
- `src/lib/agent/policy.ts` early check-in uses a hard-coded `< 8` ready-room threshold.
- `src/lib/agent/policy.ts` projector verifier uses fixed `2026-07-18T14:00:00` and `MR-BLUE`.
- `src/lib/agent/policy.ts` transfer missing fields are hard-coded.
- `src/lib/agent/agentTools.ts` defaults arrival/meeting/MR-BLUE to Acme values.
- `src/lib/tools.ts` derives projector inventory from `loadEventSpaces()[0]`.
- `data/ops_tasks.csv` pre-seeds task board.
- `src/app/api/promises/[promise_id]/approve/route.ts` records approval and displays existing task; it does not run a real task planner.
- `src/lib/recovery.ts` is fixed to P-002/P-004, TASK-102/TASK-103, room 402/504, and Acme-specific recovery text.

### 8.1.1 Hard-Coding Remediation Plan

Do not remove all demo hard-coding blindly. Some hard-coded data protects the demo. Fix the core model first.

| Area | Current hard-code | Required change | Phase |
| --- | --- | --- | --- |
| Promise source | `promise_ledger.csv` acts as answer sheet | Generate/derive extra items from Info Analysis; keep CSV as fixture/fallback | Phase 2 |
| Source quote | `SOURCE_QUOTES` and fixed `MSG-001` | Extract quote/message id from actual messages | Phase 2 |
| Category | flat CSV `category` | Treat as `rule_key`; add domain/subtype/route | Phase 3 |
| Policy switch | one large `rulePromiseStatus` switch | Split into per-rule verifier functions | Phase 4 |
| Acme time/space | hard-coded arrival, meeting time, `MR-BLUE` | Feed from reservation/basic info/event context | Phase 4 |
| Ready-room threshold | hard-coded `< 8` | Derive from group scope, room count, room mix, and readiness | Phase 4 |
| Transfer fields | hard-coded missing fields | Derive from domain/subtype requirements and vendor requirements | Phase 4 |
| Projector inventory | `loadEventSpaces()[0]` | Select by event space / meeting context | Phase 4 |
| Task board | `ops_tasks.csv` pre-seeded | Add output-only Task Planning Agent, then optional write path | Phase 5 |
| Approval state | historical approvals mixed with live UI approval | Split historical trace vs current manager decisions | Phase 6 |
| Recovery | fixed P-002/P-004 branches | Later derive from complaint matching + linked tasks + SOP warnings | Phase 7 |
| Hotel map | hard-coded room map | Future: render from inventory/readiness when core model is stable | Phase 10 |
| Timeline | fixed Acme events | Future: derive from audit/task/approval/recovery events | Phase 10 |

### 8.2 UI/demo hard-coding

- `src/app/page.tsx` has fixed seed booking.
- `src/app/page.tsx` has fixed default complaint.
- `src/components/ComplaintRecovery.tsx` has fixed default complaint.
- `src/components/HotelMap.tsx` has hard-coded rooms instead of reading room inventory/readiness.
- `src/lib/timeline.ts` has a fixed Acme timeline.
- `src/lib/i18n.ts` contains fixed Acme/failure-chain narrative.

### 8.3 Evaluation hard-coding

- `evals/goldens.json` only covers Acme.
- `scripts/eval.mjs` defaults to Acme.
- Existing eval proves demo safety/status correctness, not general taxonomy quality.

## 9. Execution Plan

### Phase 1 - Documentation Alignment

- [x] Update `docs/00-spec.md` with the full layered model:
  - source/intake channel
  - intake scope
  - basic info completeness
  - extra item extraction
  - extra item domain
  - rule key
  - verification route
  - verification status
  - handoff/task state
  - service result/evaluation
- [x] Rewrite type/status explanation so `missing_info_request` and `risk_sensitive_request` are no longer the main conceptual load-bearing fields.
- [x] Explain that current `category` is a demo/internal `rule_key`, not the full taxonomy.
- [x] Add the agreed Agent Team and responsibilities.
- [x] Clarify that basic-complete/no-extra can lead directly to safe reply.
- [x] Clarify that basic+needs-human-confirmation extra goes to manager review.
- [x] Clarify that service level belongs to post-execution service result, not initial request classification.
- [x] Update `docs/02-agent-design.md` to match the agent team.
- [x] Update `docs/01-demo-case.md` so the Acme case is described as an example of the new layered model.
- [x] Update `docs/03-api-and-tools.md` so API/tool contracts mention Info Analysis, Extra Items, rule keys, verification results, and task plans where applicable.
- [x] Update `docs/04-domain-background.md` so hotel-domain examples use basic-vs-extra and service-result language.
- [x] Update `docs/05-mcp-arize.md`: Arize = monitoring/audit/self-review, not business decision-maker.
- [x] Update `docs/06-personas-and-permissions.md` so duty-manager control is tied to manager review and not full RBAC.
- [x] Update `README.md`: agent team + deterministic safety rules + ADK current status.
- [x] Update `AGENTS.md`: current ADK status is locally implemented; deployment/docs/Arize hardening pending.
- [x] Update `builder.md` for consistency.
- [x] Remove or reframe Fivetran as future/non-current; current partner is Arize/Phoenix.
- [x] Remove any wording that says Vercel is allowed.

### Phase 2 - Info Analysis Layer

- [x] Add shared types for `InfoAnalysis` and `ExtraItem`.
- [x] Implement Info Analysis for Acme using reservation + messages.
- [x] Determine `intake_scope = corporate_group_event` for Acme.
- [x] Compute `basic_info_status`.
- [x] Extract exactly 6 Acme extra items.
- [x] Attach dynamic `source_message_id` and `source_quote`.
- [x] Assign domain/subtype/rule_key/verification_route/missing fields.
- [x] Return Info Analysis in audit response or attach it to decisions.
- [x] Keep current demo output stable.

### Phase 3 - Category / Rule-Key Cleanup

- [x] Keep existing CSV `category` column for compatibility.
- [x] Treat it in code/docs as `rule_key`.
- [x] Avoid presenting `category` as full business classification.
- [x] Add a migration note if renaming the actual field is too risky before submission.

### Phase 4 - Per-Rule Verifier Cleanup

- [x] Split `rulePromiseStatus` into clear verifier functions:
  - [x] `verifyEarlyCheckIn`
  - [x] `verifyQuietRoom`
  - [x] `verifyBreakfast`
  - [x] `verifyProjector`
  - [x] `verifyTransfer`
  - [x] `verifyInvoice`
  - [x] Existing secondary demos if kept: upgrade, high_floor, parking, long_stay_discount, lost_and_found, maintenance
- [x] Feed verifier inputs from Info Analysis + reservation + tools where practical.
- [x] Remove avoidable Acme literals from verifiers.
- [x] Preserve expected Acme statuses.
- [x] Ensure quiet-room VIP logic stays approval-required and `at_risk`.
- [x] Keep deterministic rules as final safety decision.

### Phase 5 - Task Planning Agent

- [x] Add task planner function.
- [x] Planner input: Info Analysis + Verification Results + Safety Gate output.
- [x] Planner output: `TaskPlan[]`.
- [x] Route:
  - [x] basic incomplete -> follow-up
  - [x] basic complete + no extra -> safe reply
  - [x] extra verifiable -> task/handoff plan
  - [x] extra at_risk + approval -> manager review plan
  - [x] extra missing_info -> follow-up task
  - [x] extra cannot_confirm -> cautious reply
  - [x] extra conflict -> escalation
- [x] Initially output `task_plan` without mutating seeded tasks.
- [x] Do not fix `TASK-102` or complete `TASK-103`.
- [x] Add UI visibility if feasible. Backend `agent_trace` is now shown by `AgentTeamFlow` on the dashboard.

### Phase 6 - Approval State Cleanup

- [x] Decide and implement distinction between:
  - historical approval records for complaint trace
  - current UI manager decisions for live demo actions
- [x] Preserve `approval_records.csv` for complaint trace.
- [x] Avoid confusing the manager-control story.
- [x] If keeping seeded approvals visible, document the demo flow as historical trace rather than live approval.

### Phase 7 - Evaluation & Recovery

- [x] Keep deterministic Acme trace initially if needed for deadline.
- [x] Document it honestly as fixed demo trace.
- [x] Later, match complaint text to extra items/promises dynamically.
- [x] Later, derive failure from linked tasks and SOP warnings instead of hard-coded P-002/P-004 branches.
- [x] Keep root cause and recovery plan output.

### Phase 8 - UI / Trace Visibility

- [x] Add or adapt UI panel to show Agent Team flow:
  - Info Analysis
  - Verification Agent
  - Decision Rules / Safety Gate
  - Task Planning Agent
  - Evaluation & Recovery
  - Arize Monitoring
- [x] Keep UI operational and duty-manager focused.
- [x] Do not create a marketing landing page.
- [x] Do not overbuild permissions/RBAC.

### Phase 10 - Future Real-Time Monitoring Board

This is future work, but it must be recorded because phone/unconfirmed negotiation depends on it.

- [x] Add a future dashboard concept for real-time hotel availability / operations monitoring.
- [x] Show current or near-current signals:
  - room inventory
  - room readiness
  - housekeeping capacity
  - event space availability
  - AV/equipment availability
  - transport vendor availability
  - open/risky tasks
  - stale data sources
  - manager approvals pending
- [x] Use this board to support phone negotiation:
  - guest calls with an unconfirmed request
  - agent/staff enters basic + extra info
  - system immediately shows whether it is safe to confirm, needs approval, missing info, or cannot confirm
- [x] Do not build this before the core Info Analysis and Verification model is stable unless explicitly requested.
- [x] Keep it as a future direction in docs if not implemented before submission.

### Phase 9 - Verification

- [x] Run `npm run typecheck`.
- [!] Run current Acme audit. Blocked in this sandbox by localhost reachability and `node:sqlite` disk I/O; `npm run build` route compilation passes.
- [x] Confirm exactly 6 decisions from seeded Acme ledger.
- [x] Confirm first-pass expected statuses from seeded Acme ledger and policy rules.
- [x] Confirm `TASK-102` still due 14:00 and warning still says 12:00.
- [x] Confirm `TASK-103` remains open.
- [x] Confirm Arize/Phoenix wording is audit/monitoring only.
- [x] Confirm Agent Builder wording reflects current ADK path.
- [x] Confirm no Vercel-allowed wording remains.
- [x] Confirm no Fivetran-current-partner wording remains.

## 10. Priority If Time Is Short

Do first:

1. Documentation alignment with full layered model.
2. Info Analysis types and Acme mapping.
3. Per-rule verifier cleanup while preserving output.
4. Task Planning Agent as output-only `task_plan`.
5. Agent Team visibility in UI or audit response.

Defer if needed:

- Generalized HotelMap.
- Generalized Timeline.
- Fully dynamic complaint matching.
- Broad eval suite beyond Acme.
- Real persistence beyond current SQLite/CSV/in-memory overlay.

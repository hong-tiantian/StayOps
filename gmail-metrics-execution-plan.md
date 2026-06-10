# StayOps Gmail Intake And Metrics Execution Plan

> Root-level handoff document for work item **2 (Gmail / real email intake)**
> and work item **4 (quantified demo metrics / evaluation)**.
>
> Goal: make StayOps feel like a real operational intake system instead of a
> pasted-text demo, and give judges measurable evidence that the agent improves
> safety, traceability, and manager control.
>
> This plan is intentionally separate from `agent-team-execution-plan.md` so the
> Gmail/metrics work can proceed without colliding with ongoing agent-architecture
> and frontend trace work.

## Authority And Conflict Rule

This file only governs:

- Gmail / email intake architecture and implementation.
- Quantitative demo metrics and evaluation reporting.
- Backend/API contracts needed by those two areas.

It does **not** supersede `agent-team-execution-plan.md`. If this file conflicts
with the agent-team plan, keep the agent-team plan authoritative and update this
file.

Files likely owned by this plan:

- future `src/lib/intake/**`
- future `src/app/api/intake/**`
- future `src/lib/evaluation/**`
- future `scripts/eval-*`
- future docs for Gmail intake, metrics, and submission evidence

Files to avoid without explicit coordination:

- `src/components/**`
- `src/app/page.tsx`
- `src/lib/classifier.ts`
- `src/lib/agent/**`
- `agent/promise_agent/**`
- `src/lib/types.ts`

`src/lib/types.ts` is shared. If a type must be added, keep it minimal and tell
the frontend/agent owner before implementation.

## 0. Live Execution Status

Use these markers:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked / needs human decision

### Phase Status

- [x] Phase 0 - Planning document
- [x] Phase 1 - Gmail intake product contract
- [!] Phase 2 - Gmail API/auth decision and local credentials
- [x] Phase 3 - Email normalization adapter
- [x] Phase 4 - Audit integration contract
- [x] Phase 5 - Metrics definitions and golden acceptance targets
- [x] Phase 6 - Metrics computation API/script
- [x] Phase 7 - Arize/Phoenix metric trace linkage
- [x] Phase 8 - Frontend handoff contract
- [x] Phase 9 - Verification and manual runbook

### Current Assumption

Claude/teammate is handling the frontend-facing trace/demo changes and the
current agent architecture cleanup. This plan should stay backend/documentation
first until those changes are merged.

### Implementation Notes - 2026-06-10

- Added backend-only intake contract in `src/lib/intake/types.ts`.
- Added Gmail normalization/degraded adapter in `src/lib/intake/gmail.ts`.
- Added Gmail contract endpoints:
  - `GET /api/intake/gmail/search?q=...`
  - `POST /api/intake/gmail/import { thread_id }`
- Added intake audit contract:
  - `POST /api/audit/from-intake`
- Gmail live API fetch remains blocked on demo mailbox/OAuth decisions. The
  endpoints return a clear degraded `ok: false` response when credentials or
  mailbox confirmation are not ready.
- Added metrics computation in `src/lib/evaluation/metrics.ts`.
- Added `GET/POST /api/eval/[booking_id]` for stable JSON metrics loaded from
  `evals/goldens.json`.
- Kept `GET/POST /api/eval/acme` only as a compatibility alias for the Acme demo.
- Updated `npm run eval` (`scripts/eval.mjs`) to enumerate `evals/goldens.json`
  and call `/api/eval/[booking_id]` for each golden booking.
- Extracted Phoenix audit trace summary to `src/lib/evaluation/phoenixTrace.ts`
  so `/api/insights` and eval metrics use the same trace linkage behavior.
- Verified `npm run typecheck`, `npm run build`, `npm run eval`, degraded Gmail
  responses, and manual-paste intake audit locally.

### Direction Update - 2026-06-10 (team decision, post-review)

The intake direction changed from "user-triggered import" to **auto-watched demo
mailbox**:

- The Intake Agent polls ONE designated demo mailbox (read-only). New emails appear in
  the intake queue without copy-paste, are triaged (clarity × importance, spec §3.6), and
  audited on their **actual content**.
- A `SimulatedInbox` implementation behind the same interface drops seeded emails into
  the queue on a timer — identical UX, used as the live-demo fallback when OAuth
  misbehaves. Both implementations must be switchable by env var.
- `POST /api/audit/from-intake` must stop falling back to the canned Acme audit: it
  must feed intake content through `runPromiseAuditFromMessages` (seam provided by the
  audit workstream in `src/lib/classifier.ts`) once that entry point lands.
- Replies are drafted by the Guest Reply Agent and pass the deterministic reply gate
  (spec §4.3). Demo "send" is simulated in-app; **no Gmail write scopes**.
- Hard rule: intake never writes to the Acme main flow (`BKG-2026-0718-ACME`).
- Still human-owned and urgent: choosing the demo mailbox, OAuth client, and test users.

## 1. Product Positioning

### Why Gmail Intake Matters

The demo should not depend only on a user pasting text. A real hotel workflow
often starts from:

- sales mailbox
- OTA/channel-manager email notification
- guest follow-up email
- internal forwarding from front desk or events

Gmail intake gives the demo a credible "real-world input" path:

```text
Gmail thread
-> normalized StayOps intake message(s)
-> promise extraction / info analysis
-> ADK/Gemini proposal
-> deterministic safety gate
-> manager review and task plan
-> complaint trace / recovery
```

Manual paste should remain as a fallback for phone notes and live conversation
simulation. Gmail should be an additional source, not the only source.

### Why Metrics Matter

The project must prove more than "the UI works". The metrics should show:

- fewer unsafe promises
- complete missing-info detection
- auditable evidence per decision
- complaint-to-root-cause traceability
- human control for risky promises
- real agent/tool/trace activity through ADK and Arize/Phoenix

## 2. Non-Goals

Do not build:

- a full email client
- real outbound email sending (auto-replies are gated drafts + simulated send; see spec §4.3)
- mailbox-wide background automation beyond the single designated demo mailbox
- production auth/tenant management
- real PMS/channel-manager integration
- Gmail write scopes
- generic document ingestion unrelated to booking/guest promise messages

Gmail access is read-only. Auto-polling of the ONE designated demo mailbox is in scope
(2026-06-10 direction update); anything beyond that mailbox is not.

## 3. Gmail Intake Plan

### Phase 1 - Gmail Intake Product Contract

Deliverable:

- Define the minimum intake object the backend needs from any source.

Proposed shape:

```ts
interface IntakeMessage {
  source: "seed_csv" | "gmail" | "manual_paste";
  external_id?: string;
  thread_id?: string;
  sender?: string;
  recipients?: string[];
  subject?: string;
  received_at?: string;
  body_text: string;
}
```

Acceptance criteria:

- A Gmail thread and a manual paste can both become the same `IntakeMessage[]`.
- The existing seeded Acme flow remains unchanged.
- The audit pipeline can still run without Gmail configured.

Conflict note:

- If this requires shared types, add only small source/intake types to
  `src/lib/types.ts` after coordinating with the frontend owner.

### Phase 2 - Gmail API/Auth Decision And Local Credentials

Preferred demo approach:

- Google OAuth user consent.
- Gmail API readonly scope only.
- User selects or searches for a thread.

Recommended scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

Manual action required:

- Create/confirm a Google Cloud OAuth client.
- Enable Gmail API in the same or a compatible GCP project.
- Add local env vars for client id/secret/redirect URI.
- Confirm whether the hosted demo can use the same OAuth client.

Blocked until human decision:

- Which Gmail account is safe for the demo?
- Will the OAuth consent screen be test-user only or public?
- Is the demo mailbox synthetic enough to show on camera?

### Phase 3 - Email Normalization Adapter

Backend implementation target:

- Add a Gmail fetch/normalize module under `src/lib/intake/`.
- It should accept one of:
  - Gmail thread id
  - Gmail search query
  - latest matching message from a known sender/subject

Suggested functions:

```ts
searchGmailThreads(query: string): Promise<GmailThreadSummary[]>
loadGmailThread(threadId: string): Promise<IntakeMessage[]>
normalizeGmailMessage(raw: GmailMessage): IntakeMessage
```

Normalization rules:

- Prefer `text/plain`.
- Fall back to stripped `text/html`.
- Preserve sender, subject, received time, thread id, and message id.
- Remove quoted reply blocks only if safe and obvious.
- Never mutate or send Gmail messages.

Acceptance criteria:

- A real Gmail thread can be converted into text messages.
- The adapter handles multi-message threads.
- Missing credentials produce a clear degraded response, not a crash.

### Phase 4 - Audit Integration Contract

Goal:

- Let audit run from imported email without rewriting the whole agent pipeline.

Low-risk path:

1. Keep the existing seeded Acme audit unchanged.
2. Add an intake preview/import API.
3. For demo, map the imported Gmail thread to the existing Acme booking when the
   content matches Acme's booking email.
4. Later, generalize booking creation.

Potential API:

```text
GET  /api/intake/gmail/search?q=...
POST /api/intake/gmail/import { thread_id, booking_id? }
POST /api/audit/from-intake { intake_id, booking_id? }
```

Implemented API contract:

```text
GET  /api/intake/gmail/search?q=...
POST /api/intake/gmail/import { thread_id }
POST /api/audit/from-intake
```

`POST /api/audit/from-intake` accepts either:

```json
{
  "body_text": "Acme Robotics booking email...",
  "source": "manual_paste",
  "sender": "maya.chen@acmerobotics.com",
  "subject": "Acme Robotics stay",
  "booking_id": "BKG-2026-0718-ACME"
}
```

or:

```json
{
  "messages": [
    {
      "source": "gmail",
      "external_id": "gmail-message-id",
      "thread_id": "gmail-thread-id",
      "sender": "maya.chen@acmerobotics.com",
      "subject": "Acme Robotics stay",
      "received_at": "2026-07-10T09:00:00Z",
      "body_text": "Acme Robotics booking email..."
    }
  ]
}
```

First version behavior:

- If `booking_id` is supplied, the audit runs against that booking.
- If the intake content matches Acme Robotics / the Acme demo booking, it maps
  to `BKG-2026-0718-ACME`.
- If no booking can be mapped, it falls back to the Acme demo booking and states
  that first-version limitation in `mapping_reason`.
- It does not create new bookings, new promises, or new tasks.

Acceptance criteria:

- Existing `/api/audit/BKG-2026-0718-ACME` behavior is unchanged.
- Gmail import can feed the same message content into Info Analysis / agent
  proposal.
- The UI can show "source: Gmail" without needing a new workflow.

Important constraint:

- Do not break the Acme invariant: booking `BKG-2026-0718-ACME`, exactly six
  expected promises, `TASK-102` due at 14:00, and `TASK-103` open.

## 4. Metrics And Evaluation Plan

### Evaluation Methodology

Do not frame this as a generic "large model eval". This is a product evaluation
for a promise-verification workflow.

Use standard evaluation methods, then adapt them to StayOps:

| General method | StayOps adaptation | Why it is specific |
| --- | --- | --- |
| Golden dataset / exact-match scoring | Each booking case has expected promises, final statuses, approval flags, required tools, and evidence requirements. | Hotel promise verification has business-correct answers for many fields; exact scoring is more trustworthy than subjective judging. |
| Safety false-positive testing | `unsafe_overpromise_count` checks that unsupported promises are never marked `verifiable`. | The product's main risk is making a promise the hotel cannot support. False positives are worse than conservative escalation. |
| Escalation / handoff recall | `human_control_coverage` checks that risky or approval-needed promises reach the duty manager. | The primary persona is the duty manager; "keep the human in control" is part of the product and hackathon story. |
| Grounding / evidence checks | `evidence_coverage` checks source quotes, SOP/policy evidence, and tool-derived evidence. | StayOps must explain why a promise is safe, risky, missing information, or blocked. |
| Agent trajectory / trace review | `tool_call_coverage` and Phoenix trace coverage check that Gemini/ADK used tools and produced auditable spans. | The app must prove real agent/tool activity and meaningful Arize/Phoenix integration, not only final UI state. |
| Workflow outcome scoring | Complaint trace and SOP violation checks score whether the system maps failure back to the promise/task/rule. | Complaint recovery is a core second-act workflow, not a generic chatbot answer. |
| Operational impact estimate | Time, manual lookup count, and cost-per-run are estimated from workflow steps, app telemetry, and clearly stated assumptions. | Business value depends on reducing review/recovery work, but hackathon evidence must avoid fake ROI claims. |

References to cite in README/submission materials if needed:

- OpenAI agent evals: traces, tool calls, guardrails, and workflow-level scoring.
  https://developers.openai.com/api/docs/guides/agent-evals
- Google Gen AI evaluation: datasets, metrics, rubric-based and computation-based
  evaluation. https://cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-overview
- Arize Phoenix evaluation: deterministic and LLM-assisted evals over traces,
  datasets, and experiments. https://arize.com/docs/phoenix/evaluation/llm-evals
- NN/g UX metrics: task success, task time, and self-reported workload/usability
  are useful together, but small samples should not be overclaimed.
  https://www.nngroup.com/articles/measuring-perceived-usability/
- Brynjolfsson, Li, and Raymond, "Generative AI at Work": customer-support AI
  assistance improved issues resolved per hour in a real workplace. Use only as
  directional evidence that AI assistance can improve service-work productivity,
  not as a direct hotel ROI claim. https://arxiv.org/abs/2304.11771

### Phase 5 - Metric Definitions And Golden Targets

Core demo metrics:

| Metric | Definition | Acme Target |
| --- | --- | --- |
| Promise classification accuracy | Final statuses match the golden Acme expectation | 6/6 |
| Unsafe overpromise count | Unsupported promises incorrectly marked `verifiable` | 0 |
| Missing-info recall | Transfer/invoice missing fields are detected | 2/2 |
| Human-control coverage / escalation recall | Risky/approval-needed promises route to manager review | 100% |
| Evidence coverage | Each decision has source quote + policy/tool evidence | 6/6 |
| Complaint trace accuracy | Complaint maps to broken promise/task root cause | expected quiet-room and projector findings |
| SOP violation detection | Projector task due-time mismatch is detected | detects 14:00 vs SOP 12:00 |
| Arize trace coverage | Audit run has Phoenix trace summary when configured | present in connected env |
| Tool-call coverage | Tool calls are captured for agent/policy verification | non-zero on agent path |
| Latency | Audit completes fast enough for live demo | target under 10s where credentials/network allow |
| Manual lookup reduction | Count how many source systems/tables the agent checks automatically | baseline steps vs tool calls |
| Cost per audit run | Estimated Gemini/ADK/Phoenix cost per audit from token/tool usage where available | documented estimate, not a pass/fail gate |

Safety interpretation:

- `verifiable` is only safe when fresh evidence supports execution.
- `cannot_confirm`, `missing_info`, `at_risk`, and `needs_approval` are not
  failures; they are safety wins when the data is genuinely incomplete or risky.
- Domain-specific metrics are allowed because the product is domain-specific.
  The reviewable claim is not "this score generalizes to all hotels"; it is
  "for known hotel promise workflows, the agent follows the declared spec and
  does not make unsafe commitments."

Human-authored case expansion:

- Add 2-3 realistic but synthetic hotel cases written by humans familiar with
  hotel operations.
- Each case must be complete enough that another agent or teammate can run the
  scenario without asking the author what the "right answer" is.
- Required case contents:
  1. Case identity:
     - `case_id`, short title, hotel context, and whether the case is safe for
       public repo/demo video.
     - Author/reviewer name or initials and review date.
  2. Source messages:
     - One or more synthetic messages such as sales email, guest follow-up,
       internal note, OTA note, or complaint.
     - For each message: `message_id`, source/channel, sender role, timestamp,
       subject if email-like, and body text.
     - The messages should contain all promise language the agent is expected
       to extract; do not hide required facts outside the case file.
  3. Booking facts:
     - Booking id, guest/company name, arrival/departure dates, arrival time,
       room count, room mix if relevant, event space, event time, contact name,
       and current booking status.
     - If a fact is unknown, write it as missing instead of inventing it later.
  4. Operational evidence:
     - Relevant SOP/policy rules.
     - Relevant inventory/readiness/event-space/transport/billing/task facts.
     - Any data freshness constraint or `DEMO_NOW` assumption if it affects the
       expected answer.
  5. Golden promise list:
     - One row per expected promise/request.
     - Include `promise_id`, natural-language promise, rule key/category,
       department, expected final status, whether manager approval is required,
       missing fields if any, and whether `verifiable` is forbidden.
  6. Expected evidence and tools:
     - Required source quote(s) or source message ids.
     - Required SOP/tool evidence keywords.
     - Required tool families, such as freshness, SOP, room readiness, event
       space, inventory, billing, transport, task board, or complaint trace.
  7. Expected task/approval outcome:
     - Whether a task should be created.
     - Expected department, due-time rule, assignee type if relevant, and task
       status for complaint-trace cases.
     - Whether the manager should approve, block, or ask for more information.
  8. Complaint/recovery expectation, only if the case includes a complaint:
     - Complaint text.
     - Expected matched promise(s), linked task(s), failure point(s), recovery
       action, and postmortem/SOP suggestion.
  9. Edge-case note:
     - Why this case exists in the eval set, for example missing information,
       overpromise risk, approval needed, SOP timing violation, conflicting
       evidence, or complaint root-cause tracing.
- Suggested skeleton:

```json
{
  "case_id": "CASE-002",
  "title": "Late VIP arrival with upgrade request",
  "public_safe": true,
  "reviewed_by": "initials",
  "messages": [
    {
      "message_id": "MSG-CASE-002-001",
      "source": "sales_email",
      "sender_role": "corporate booker",
      "received_at": "2026-07-21T09:30:00Z",
      "subject": "Executive arrival requests",
      "body": "..."
    }
  ],
  "booking_facts": {
    "booking_id": "BKG-CASE-002",
    "arrival_date": "2026-07-22",
    "departure_date": "2026-07-24",
    "arrival_time": "21:30",
    "rooms": 3,
    "event_space": null,
    "status": "confirmed"
  },
  "operational_evidence": {
    "sop_rules": ["..."],
    "inventory_or_readiness": ["..."],
    "existing_tasks": []
  },
  "golden_promises": [
    {
      "promise_id": "P-CASE-002-001",
      "text": "...",
      "rule_key": "...",
      "department": "front_desk",
      "expected_status": "needs_approval",
      "approval_required": true,
      "missing_fields": [],
      "forbid_verifiable": true,
      "required_tools": ["retrieve_sop", "check_room_readiness"],
      "evidence_must_mention": ["manager approval"]
    }
  ],
  "expected_tasks": [],
  "complaint_trace": null,
  "edge_case_note": "Tests escalation recall for upgrade-like promises."
}
```
- AI may generate wording variants after the human goldens exist, but AI-created
  variants must not be treated as the authority for correctness.
- For the hackathon, do not chase a large dataset. A practical target is:
  Acme golden case + 2 human-authored cases + 5-10 AI-generated wording
  variants that preserve the same goldens.

Operational impact estimation:

- Do not claim a hard ROI percentage unless it is measured.
- Use a simple workflow-step model instead:
  1. Define the baseline manual workflow steps: read message, identify promises,
     check SOP, check readiness/inventory/event space, decide escalation, create
     tasks, and trace complaint root cause.
  2. Count which steps StayOps performs automatically via tool calls or traceable
     policy checks.
  3. Measure the app-side latency for audit and complaint trace runs.
  4. Use conservative time ranges as assumptions for the remaining manual steps,
     and label them as assumptions.
  5. If time allows, ask one teammate with hotel experience to do one manual
     dry run on the Acme case and record the elapsed time as a calibration note.
     This is optional and illustrative, not a statistically valid human study.
- Suggested output wording:
  "StayOps reduces a multi-step manual review into a traceable audit run. In the
  demo, the system automatically checks N evidence sources/tools, flags unsafe
  commitments, and returns a complaint root-cause trace in X seconds. Manual
  time savings are presented as scenario assumptions, not validated ROI."

Potential business metrics for later productization:

- average review time per booking message
- number of manual system lookups avoided
- unsafe promise false-positive rate
- missing-information recall
- escalation precision/recall for manager review
- complaint mean time to root cause
- estimated cost per audit run
- guest recovery response time

### Phase 6 - Metrics Computation API/Script

Preferred implementation:

- Add a backend metrics module that computes metrics from an audit result.
- Add a script or API endpoint for repeatable demo validation.

Potential files:

- `src/lib/evaluation/metrics.ts`
- `src/app/api/eval/[booking_id]/route.ts`
- `scripts/eval-acme.ts`

Potential output:

```json
{
  "booking_id": "BKG-2026-0718-ACME",
  "classification_accuracy": { "passed": 6, "total": 6 },
  "unsafe_overpromise_count": 0,
  "missing_info_recall": { "passed": 2, "total": 2 },
  "evidence_coverage": { "passed": 6, "total": 6 },
  "complaint_trace": { "quiet_room": true, "projector_due_time": true },
  "arize_trace_present": true,
  "latency_ms": 4200,
  "manual_lookup_sources_checked": 5,
  "cost_estimate_usd": null
}
```

Acceptance criteria:

- Metrics can run without Gemini credentials using deterministic fallback.
- Agent path can add extra observability metrics when ADK/Gemini/Arize are
  configured.
- The output is stable enough to cite in README/submission/demo video.
- Business-impact fields must be labeled as measured, estimated, or unavailable.
- Small human checks must be described as calibration or qualitative validation,
  not statistically significant evaluation.

### Phase 7 - Arize/Phoenix Metric Trace Linkage

Goal:

- Make the partner integration count as audit/evaluation infrastructure, not a
  decorative badge.

Desired behavior:

- Each audit run produces or reads a Phoenix trace summary.
- Metrics response includes trace id when available.
- UI/README can say Phoenix stores reasoning/tool-call/policy evidence and the
  app reads it back for self-review.

Acceptance criteria:

- No metric should be upgraded just because Arize exists.
- Arize is observational and evaluative only.
- If Phoenix is unavailable, metrics still run with `arize_trace_present=false`.

## 5. Frontend Handoff Contract

Frontend owner can build the UI from these backend outputs:

Gmail:

- `GET /api/intake/gmail/search?q=acme`
  - configured future response: `{ ok: true, source: "gmail", data:
    GmailThreadSummary[] }`
  - current degraded response: `{ ok: false, source: "gmail", status:
    "not_configured", reason, required_env }`
- `POST /api/intake/gmail/import { thread_id }`
  - configured future response: `{ ok: true, source: "gmail", data:
    IntakeMessage[] }`
  - current degraded response mirrors search when Gmail OAuth is absent.
- Use `source: "gmail"` for the source badge when imported messages are present.
- Use `body_text`, `subject`, `sender`, and `received_at` for imported message
  preview.
- Trigger audit with `POST /api/audit/from-intake`.

Metrics:

- `GET/POST /api/eval/[booking_id]`
  - `classification_accuracy`
  - `approval_compliance`
  - `unsafe_overpromise_count`
  - `missing_info_recall`
  - `human_control_coverage`
  - `evidence_coverage`
  - `tool_call_coverage`
  - `complaint_trace`
  - `sop_violation_detection`
  - `arize_trace_present`
  - `phoenix_trace_id`
  - `latency_ms`
  - `manual_lookup_sources_checked`
  - `cost_estimate_usd`
  - `business_impact_basis`
  - `per_promise`
- Use compact metric cards for the ratio/scalar fields.
- Use pass/fail labels from `overall_passed` and each `per_promise.*_ok`.
- Link or display Phoenix trace id only when `arize_trace_present=true`.
- For non-verifiable statuses, explain them as safety wins only when the metric
  target expects `cannot_confirm`, `missing_info`, `at_risk`, or
  `needs_approval`.

Report (Summary/Improvement agent, planned this sprint):

- `GET /api/report`
  - aggregates from existing data: promise status distribution, overpromises blocked
    by the gate, task overdue rates by department, recurrence records, sources
    auto-checked per audit
  - `analysis_text`: Gemini-written manager-readable summary of the same JSON
  - every economic field carries a basis label: `measured` / `estimated` /
    `assumption` — the UI must render the label next to the number
- Frontend: 2–3 simple charts (CSS bars are fine, no chart library required) + the
  analysis text. Keep it inside the judge view or a secondary tab — not on the
  manager's default attention queue (spec §9.0).

Do not require frontend work before backend contracts exist.

## 6. Human-Owned Tasks And Checks

This chapter records work that should be done by the human team, not silently
invented by an agent.

### Case And Golden Data

- Write 2-3 realistic synthetic hotel cases based on real workflow knowledge.
- Confirm that no real guest, employer, or private hotel data is included.
- For each case, manually approve the expected promises, statuses, escalations,
  required evidence, and complaint/root-cause outcomes.
- Mark reviewer name/initials and review date in the case file or adjacent notes.
- Decide which cases are safe to show in the demo video and public repo.

### Gmail / Intake

- Choose the Gmail account or synthetic mailbox used for the demo.
- Confirm the mailbox contains only safe synthetic/sample data.
- Enable Gmail API and configure OAuth test users if Gmail import is built.
- Confirm read-only Gmail scope only.
- Confirm hosted redirect URI before Cloud Run demo.

### Business Impact Evidence

- Decide whether to include operational impact claims in the submission.
- If yes, write down the baseline manual workflow assumptions:
  - steps required by a duty manager
  - assumed time range per step
  - which steps StayOps automates or supports
  - which numbers are measured by the app vs estimated by the team
- Optional: have the teammate with hotel experience perform one Acme manual
  dry run and record elapsed time as a calibration note.
- Do not present the dry run as statistically valid research.

### Submission Review

- Confirm the eval claims match the implemented script/API.
- Confirm Phoenix/Arize claims match the configured environment.
- Confirm Cloud Run URL and repo are public before submission.
- Confirm no docs claim that Arize changes final business decisions.

## 7. Manual Runbook

After implementation, run:

```bash
npm run typecheck
npm run build
```

If eval script is implemented:

```bash
npm run dev -- --hostname 127.0.0.1
npm run eval
```

Useful local API checks:

```bash
curl http://127.0.0.1:3000/api/eval/BKG-2026-0718-ACME
curl "http://127.0.0.1:3000/api/intake/gmail/search?q=acme"
curl -X POST http://127.0.0.1:3000/api/intake/gmail/import \
  -H "Content-Type: application/json" \
  -d "{\"thread_id\":\"demo\"}"
curl -X POST http://127.0.0.1:3000/api/audit/from-intake \
  -H "Content-Type: application/json" \
  -d "{\"body_text\":\"Acme Robotics needs a quiet king room and projector.\",\"source\":\"manual_paste\"}"
```

Expected local behavior without Gmail OAuth:

- `/api/eval/[booking_id]` returns stable metrics JSON from
  `evals/goldens.json` and can pass without Gemini or Phoenix credentials.
- Gmail endpoints return `ok:false`, `status:"not_configured"`, and the required
  env var list.
- `/api/audit/from-intake` maps Acme-like content to
  `BKG-2026-0718-ACME` and returns the normal audit object.

## 8. Open Questions

- Which Gmail account/thread will be shown in the demo?
- Should Gmail import create an `intake_id` stored in memory/SQLite, or should it
  run audit immediately without persistence?
- Should the first version only support the Acme Gmail thread, or also generic
  bookings?
- Should metrics be shown in the main manager dashboard or a judge-only panel?
- Should Arize trace id be stored per audit result or fetched live from Phoenix?
- Which 2-3 human-authored hotel cases should be added after Acme?
- Should business-impact numbers be shown in the public UI, README, or only in
  submission/demo narration?

## 9. Recommended Order Of Work

1. Merge Claude's latest branch into the working branch and verify build.
2. Implement metrics first because they do not depend on OAuth.
3. Add complaint trace, SOP violation, and Phoenix trace fields to the eval
   output.
4. Add the human-owned case template and 2-3 human-authored cases if time allows.
5. Add Gmail intake contract and normalization.
6. Add Gmail OAuth/API only after the backend contract is stable.
7. Hand frontend the response shapes for Gmail import and metrics display.
8. Run full demo verification locally and on Cloud Run.

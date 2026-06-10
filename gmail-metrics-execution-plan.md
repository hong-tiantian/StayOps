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
- [ ] Phase 1 - Gmail intake product contract
- [ ] Phase 2 - Gmail API/auth decision and local credentials
- [ ] Phase 3 - Email normalization adapter
- [ ] Phase 4 - Audit integration contract
- [ ] Phase 5 - Metrics definitions and golden acceptance targets
- [ ] Phase 6 - Metrics computation API/script
- [ ] Phase 7 - Arize/Phoenix metric trace linkage
- [ ] Phase 8 - Frontend handoff contract
- [ ] Phase 9 - Verification and manual runbook

### Current Assumption

Claude/teammate is handling the frontend-facing trace/demo changes and the
current agent architecture cleanup. This plan should stay backend/documentation
first until those changes are merged.

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
- auto-reply or auto-send email
- mailbox-wide background automation
- production auth/tenant management
- real PMS/channel-manager integration
- Gmail write scopes
- generic document ingestion unrelated to booking/guest promise messages

Gmail access should be read-only and user-triggered for the hackathon demo.

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

Acceptance criteria:

- Existing `/api/audit/BKG-2026-0718-ACME` behavior is unchanged.
- Gmail import can feed the same message content into Info Analysis / agent
  proposal.
- The UI can show "source: Gmail" without needing a new workflow.

Important constraint:

- Do not break the Acme invariant: booking `BKG-2026-0718-ACME`, exactly six
  expected promises, `TASK-102` due at 14:00, and `TASK-103` open.

## 4. Metrics And Evaluation Plan

### Phase 5 - Metric Definitions And Golden Targets

Core demo metrics:

| Metric | Definition | Acme Target |
| --- | --- | --- |
| Promise classification accuracy | Final statuses match the golden Acme expectation | 6/6 |
| Unsafe overpromise count | Unsupported promises incorrectly marked `verifiable` | 0 |
| Missing-info recall | Transfer/invoice missing fields are detected | 2/2 |
| Human-control coverage | Risky/approval-needed promises route to manager review | 100% |
| Evidence coverage | Each decision has source quote + policy/tool evidence | 6/6 |
| Complaint trace accuracy | Complaint maps to broken promise/task root cause | expected quiet-room and projector findings |
| SOP violation detection | Projector task due-time mismatch is detected | detects 14:00 vs SOP 12:00 |
| Arize trace coverage | Audit run has Phoenix trace summary when configured | present in connected env |
| Tool-call coverage | Tool calls are captured for agent/policy verification | non-zero on agent path |
| Latency | Audit completes fast enough for live demo | target under 10s where credentials/network allow |

Safety interpretation:

- `verifiable` is only safe when fresh evidence supports execution.
- `cannot_confirm`, `missing_info`, `at_risk`, and `needs_approval` are not
  failures; they are safety wins when the data is genuinely incomplete or risky.

### Phase 6 - Metrics Computation API/Script

Preferred implementation:

- Add a backend metrics module that computes metrics from an audit result.
- Add a script or API endpoint for repeatable demo validation.

Potential files:

- `src/lib/evaluation/metrics.ts`
- `src/app/api/eval/acme/route.ts`
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
  "arize_trace_present": true
}
```

Acceptance criteria:

- Metrics can run without Gemini credentials using deterministic fallback.
- Agent path can add extra observability metrics when ADK/Gemini/Arize are
  configured.
- The output is stable enough to cite in README/submission/demo video.

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

- thread search results
- selected/imported thread
- source badge: `gmail`
- imported message preview
- audit trigger

Metrics:

- compact metric cards
- pass/fail labels
- Phoenix trace id/link if present
- "safety wins" explanation for non-verifiable statuses

Do not require frontend work before backend contracts exist.

## 6. Manual Runbook

After implementation, run:

```bash
npm run typecheck
npm run build
```

If Gmail is implemented:

```bash
# exact command TBD after OAuth/client setup
npm run dev
# open localhost and import a test Gmail thread
```

If eval script is implemented:

```bash
# exact script name TBD
npm run eval
```

Human-owned checks:

- OAuth client and test users configured.
- Gmail API enabled.
- Demo mailbox contains only safe synthetic/sample data.
- Cloud Run env vars configured.
- Hosted URL tested after deploy.

## 7. Open Questions

- Which Gmail account/thread will be shown in the demo?
- Should Gmail import create an `intake_id` stored in memory/SQLite, or should it
  run audit immediately without persistence?
- Should the first version only support the Acme Gmail thread, or also generic
  bookings?
- Should metrics be shown in the main manager dashboard or a judge-only panel?
- Should Arize trace id be stored per audit result or fetched live from Phoenix?

## 8. Recommended Order Of Work

1. Merge Claude's latest branch into the working branch and verify build.
2. Implement metrics first because they do not depend on OAuth.
3. Add Gmail intake contract and normalization.
4. Add Gmail OAuth/API only after the backend contract is stable.
5. Hand frontend the response shapes for Gmail import and metrics display.
6. Run full demo verification locally and on Cloud Run.


# Agent Team Design

StayOps is a promise verification and recovery layer, not a free-form chatbot and not a
generic task manager. The agent team keeps the duty manager in control: Gemini can
extract, triage, draft, and propose — but **two deterministic gates** (the promise policy
and the reply gate) and manager approval decide what gets promised, sent, or handed off.

One sentence for the whole team: **the LLM does the understanding, the gates hold the
authority, the manager owns the risk, and anything with no answer in system data goes to
a human.**

Status legend: ✅ implemented · 🔨 current sprint · 🗺 roadmap

## Core Flow

```text
auto-watched mailbox / manual paste / seeded CSV
-> Intake Agent            (triage: clarity × importance)
-> Info Analysis           (basic vs extra, typos, contradictions)
-> Verification Agent      (read-only tools, evidence)
-> Decision Rules / Safety Gate   (deterministic promise policy)
-> Guest Reply Agent       (reply gate: auto-send vs draft)
-> Task Planning Agent     (handoff / follow-up / approval plans)
-> Manager attention queue (approve / edit / reject)
-> Evaluation & Recovery   (complaint loop + recurrence)
-> Monitoring (Arize/Phoenix) + Summary/Improvement
```

## 1. Intake Agent 🔨

Responsibilities:

- Watch ONE designated demo mailbox by read-only polling. A `SimulatedInbox` fallback
  (seeded emails dropped into the queue on a timer) yields the identical UX when OAuth is
  unavailable — demo-safe by construction.
- Triage every intake on the clarity × importance matrix (spec §3.6) and compute the
  transparent priority score (risk, VIP, order size, SOP-deadline proximity, aging,
  recurrence, active complaint).
- Detect suspected typos and contradictions. Contradictory basic info →
  `basic_info_status: conflict`; contradictory extras → status `conflict`; suspected typos
  → a targeted clarifying question via the Guest Reply Agent.

Must not:

- Touch the Acme main flow — new intake always creates a new booking context.
- Request Gmail write scopes or scan mailboxes beyond the designated demo mailbox.
- Hardcode pattern matching as the primary extraction path; clarity/importance judgments
  are LLM judgments, only the *ranking formula* is deterministic (so the manager can see
  why an item is on top).
- Add new enum values or bespoke verifier functions for new scenarios — schema altitude
  rules (spec §3.7) are binding: coarse domains + free-text subtype + generic
  verification path + conservative fallback.

## 2. Info Analysis ✅ (extraction source upgraded 🔨)

Responsibilities:

- Read reservation context and source messages.
- Identify intake channel and scope; check scope-specific basic-info completeness
  (explicit checklists in spec §3.1, including the always-required reply channel).
- Extract extra items with source message IDs and quotes; assign `domain`, `subtype`,
  `rule_key`, clarity, missing fields, and verification route.

Current-sprint change: extraction must operate on the **actual message content** (entry
point `runPromiseAuditFromMessages` in `src/lib/classifier.ts`), not on the seeded ledger.
For the Acme demo booking, the seeded ledger remains the fixture and acceptance anchor —
extracted items aligning to known `rule_key`s map onto the stable `P-001…P-006` IDs;
extracted items with no ledger match surface as "unmatched promise — needs manual triage"
(`cannot_confirm`).

## 3. Verification Agent ✅

Gathers evidence by calling read-only tools: `check_data_freshness`, `get_reservation`,
`search_messages`, `check_room_readiness`, `check_event_space`, `retrieve_sop`,
`check_inventory`. It must not create tasks and must not upgrade a promise to a guarantee.

## 4. Decision Rules / Safety Gate ✅ (+ basic-info gate 🔨)

The deterministic policy layer is the final executable decision maker:

- If a required source is stale, status cannot be `verifiable`.
- If required guest/company fields are missing, status is `missing_info`.
- If SOP requires approval, the agent cannot auto-commit.
- If `basic_info_status` is not `complete`, extras cannot be `verifiable` (downgraded) 🔨.
- **If the answer does not exist in system data, the item routes to a human** (spec §8.1
  first rule).
- Group early check-in cannot be guaranteed without enough inspected/released rooms.
- Quiet king for a VP remains `at_risk` until manager approval and room lock.
- Projector setup must flag the SOP due-time mismatch: due 12:00, not 14:00.

Gemini proposes. Rules decide.

## 5. Guest Reply Agent 🔨

Drafts ALL guest-facing text. Sending passes through the deterministic **reply gate**
(spec §4.3):

- Acknowledgements, targeted questions (missing fields, suspected typos, contradictions),
  and restatements of `verifiable`/approved facts → auto-send allowed.
- Any guarantee about a non-verifiable, unapproved item → blocked into a draft for the
  manager. One unverified commitment blocks the whole reply.
- Demo sending is **simulated** in the StayOps thread view, labeled
  `auto-sent (simulated)`; every auto-send is logged as `auto_handled` in the manager's
  auto-handled lane.

The reply gate is the same design idea as the promise policy, applied to outbound text:
the LLM writes, the gate decides. This is deliberately the one place where "hardcoding"
is correct — send authority is never self-certified by the model.

## 6. Task Planning Agent ✅

Turns verified or guarded outcomes into proposed next actions without mutating seeded
demo tasks by default.

| Condition | Plan |
| --- | --- |
| Basic info incomplete | Targeted follow-up (auto-asked via Reply Agent when commitment-free). |
| Basic complete + no extra | Safe confirmation summary (`auto_handled` when sent). |
| Extra `verifiable` | Department handoff/task. |
| Extra `at_risk` + approval required | Manager approval request. |
| Extra `needs_approval` | Manager approval request. |
| Extra `missing_info` | Follow-up question (auto-askable). |
| Extra `cannot_confirm` | Cautious reply draft; no guarantee. |
| Extra `conflict` | Escalate. |

## 7. Evaluation & Recovery ✅ (loop 🔨)

Post-execution evaluation and complaint tracing — now an explicit **loop** (spec §4.4):

1. Recovery actions are themselves promises and re-enter the same pipeline
   (verify → approve → task → track), linked to the original promise and complaint.
2. `service_result` (`fulfilled`/`failed`/`recovered`/`exceeded`) closes each pass.
3. Recurrence escalates instead of repeating: 1st occurrence = standard recovery;
   recurrence in the window = forced into *needs attention* with an upgraded remedy;
   a pattern = handed to the Summary/Improvement agent as an asset/SOP issue.

For the Acme demo, the expected trace still resolves to the uncompleted room-lock task
`TASK-103` and projector task `TASK-102` due at 14:00 when SOP required 12:00.

## 8. Monitoring — Arize/Phoenix ✅

Phoenix **is the team's monitoring agent**: real-time spans during a run plus post-hoc
trace review. It records Gemini turns, tool calls, policy overrides, injection-screen
results, and manager feedback; token/cost/latency are read back from the same traces via
the Phoenix MCP (`/api/insights`). It is observational and evaluative only — it must
never change a business decision or bypass deterministic policy.

## 9. Summary / Improvement Agent 🔨 minimal · 🗺 full

Purpose: turn operational history into economic insight — the "why this saves money"
layer.

Minimal version (current sprint):

- `/api/report` aggregates from existing data: promise status distribution, overpromises
  blocked by the gate, task overdue rates by department, recurrence records (e.g. the
  seeded room-402 pattern), sources auto-checked per audit.
- Gemini writes the manager-readable analysis from that JSON (a legitimate LLM use:
  summarization without decision authority).
- 2–3 simple charts + the text summary in the UI.
- **Every economic figure is labeled measured / estimated / assumption-based** — no
  invented ROI (rule inherited from `gmail-metrics-execution-plan.md`).

Full version (roadmap): cross-booking history, asset-level recommendations ("take room
402 out of inventory for HVAC repair"), recurring-issue economics, SOP change proposals
with expected impact.

## Current Implementation Status

- Local ADK / Agent Builder service path exists under `agent/promise_agent`;
  `ADK_AGENT_URL` makes ADK the primary orchestration path. In-app Gemini ReAct loop and
  deterministic policy remain fallbacks. Cloud Run deployment of both services is wired
  via `scripts/deploy-cloud-run.sh`.
- Deterministic policy is the final safety decision in all paths.
- Current sprint (three parallel workstreams): ① extraction-driven audit +
  basic-info gate + `runPromiseAuditFromMessages` seam; ② eval upgrade (goldens.json as
  single source, extraction recall, policy-overrule rate); ③ auto-intake (poller +
  simulated inbox) + triage queue + reply gate.
- Roadmap: real email sending behind the reply gate, per-promise Phoenix deep links,
  full Summary/Improvement agent, real PMS adapters.

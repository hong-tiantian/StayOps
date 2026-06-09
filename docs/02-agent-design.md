# Agent Team Design

StayOps is a promise verification and recovery layer, not a free-form chatbot and not a
generic task manager. The agent team keeps the duty manager in control: Gemini can
extract and propose, but deterministic rules and manager approval decide what can be
promised or handed off.

## Core Flow

```text
guest/order input
-> Info Analysis
-> Basic info completeness
-> Extra item extraction
-> Verification Agent
-> Decision Rules / Safety Gate
-> Task Planning Agent
-> Evaluation & Recovery
-> Arize Monitoring / Audit
```

## 1. Info Analysis

Responsibilities:

- Read reservation context and source messages.
- Identify intake channel and scope.
- Check scope-specific basic info completeness.
- Extract extra items only when basic info is complete enough.
- Attach source message IDs and source quotes.
- Assign `domain`, `subtype`, internal `rule_key`, clarity, missing fields, and verification route.

For Acme, the expected scope is `corporate_group_event`, the basic info is complete, and
the six extra items are early check-in, quiet king room, gluten-free breakfast, projector,
airport transfer, and company invoice.

## 2. Verification Agent

The verification agent gathers evidence. It can call read-only tools such as:

- `check_data_freshness`
- `get_reservation`
- `search_messages`
- `check_room_readiness`
- `check_event_space`
- `retrieve_sop`
- `check_inventory`

It should not create tasks directly and should not upgrade a promise to a guarantee.

## 3. Decision Rules / Safety Gate

The deterministic policy layer is the final executable decision maker.

Rules:

- If a required source is stale, status cannot be `verifiable`.
- If required guest/company fields are missing, status is `missing_info`.
- If SOP requires approval, the agent cannot auto-commit.
- Group early check-in cannot be guaranteed without enough inspected/released rooms.
- Quiet king for a VP remains `at_risk` until manager approval and room lock.
- Projector setup must flag the SOP due-time mismatch: due at 12:00, not 14:00.

Gemini proposes. Rules decide.

## 4. Task Planning Agent

Task planning turns verified or guarded outcomes into proposed next actions without
mutating seeded demo tasks by default.

Routing:

| Condition | Plan |
| --- | --- |
| Basic info incomplete | Create targeted follow-up. |
| Basic complete + no extra | Draft safe confirmation summary. |
| Extra `verifiable` | Propose department handoff/task. |
| Extra `at_risk` + approval required | Request manager approval. |
| Extra `missing_info` | Create follow-up task/question. |
| Extra `cannot_confirm` | Draft cautious reply; no guarantee. |
| Extra `conflict` | Escalate. |

## 5. Evaluation & Recovery

Evaluation is post-execution. It checks whether approved/created handoffs were completed
and traces complaints back to the exact promise and task failure.

For the Acme demo, recovery is deterministic but no longer a pure fixed-ID branch:
complaint signals map to ledger `rule_key` values, then to linked tasks. The expected
trace still resolves to the uncompleted room-lock task `TASK-103` and projector task
`TASK-102` being due at 14:00 when SOP required 12:00.

## 6. Arize Monitoring / Audit

Arize/Phoenix is an observability and self-review layer. It traces Gemini reasoning,
tool calls, policy overrides, and manager feedback. It must not change business
decisions or bypass deterministic policy.

## Current Implementation Status

- Local ADK / Agent Builder service path exists under `agent/promise_agent`.
- `ADK_AGENT_URL` makes ADK the primary orchestration path when configured.
- The in-app Gemini ReAct loop remains a fallback.
- Deterministic policy remains the final safety decision and offline fallback.
- Info Analysis and output-only Task Planning are exposed through the audit result.
- Audit responses include an `agent_trace` stage list for future UI display.
- Historical approval records are separated from runtime manager approvals.
- Cloud Run deployment, per-promise Phoenix trace links, and broader generalized recovery
  remain pending.

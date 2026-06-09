# Agent Decision Design

StayOps should not behave like a free-form chatbot. Hotel operations need traceable decisions, evidence, and human approval. The agent should be designed as a stateful decision system.

## Core Loop

Every promise moves through the same decision loop:

```text
extract promise
-> identify promise type
-> load hotel profile and rules
-> plan required data checks
-> check source freshness
-> call operational tools
-> evaluate evidence
-> decide next action
-> request approval or create task
-> monitor execution
-> trace failure if a complaint arrives
```

The agent is allowed to reason about what to check next, but it is not allowed to make unsupported commitments.

## Agent Layers

### 1. Promise Extractor

Reads guest messages, sales notes, and complaints. It produces structured promise candidates.

Example output:

```json
{
  "promise_text": "quiet king room away from elevators for the VP",
  "promise_type": ["preference", "risk_sensitive_request"],
  "owner_department": "front_desk",
  "source_message_id": "MSG-001"
}
```

### 2. Decision Planner

Decides what the agent must check before making a decision.

For a quiet-room request, it should plan:

- Check room inventory freshness.
- Check room readiness freshness.
- Retrieve quiet-room SOP.
- Check candidate rooms against quiet-zone and elevator constraints.
- Check existing room-blocking tasks.

### 3. Tool Executor

Calls operational tools and returns structured evidence. This layer does not make business decisions.

Example tools:

- `check_data_freshness`
- `get_reservation`
- `search_messages`
- `check_room_readiness`
- `check_event_space`
- `retrieve_sop`
- `check_existing_tasks`
- `create_ops_task`
- `trace_broken_promise`

### 4. Evidence Evaluator

Turns tool results into a promise status.

Rules:

- If a required source is stale, status cannot be `verifiable`.
- If required guest fields are missing, status must be `missing_info`.
- If manager approval is required, the agent cannot execute directly.
- If status is `cannot_confirm`, guest-facing language cannot contain a guarantee.
- If an existing task violates SOP due time, the agent must flag it.

### 5. Action Decider

Chooses the next operational action.

Status-to-action mapping:

| Status | Next Action |
| --- | --- |
| `verifiable` | Create or update the department task. |
| `at_risk` | Request manager approval or suggest an alternative. |
| `missing_info` | Create a guest/company follow-up. |
| `cannot_confirm` | Draft cautious language and avoid guarantee wording. |
| `conflict` | Escalate and block execution. |
| `task_created` | Monitor task status and due time. |
| `failed` | Trigger complaint recovery. |

### 6. Monitor And Recovery

The agent continues after audit. It checks whether approved promises became tasks, whether tasks are overdue, and whether a complaint matches a prior promise.

Example:

```json
{
  "event": "task_overdue",
  "promise_id": "P-002",
  "task_id": "TASK-103",
  "next_action": "escalate_to_front_desk_manager",
  "reason": "VIP room-blocking task is still open before arrival."
}
```

## Promise State

Each promise should be stored with state, not recomputed from scratch as a loose chat response.

```json
{
  "promise_id": "P-002",
  "state": "awaiting_approval",
  "status": "at_risk",
  "required_sources": ["room_inventory", "room_readiness", "hotel_sop"],
  "freshness": {
    "room_inventory": "fresh",
    "room_readiness": "fresh",
    "hotel_sop": "fresh"
  },
  "approval_required": true,
  "next_action": "manager_review",
  "linked_task_id": null
}
```

Recommended states:

```text
new
needs_data
evaluating
awaiting_approval
approved
task_ready
task_created
monitoring
at_risk_of_failure
failed
recovery_pending
recovery_completed
resolved
```

## Role Of Gemini

Gemini should help with:

- Extracting promises from messy messages.
- Summarizing evidence.
- Explaining why a decision was made.
- Drafting guest replies.
- Drafting recovery plans.

Gemini should not bypass:

- Freshness gates.
- SOP rules.
- Approval rules.
- Missing information checks.
- Task due-time validation.

## Role Of Rules

Rules and tool evidence should control the final executable decision. The LLM can propose a decision, but the policy layer must validate it before the UI shows it as actionable.

## Current MVP Gap

The current MVP still uses a deterministic demo workflow and hard-coded promise IDs. The next engineering step is to replace `P-001` to `P-006` switch logic with:

```text
PromiseCandidate
-> DecisionPlanner
-> ToolExecutor
-> EvidenceEvaluator
-> ActionDecider
-> PromiseState
```


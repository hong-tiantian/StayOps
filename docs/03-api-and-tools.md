# API Contract

This document defines the outputs StayOps should produce. It is meant to keep the frontend, data layer, and agent workflow aligned.

## Audit Response

`POST /api/audit/:booking_id` returns the layered agent-team output:

```json
{
  "booking_id": "BKG-2026-0718-ACME",
  "reasoning_source": "adk",
  "info_analysis": {},
  "agent_trace": [],
  "decisions": [],
  "task_plan": [],
  "tool_calls": [],
  "freshness_summary": []
}
```

`reasoning_source` can be `adk`, `gemini`, or `rules`.

## Agent Trace

Produced with every audit so the UI can show the agent-team flow without inferring it
from low-level tool calls.

```json
{
  "stage_id": "task_planning",
  "label": "Task Planning Agent",
  "status": "complete",
  "summary": "2 task handoff(s), 1 manager review request(s), 2 follow-up(s)."
}
```

## Info Analysis

Produced after reading booking messages and reservation context.

```json
{
  "booking_id": "BKG-2026-0718-ACME",
  "source_channel": "sales_email",
  "intake_scope": "corporate_group_event",
  "basic_info_status": "complete",
  "basic_info": {
    "company_name": "Acme Robotics",
    "arrival_date": "2026-07-18",
    "arrival_time": "11:00",
    "departure_date": "2026-07-20",
    "room_count": 12,
    "room_mix": { "king": 8, "twin": 4 },
    "meeting_room_id": "MR-BLUE",
    "primary_contact": "Maya Chen"
  },
  "missing_basic_fields": [],
  "extra_items": [
    {
      "item_id": "P-004",
      "text": "Projector in meeting room",
      "source_message_id": "MSG-001",
      "source_quote": "a projector in the meeting room",
      "domain": "event_av",
      "subtype": "projector",
      "clarity": "clear",
      "required_fields": ["meeting_room", "meeting_start"],
      "missing_fields": [],
      "verification_route": "self_verifiable",
      "rule_key": "projector_setup"
    }
  ]
}
```

## Freshness Result

Produced before any promise decision that depends on operational data.

```json
{
  "source_name": "event_spaces",
  "last_synced_at": "2026-07-18T09:20:00Z",
  "max_allowed_age_minutes": 60,
  "age_minutes": 40,
  "freshness_status": "fresh"
}
```

## Promise Decision

Produced after verification and deterministic safety-gate adjudication. `promise_type`
remains in the response for current UI compatibility, but product docs should treat
`info_analysis.extra_items[].domain/subtype/rule_key` as the real taxonomy.

```json
{
  "promise_id": "P-004",
  "booking_id": "BKG-2026-0718-ACME",
  "promise_text": "Projector in meeting room",
  "promise_type": ["confirmed_commitment", "operational_requirement"],
  "status": "verifiable",
  "owner_department": "events",
  "source_message_id": "MSG-001",
  "source_quote": "a projector in the meeting room",
  "evidence": [
    "MR-BLUE has projector, screen, and HDMI adapter.",
    "SOP-EVT-004 requires setup 120 minutes before meeting start."
  ],
  "risk_reason": "Task due time must be calculated from setup lead time.",
  "recommended_action": "Create events setup task due 2026-07-18T12:00:00.",
  "approval_required": false,
  "execution_state": "task_created",
  "linked_task_id": "TASK-102"
}
```

## Task Plan

Produced after decisions. This is output-only in the current implementation; it does not
mutate seeded demo tasks.

```json
{
  "item_id": "P-004",
  "action_type": "create_task",
  "department": "events",
  "description": "Create events setup task due 12:00",
  "due_at": "2026-07-18T12:00:00",
  "reason": "Verified against available evidence and deterministic safety rules; ready for department handoff."
}
```

## Ops Task

Created or read from the task board.

```json
{
  "task_id": "TASK-102",
  "booking_id": "BKG-2026-0718-ACME",
  "source_promise_id": "P-004",
  "department": "events",
  "description": "Set up projector, screen, and HDMI adapter in MR-BLUE.",
  "due_at": "2026-07-18T14:00:00",
  "status": "open",
  "owner": "events@hotel.test",
  "completed_at": "",
  "warning": {
    "level": "error",
    "message": "Due time violates SOP-EVT-004; should be 2026-07-18T12:00:00."
  }
}
```

## Approval State

Historical approvals and current UI manager approvals are separate.

- `historical_trace_approved`: seeded approvals from `approval_records.csv`; used as evidence in complaint trace.
- `runtime_approved`: approvals clicked during the current demo/runtime.
- `approved`: backward-compatible display union for the current UI.

`GET /api/promises/seed/approve` returns:

```json
{
  "approved": ["P-002", "P-004"],
  "historical_trace_approved": ["P-002", "P-004"],
  "runtime_approved": []
}
```

`POST /api/promises/:promise_id/approve` writes to `runtime_approvals` and returns
`approval_scope: "runtime_manager_decision"`.

## Tool Call

Shown in the audit trail.

```json
{
  "tool_name": "check_event_space",
  "input": {
    "requirement": "projector",
    "date_time": "2026-07-18T14:00:00",
    "space_id": "MR-BLUE"
  },
  "output": {
    "space_id": "MR-BLUE",
    "available": true,
    "setup_lead_time_minutes": 120,
    "recommended_task_due_at": "2026-07-18T12:00:00"
  },
  "called_at": "2026-07-18T10:00:00Z"
}
```

## Complaint Trace

Produced when a complaint is submitted.

```json
{
  "complaint_id": "CMP-001",
  "booking_id": "BKG-2026-0718-ACME",
  "complaint_text": "The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.",
  "matched_promises": [
    {
      "promise_id": "P-002",
      "promise_text": "Quiet king room for VP away from elevators",
      "failure_type": "task_not_completed",
      "failure_point": "front_desk_room_blocking_task_not_completed",
      "root_cause": "Manager approved quiet king priority, but front desk did not lock a suitable room.",
      "linked_task_id": "TASK-103"
    },
    {
      "promise_id": "P-004",
      "promise_text": "Projector in meeting room",
      "failure_type": "incorrect_due_time",
      "failure_point": "events_task_due_time_set_to_meeting_start",
      "root_cause": "Events task due_at was 14:00, but SOP required 12:00.",
      "linked_task_id": "TASK-102"
    }
  ]
}
```

## Recovery Plan

```json
{
  "recovery_plan": [
    {
      "department": "front_desk",
      "action": "Offer VP immediate move to room 504 after inspection, or provide service recovery credit.",
      "urgency": "immediate"
    },
    {
      "department": "events",
      "action": "Send technician to MR-BLUE immediately with projector and HDMI adapter.",
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

## Additional Endpoints

These exist alongside the audit contract above. Full field contracts live in
`gmail-metrics-execution-plan.md` §5 (frontend handoff).

| Endpoint | Purpose |
| --- | --- |
| `POST /api/tools/:tool` | Internal tool callback used by the ADK service (thin wrapper over `ToolRunner`; single source of tool logic + data). |
| `GET /api/intake/gmail/search?q=` | Gmail intake search. Degrades to `{ ok: false, status: "not_configured" }` without OAuth. |
| `POST /api/intake/gmail/import` | Import a Gmail thread as normalized `IntakeMessage[]`. Same degraded behavior. |
| `POST /api/audit/from-intake` | Run an audit from intake messages. Target behavior (current sprint): feed actual message content through `runPromiseAuditFromMessages`; never mutate the Acme main flow. |
| `GET/POST /api/eval/:booking_id` | Demo metrics scored against `evals/goldens.json` (`/api/eval/acme` kept as the Acme alias). |
| `GET /api/insights` | Phoenix MCP self-review: latest audit trace summary + learning feedback. Observational only. |
| `GET /api/report` *(planned)* | Summary/Improvement agent aggregation: status distribution, blocked overpromises, overdue rates, recurrence, plus a Gemini-written `analysis_text`. Economic fields carry `measured/estimated/assumption` labels. |


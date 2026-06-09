# API Contract

This document defines the outputs StayOps should produce. It is meant to keep the frontend, data layer, and agent workflow aligned.

## Promise Candidate

Produced after reading booking messages.

```json
{
  "promise_id": "P-004",
  "booking_id": "BKG-2026-0718-ACME",
  "source_message_id": "MSG-001",
  "source_quote": "We also need ... a projector in the meeting room",
  "promise_text": "Projector in meeting room",
  "promise_type": ["confirmed_commitment", "operational_requirement"],
  "owner_department": "events",
  "required_sources": ["event_spaces", "hotel_sop", "ops_tasks"]
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

Produced after checking freshness, SOP, inventory, tasks, and approvals.

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


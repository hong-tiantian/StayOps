# Real Hotel Workflow

This document describes the human workflow StayOps is modeling. The purpose is to make the demo case grounded in real hotel operations rather than a generic AI dashboard.

## Baseline Scenario

A boutique hotel receives a corporate offsite booking from Acme Robotics. The group books 12 rooms, a meeting room, early arrivals, a VP room preference, gluten-free breakfast, airport transfer, and a company invoice.

Without StayOps, the work usually happens through fragmented handoffs:

1. Sales receives the corporate booking email.
2. Sales records the booking and replies to the guest.
3. Sales forwards or summarizes some operational requests to front desk, events, F&B, and billing.
4. Each department creates or remembers its own task.
5. A manager may approve high-risk promises, but approval does not guarantee the task is completed.
6. If a complaint happens, the team manually searches email, notes, task boards, and room assignment records.

## Where The Workflow Breaks

The current demo focuses on two realistic failure modes.

### Failure 1: Quiet VP Room

The guest asks for a quiet king room away from elevators. Sales notes the request and the manager approves prioritizing it, but the front desk room-blocking task remains open. On arrival day, room 402 is ready, so the VP is assigned there. It is technically in the quiet zone, but it is also near the elevator, so the original promise fails.

Human root cause:

- Approval was treated as execution.
- The front desk task was not escalated when it stayed open.
- The room assignment decision did not compare the assigned room against the promise constraints.

### Failure 2: Projector Setup

The meeting starts at 14:00. SOP requires projector setup 120 minutes before meeting start, so the task should be due at 12:00. The events task is created with a due time of 14:00, so the projector is not ready when the meeting starts.

Human root cause:

- The operator used meeting start time as the task due time.
- The task system did not compute due time from SOP lead time.
- No warning existed for task due time mismatches.

## Workflow With StayOps

StayOps adds a verification layer before task creation and a trace layer after complaints.

1. Intake the booking and related messages.
2. Extract guest-facing promises.
3. Check data freshness before making decisions.
4. Verify each promise against room inventory, readiness, SOP, event spaces, billing, transport, approvals, and existing tasks.
5. Classify each promise as verifiable, at risk, missing info, cannot confirm, or conflict.
6. Route risky items to manager approval.
7. Create or update department tasks only after verification or approval.
8. Monitor linked tasks for due-time and completion risks.
9. If a complaint arrives, trace it to the original promise, approval, and task failure.
10. Generate recovery actions and internal rule fixes.

## Product Boundary

StayOps is not a full PMS, guest inbox, task manager, or chatbot. It sits between guest-facing commitments and operational execution.


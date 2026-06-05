# Demo Case

This document gives the human story behind the Acme Robotics demo. The goal is to make the case feel operationally real instead of AI-generated.

## Hotel Context

The hotel is a boutique business hotel that frequently hosts small corporate offsites. It has a lean operations team, shared task ownership, and several systems that do not always update at the same time.

Operational systems in the demo:

- Reservations.
- Guest and sales messages.
- Room inventory.
- Room readiness.
- Housekeeping roster.
- Hotel SOP.
- Event space inventory.
- Billing accounts.
- Transport vendors.
- Approval records.
- Ops task board.

## Booking

Acme Robotics books:

- Booking ID: `BKG-2026-0718-ACME`
- 12 rooms.
- Arrival: `2026-07-18 11:00`
- Departure: `2026-07-20`
- Meeting room: `MR-BLUE`
- Meeting time: `14:00-17:00`

The booking email includes six guest-facing promises or requests:

1. Early check-in around 11:00.
2. Quiet king room away from elevators for the VP.
3. Gluten-free breakfast for two attendees.
4. Projector in the meeting room.
5. Airport transfer from MAD.
6. Company invoice.

## Why The Case Is Realistic

The case is not about slow replies. It is about operational ambiguity.

Sales can easily write friendly language like "we will note that" or "we will take care of it." But the hotel still needs to know whether each item is:

- Confirmed.
- Only requested.
- Operationally possible.
- Missing information.
- Manager-approved.
- Actually assigned to a task.

## Intended First Audit Result

| Promise | Expected Status | Reason |
| --- | --- | --- |
| Early check-in | `cannot_confirm` | Not enough rooms are inspected and ready for a 12-room group at 11:00. |
| Quiet king room for VP | `at_risk` | Quiet-zone king inventory is limited and room blocking is required. |
| Gluten-free breakfast | `verifiable` | F&B can execute if notified by the deadline. |
| Projector | `verifiable` | MR-BLUE has the equipment, but the task due time must be 12:00. |
| Airport transfer | `missing_info` | Flight number, arrival time, passenger count, and phone are missing. |
| Company invoice | `missing_info` | Billing contact, tax ID, and billing address are missing. |

## Complaint Act

The complaint text:

> The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.

StayOps should trace this to:

- `P-002`: quiet king room promise.
- `TASK-103`: front desk room-blocking task not completed.
- `P-004`: projector promise.
- `TASK-102`: due time set to 14:00 instead of SOP-required 12:00.

## Demo Narrative

The three-minute demo should tell this story:

1. A hotel does not fail only because it replies slowly.
2. It fails because guest-facing promises are not verified or tracked through execution.
3. StayOps checks fresh operational data before committing.
4. StayOps creates tasks only for verified or approved promises.
5. When a failure happens, StayOps traces the broken promise chain and suggests recovery.


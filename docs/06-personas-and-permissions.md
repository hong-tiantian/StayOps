# Personas And Permissions

StayOps is a single-persona hackathon demo. The primary user is the hotel duty manager /
operations lead. Front desk, F&B, events, concierge, sales, housekeeping, and maintenance
are downstream handoff recipients, not separate authenticated users in this scope.

Do not build real RBAC/auth for the hackathon submission. Department labels can help the
duty manager understand ownership, but the product action remains approval and oversight.

## Primary Persona: Duty Manager / Operations Lead

The duty manager owns promise risk, approval, handoff oversight, and recovery.

Can see:

- Full Promise Ledger.
- Data freshness across all sources.
- Risky and failed promises.
- Approval records.
- Complaint recovery plan.
- SOP and task rule recommendations.

Can do:

- Approve or reject risky promises.
- Trigger complaint trace.
- Approve recovery actions.
- Review postmortem suggestions.

## Downstream: Front Desk

The front desk manager owns arrival, room assignment, room blocking, and room-related promises.

Can see:

- Room-related promises.
- Room readiness and room inventory evidence.
- VIP room-blocking tasks.
- Hotel map and assigned-room mismatch.

Can receive handoffs to:

- Lock a room.
- Update room assignment.
- Mark room-blocking tasks complete.
- Escalate impossible room promises.

These are operational ownership notes, not permission boundaries.

## Downstream: Events Team

The events team owns meeting rooms, AV equipment, and setup timing.

Can see:

- Event-space promises.
- Equipment availability.
- Setup lead time from SOP.
- Events tasks and warnings.

Can receive handoffs to:

- Update setup task status.
- Confirm projector, screen, HDMI, and room layout readiness.

These are operational ownership notes, not permission boundaries.

## Sales And Reservations

Sales owns booking intake and missing guest/company information.

Can see:

- Original guest/company messages.
- Missing information promises.
- Billing and transfer follow-up tasks.

Can receive handoffs to:

- Ask the guest for missing fields.
- Update billing contact, tax ID, flight number, arrival time, passenger count, and phone number.

These are operational ownership notes, not permission boundaries.

## Developer / Judge View

The demo also includes a technical view for judges and developers.

Can see:

- Tool-call logs.
- Input/output JSON.
- Data freshness evidence.
- MCP/Gemini integration traces when implemented.

This view should not be the default hotel worker experience.

## MVP Decision

For the hackathon MVP, the UI remains a duty-manager dashboard. It may show department
labels and technical evidence for judges, but it should not claim real permissions,
role enforcement, or a multi-user workflow.


# Personas And Permissions

StayOps should not show the same information to every hotel worker. The MVP currently behaves like a single manager dashboard, but the target product has role-specific views and permissions.

## Primary Persona: General Manager

The general manager owns risk and recovery.

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

## Front Desk Manager

The front desk manager owns arrival, room assignment, room blocking, and room-related promises.

Can see:

- Room-related promises.
- Room readiness and room inventory evidence.
- VIP room-blocking tasks.
- Hotel map and assigned-room mismatch.

Can do:

- Lock a room.
- Update room assignment.
- Mark room-blocking tasks complete.
- Escalate impossible room promises.

Cannot do:

- Approve compensation.
- Modify event, billing, or transport policies.

## Events Team

The events team owns meeting rooms, AV equipment, and setup timing.

Can see:

- Event-space promises.
- Equipment availability.
- Setup lead time from SOP.
- Events tasks and warnings.

Can do:

- Update setup task status.
- Confirm projector, screen, HDMI, and room layout readiness.

Cannot do:

- Change guest-facing promise status.
- Approve manager-only commitments.

## Sales And Reservations

Sales owns booking intake and missing guest/company information.

Can see:

- Original guest/company messages.
- Missing information promises.
- Billing and transfer follow-up tasks.

Can do:

- Ask the guest for missing fields.
- Update billing contact, tax ID, flight number, arrival time, passenger count, and phone number.

Cannot do:

- Mark operational promises complete.
- Override SOP warnings.

## Developer / Judge View

The demo also includes a technical view for judges and developers.

Can see:

- Tool-call logs.
- Input/output JSON.
- Data freshness evidence.
- MCP/Gemini integration traces when implemented.

This view should not be the default hotel worker experience.

## MVP Decision

For the hackathon MVP, the UI can remain a manager dashboard, but the README and docs should state that role-based panels are planned and that the current interface intentionally shows all evidence for judging.


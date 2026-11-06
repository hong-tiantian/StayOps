# Eval Cases

`goldens.json` is the single source of expected answers for `npm run eval`.
The case definition states what "correct" means, and the agent has to pass that
contract. Do not duplicate golden expectations in code.

## Adding A Case

Each case should include:

1. Case identity: `case_id`, title, hotel context, and public-safety flag.
2. Source messages with ids, channel, sender role, timestamp, subject, and body.
3. Booking facts such as booking id, arrival/departure dates, room count, event
   space, event time, and known or missing contact details.
4. Operational evidence such as SOP rules, inventory, readiness, transport,
   billing, approval, or task facts.
5. Golden promises with expected status, required tools, required evidence, and
   approval expectations.
6. Expected task, approval, complaint, and recovery outcomes when applicable.
7. An edge-case note explaining what behavior the case tests.

New cases must not modify the Acme main flow: `BKG-2026-0718-ACME` keeps exactly
six promises, `TASK-102` remains due at 14:00, and `TASK-103` remains open.

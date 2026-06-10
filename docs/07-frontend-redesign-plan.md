# StayOps Frontend Redesign Plan

## Goal

Redesign StayOps from a tabbed hackathon dashboard into a high-end hotel operations workspace that works for two audiences:

- **Manager View**: a realistic duty-manager cockpit for hotel operators.
- **Judge Trace View**: a transparent agent-evaluation view for hackathon judges and developers.

The product should not feel like a marketing landing page, generic chatbot, or ordinary task manager. It should feel like an agentic operations console where the UI understands what the user is focused on and brings the next useful action to them.

Core design thesis:

> From "the manager goes looking for UI" to "the relevant UI comes to the manager."

## Inspiration

### Attention UI

Reference idea: Attune / "Attention UI" style interaction.

Useful principle:

- The system observes the user's focus: selected promise, hovered source quote, active complaint, or task.
- It infers the likely next operational intent.
- It surfaces contextual actions and evidence near the work area.
- It hides unrelated noise when the user is focused.

StayOps translation:

- Hover or select a source message -> show extracted promise candidates.
- Select a promise -> show required checks, current evidence, policy decision, and next action.
- Select a complaint -> show broken promise trace and recovery actions.
- Select a stale data source -> show every promise affected by that source.

### Visual References

- **Apple / visionOS**: light spatial surfaces, refined spacing, glass-like inspectors, restrained motion.
- **Linear**: dense issue-style workflow, left list + center work area + right detail pane.
- **Stripe Dashboard**: trustworthy metrics, clear state, developer-grade information design.
- **Aman / EDITION hotels**: quiet luxury, warm neutral palette, hotel context without decorative excess.
- **Claude-style workspace**: context on one side, generated/agent work in the center, inspection on the other side.

## Product Modes

Use one app and one data model, not two separate demos.

```text
Mode switch:
[ Manager View ] [ Judge Trace ]
```

Both modes read the same rendered audit state:

```text
Booking
-> Source message
-> Extracted promise
-> Agent proposal
-> Tool evidence
-> Policy decision
-> Task plan
-> Approval state
-> Recovery trace
```

The difference is what each mode emphasizes.

## Manager View

Audience:

- Duty manager
- Front office lead
- Operations lead
- Hotel GM evaluating the product

Primary question:

> What can I safely promise, what needs approval, and what must happen next?

### Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ StayOps   Booking selector   Sync status   Run Audit   Trace │
├───────────────┬──────────────────────────────┬───────────────┤
│ Booking       │ Promise Command Board         │ Action Panel   │
│ Context       │                              │               │
│               │ Risk summary                  │ Selected item  │
│ Email thread  │ Promise ledger                │ Next action    │
│ Sales notes   │ Task plan                     │ Approval       │
│ Complaint     │ Recovery status               │ Follow-up copy │
└───────────────┴──────────────────────────────┴───────────────┘
```

### Rendered State

Do not only show computed totals. Render each stage as a visible object:

- Source quote from message.
- Extracted promise row.
- Final operational status.
- Owner department.
- Approval requirement.
- Linked task.
- Recommended due time.
- Missing fields.
- Recovery link if complaint exists.

### Manager Interactions

When a manager focuses on a promise, show a contextual action dock:

```text
Quiet king room
-> Check room readiness
-> Lock candidate room
-> Request manager approval
-> Draft cautious guest reply
```

When focused on airport transfer:

```text
Airport transfer
-> Ask for flight number
-> Ask arrival time
-> Ask passenger count
-> Ask phone number
```

When focused on projector setup:

```text
Projector
-> Check event space
-> Create setup task
-> Correct due time to 12:00
-> Show failure trace
```

## Judge Trace View

Audience:

- Hackathon judges
- Developers
- AI evaluators

Primary question:

> Is this a real agentic workflow with tools, guardrails, MCP observability, and measurable safety?

### Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ StayOps Trace   ADK connected   Phoenix MCP   Eval 6/6       │
├───────────────┬──────────────────────────────┬───────────────┤
│ Input Graph   │ Agent Timeline                │ Evidence Pane  │
│               │                              │               │
│ Messages      │ 1. Extract promises           │ Tool output    │
│ Reservation   │ 2. Plan checks                │ Policy result  │
│ Hotel SOP     │ 3. Call tools                 │ Override diff  │
│ Data sources  │ 4. Policy adjudication        │ Phoenix spans  │
│               │ 5. Task/recovery plan         │ Eval metrics   │
└───────────────┴──────────────────────────────┴───────────────┘
```

### Rendered State

Show the actual agent pipeline:

```text
Agent proposed: verifiable
Policy decided: cannot_confirm
Reason: room_readiness is stale
Tool calls:
  check_data_freshness(room_readiness)
  check_room_readiness(king, quiet_zone)
  retrieve_sop(quiet_room)
Phoenix:
  27 spans
  3 Gemini calls
  16 tool calls
Eval:
  status accuracy 6/6
  overpromise 0/6
```

### Judge Interactions

Each promise should answer:

- What did Gemini / ADK propose?
- Which tools were called?
- What evidence came back?
- Did the policy layer agree or overrule?
- Which MCP trace proves this happened?
- Which eval criteria does this satisfy?

## Core Layout

Use a three-panel workspace as the first screen.

```text
Left: Context
  Booking email
  Sales note
  Complaint
  Reservation facts

Center: Work
  Promise ledger
  Task plan
  Recovery chain

Right: Inspector
  Manager View: next actions / approvals / follow-up copy
  Judge Trace: agent proposal / tool calls / policy / Phoenix / eval
```

Avoid a large hero section. The product experience should start immediately.

## Attention Action Dock

Add a contextual action dock that appears when a user focuses a rendered object.

Focus targets:

- Message sentence
- Promise row
- Task row
- Freshness source
- Complaint sentence
- Phoenix trace span

Dock behavior:

- Small, floating, close to the selected item or fixed to the inspector header.
- Shows 2-5 actions max.
- Actions are based on the selected object type and audit state.
- The dock should feel proactive, not noisy.

Example:

```text
Selected: "Company invoice"
Actions:
  Ask billing contact
  Ask tax ID
  Ask billing address
  Draft company reply
```

## Focus Mode

When a promise is selected, reduce unrelated visual noise.

Highlighted chain:

```text
source quote
-> promise
-> required tools
-> policy result
-> next action
```

Other rows remain visible but lower contrast.

This supports both customer usability and judge storytelling.

## Visual System

### Direction

Quiet luxury operations console.

Combine:

- Apple-like spacing and polish.
- Linear-like density.
- Stripe-like trust and clarity.
- Aman-like hotel warmth.

### Palette

Use restrained neutrals:

- Canvas: warm off-white / light gray.
- Surface: white with subtle translucency.
- Text: charcoal / slate.
- Accent: muted emerald for safe.
- Risk: amber.
- Failure: rose.
- Trace / ADK: indigo or violet, used sparingly.
- Hotel warmth: ivory / champagne tint, not heavy gold.

Avoid:

- Purple-blue gradient dominance.
- Overly dark sci-fi dashboard.
- Marketing hero cards.
- Decorative bokeh/orbs.
- Nested cards.

### Components

Use consistent primitives:

- Compact promise rows.
- Right inspector sections.
- Source quote chips.
- Tool-call pills.
- Policy decision diff.
- Status badges.
- Context action dock.
- Mode switch segmented control.
- Trace timeline.

Card radius should stay at 8px or less for dense operational panels unless a modal/detail drawer needs slightly more softness.

## Information Architecture

Top-level navigation should be reduced.

Current many-tab structure should become secondary. First screen should contain the whole core workflow.

Recommended top bar:

```text
StayOps
Booking selector
Manager / Judge Trace mode
Language switch
Run Audit
Trace Complaint
```

Secondary tools can stay available:

- Tasks
- Timeline
- Map
- Recovery

But they should not be the core demo path.

## Implementation Plan

### Phase 1: Create Workspace Shell

Deliverable:

- Replace the first screen with a three-panel workspace.
- Add mode switch: Manager View / Judge Trace.
- Keep existing API/state logic.
- Do not remove existing detailed components yet.

Files likely affected:

- `src/app/page.tsx`
- `src/components/AppShell.tsx`
- new `src/components/WorkspaceShell.tsx`
- new `src/components/ModeSwitch.tsx`

### Phase 2: Render Object Chain

Deliverable:

- Left panel renders booking context messages.
- Center panel renders promises.
- Right panel renders selected object's inspector.
- Selecting a message/promise/task updates the inspector.

Rendered object types:

```ts
type FocusTarget =
  | { type: "message"; id: string }
  | { type: "promise"; id: string }
  | { type: "task"; id: string }
  | { type: "freshness"; source: string }
  | { type: "complaint"; id: string };
```

### Phase 3: Add Manager Inspector

Deliverable:

- Next best action panel.
- Approval requirement.
- Missing fields.
- Suggested follow-up copy.
- Linked task state.
- Recovery trigger.

This is the customer-facing version.

### Phase 4: Add Judge Trace Inspector

Deliverable:

- Agent proposed status.
- Policy final status.
- Override diff.
- Tool calls for selected promise.
- Phoenix trace summary.
- Eval metric strip.

This is the hackathon-scoring version.

### Phase 5: Add Attention Action Dock

Deliverable:

- Contextual action dock appears for selected promise/message.
- Actions are rendered from current audit state.
- Do not execute destructive actions automatically.
- Manager remains in control.

Example action categories:

- Verify
- Approve
- Ask missing info
- Draft reply
- Create task
- Trace failure

### Phase 6: Polish and Verification

Deliverable:

- Responsive desktop and laptop layout.
- Mobile fallback to stacked panels.
- No overlapping text.
- No blank trace panels.
- Playwright screenshots for Manager and Judge Trace modes.
- Verify against deployed data path where possible.

## Demo Script

### 3-Minute Hackathon Version

1. Open StayOps Cloud Run URL.
2. Manager View loads directly into Acme booking.
3. Run audit.
4. Select quiet-room promise.
5. Show source quote -> agent proposal -> policy decision -> approval action.
6. Switch to Judge Trace.
7. Show ADK/Gemini tool calls and policy guardrail.
8. Toggle stale data.
9. Show policy downgrade / overpromise prevention.
10. Run complaint trace.
11. Show broken promise -> task -> failure point -> recovery plan.
12. End with eval strip: 6/6 status, 0/6 overpromise.

### Customer Version

1. Manager opens current booking.
2. System highlights risky promises.
3. Manager approves or asks for missing info.
4. Tasks route to departments.
5. Complaint recovery shows accountability.

## Success Criteria

The redesign succeeds if a judge can understand all of this from the UI:

- This is not a chatbot.
- This is not a plain task manager.
- Gemini / ADK proposes.
- Tools gather evidence.
- Policy guardrails decide.
- Human manager controls execution.
- MCP / Phoenix observes the agent.
- Failures are traceable.

The redesign succeeds for customers if they can answer:

- What promises did we make?
- Which are safe?
- Which need approval?
- What should I do next?
- Who owns each task?
- What failed when a complaint arrives?


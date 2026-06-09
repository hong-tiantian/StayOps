# MCP Integration Plan

StayOps will use **Arize Phoenix** as the partner MCP track for the hackathon submission.
The product needs more than a working agent: it needs an audit trail proving that Gemini
did not overpromise, that read-only tools supplied the evidence, and that deterministic
policy guardrails made the final executable decision.

Fivetran remains a plausible future data-sync direction, but it is no longer the current
submission partner. Data freshness still matters to the product; for this submission,
freshness is enforced by the local deterministic tool layer while Arize provides agent
observability and self-review.

## Why Arize Fits

StayOps is a promise verification system, not a free-form chatbot. A duty manager must be
able to answer:

- What did Gemini extract from the guest email?
- Which tools did the agent call before proposing a status?
- Did the deterministic policy override Gemini's proposed status?
- Did the agent ever try to mark an unsupported promise as `verifiable`?
- What manager feedback has the agent received over time?

Arize/Phoenix fits this because it can store traces, tool-call spans, LLM calls, and eval
results for the agent run. Phoenix MCP then lets the app inspect its own observability
project and surface self-review information inside the dashboard.

## Current MVP Status

Implemented in code:

- OpenTelemetry/OpenInference tracing setup in `src/lib/tracing.ts`.
- Next.js startup registration in `src/instrumentation.ts`.
- Gemini agent spans and tool-call spans in `src/lib/agent/promiseAgent.ts`.
- Phoenix MCP client in `src/lib/mcp/phoenixClient.ts`.
- Runtime self-review endpoint in `src/app/api/insights/route.ts`.
- Dashboard self-review component in `src/components/SelfReview.tsx`.

Not yet complete:

- Phoenix trace IDs are not yet attached to each promise detail.
- MCP self-review currently confirms the Phoenix project and local feedback summary; it
  does not yet fetch per-promise trace/eval evidence.
- Arize observability does not replace deterministic policy and does not directly change
  promise classification.
- Local ADK / Agent Builder orchestration is implemented when `ADK_AGENT_URL` is
  configured; Cloud Run deployment and per-promise Phoenix trace linking are still pending.

## Target MCP Use

The Arize MCP integration should affect the product experience by making promise
decisions auditable. The strongest target flow is:

```text
Run promise audit
-> Gemini extracts promises and calls read-only tools
-> OpenInference spans are exported to Phoenix
-> deterministic policy decides final status
-> promise detail links to Phoenix trace/eval evidence
-> manager approves/rejects
-> feedback is recorded for self-review
```

## Product-Safe Boundary

Arize is an observability and review layer. It should not be allowed to upgrade a promise
status or bypass hotel SOP rules. The executable decision remains:

```text
tool evidence + deterministic policy + manager approval
```

Gemini may propose. Arize may trace and evaluate. The policy layer decides.

## Implementation Direction

Recommended next steps:

1. Store the Phoenix trace/run identifier on each audit result or promise decision.
2. Show a trace/eval summary inside `PromiseDetailDrawer`.
3. Add an overpromise eval result: "Did Gemini propose `verifiable` when policy said no?"
4. Rename remaining Fivetran-facing UI copy to generic "Data Freshness" unless a real
   Fivetran integration is later added.
5. Document the exact Phoenix MCP startup/runtime requirements after deployment is chosen.

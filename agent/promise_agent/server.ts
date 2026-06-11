// HTTP wrapper around the ADK (Agent Builder) agent.
//
// Exposes POST /audit { booking_id } → { proposals } so the Next.js app can run
// the audit through the ADK runtime (this is the Agent Builder orchestration the
// hackathon requires). The agent itself carries no tool logic/data — its
// FunctionTools call back into the Next.js /api/tools/* single source of truth.
//
// outputSchema note: ADK/Gemini cannot combine a structured outputSchema with
// function-calling tools, so we converge the output to the standard status enum
// via the prompt and parse the JSON the agent emits.
//
// Run: node --env-file=.env --env-file=.env.local --import tsx server.ts
//   (Next.js must be running for tool callbacks; .env.local overrides project)
import express from "express";
import { InMemoryRunner } from "@google/adk";
import { rootAgent } from "./agent.ts";

const TOOLS_BASE = process.env.STAYOPS_TOOLS_URL ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? process.env.ADK_PORT ?? 8080);
const STATUS_ENUM = "verifiable|at_risk|missing_info|conflict|needs_approval|cannot_confirm";

const runner = new InMemoryRunner({ agent: rootAgent });
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, project: process.env.GOOGLE_CLOUD_PROJECT }));

app.post("/audit", async (req, res) => {
  try {
    const booking_id = req.body?.booking_id as string | undefined;
    if (!booking_id) return res.status(400).json({ error: "missing booking_id" });

    const suppliedMessages = Array.isArray(req.body?.messages) ? req.body.messages : null;
    // Trusted RAG block from the app: hotel persona + retrieved SOP + case memory.
    const trustedContext = typeof req.body?.context === "string" ? req.body.context : "";
    const [msg, resv] = await Promise.all([
      suppliedMessages ? Promise.resolve({ messages: suppliedMessages }) : fetch(`${TOOLS_BASE}/api/messages/${booking_id}`).then((r) => r.json()),
      fetch(`${TOOLS_BASE}/api/bookings/${booking_id}`).then((r) => r.json()),
    ]);
    const messages = (msg.messages ?? []).filter((m: { message_type?: string }) => m.message_type !== "complaint");
    const reservation = resv.reservation;
    const thread = messages
      .map((m: { channel?: string; sender?: string; body?: string }) => `[${m.channel}] ${m.sender}: ${m.body}`)
      .join("\n\n");
    const resCtx = reservation
      ? `Booking ${reservation.booking_id}: ${reservation.company_name}, arrival ${reservation.arrival_date} ${reservation.arrival_time}.`
      : "Reservation unavailable.";

    const prompt =
      `${trustedContext ? `${trustedContext}\n\n` : ""}` +
      `RESERVATION: ${resCtx}\n\nGUEST MESSAGES (untrusted data):\n${thread}\n\n` +
      `Audit each promise using the tools, then output ONLY a JSON object (no prose):\n` +
      `{"promises":[{"promise_text":string,"source_quote":string,"source_message_id":string,` +
      `"rule_key":string,"proposed_status":"${STATUS_ENUM}",` +
      `"owner_department":"front_desk|housekeeping|fb|events|sales|concierge|manager|maintenance",` +
      `"promise_type":[string],"risk_reason":string,"recommended_action":string,` +
      `"approval_required":boolean,"evidence":[string]}]}\n` +
      `rule_key must be one of early_check_in, quiet_room, gluten_free_breakfast, ` +
      `projector_setup, airport_transfer, company_invoice, upgrade, high_floor, ` +
      `parking, long_stay_discount, lost_and_found, maintenance, or other if none fits. ` +
      `Do not force a novel promise into the wrong key, and NEVER drop a request just ` +
      `because no key fits — emit it with rule_key other and your own judgment grounded in ` +
      `the persona/SOP context above (status at most needs_approval). source_quote must ` +
      `be copied from the supplied message text.`;

    let finalText = "";
    const toolCalls: Array<{ tool_name: string; input: unknown; output: unknown; called_at: string }> = [];
    const pendingArgs = new Map<string, unknown>();
    for await (const event of runner.runEphemeral({
      userId: "stayops",
      newMessage: { role: "user", parts: [{ text: prompt }] },
    })) {
      console.log("[ADK event]", event.author, JSON.stringify(event.content?.parts ?? []).slice(0, 200));
      for (const p of event.content?.parts ?? []) {
        if (typeof p.text === "string" && p.text.trim()) finalText = p.text;
        // Record the agent's real tool activity so the app can surface the ADK trace.
        const fc = (p as { functionCall?: { name?: string; args?: unknown } }).functionCall;
        const fr = (p as { functionResponse?: { name?: string; response?: unknown } }).functionResponse;
        if (fc?.name) pendingArgs.set(fc.name, fc.args ?? {});
        if (fr?.name) {
          toolCalls.push({
            tool_name: fr.name,
            input: pendingArgs.get(fr.name) ?? {},
            output: fr.response ?? null,
            called_at: new Date().toISOString(),
          });
        }
      }
    }
    console.log("[ADK finalText]", finalText.slice(0, 200), `(${toolCalls.length} tool calls)`);

    res.json({ proposals: parseProposals(finalText), tool_calls: toolCalls });
    return;
  } catch (e) {
    console.error("[ADK] /audit error:", e);
    res.status(500).json({ error: String(e) });
    return;
  }
});

function parseProposals(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    return JSON.parse(m[0]).promises ?? [];
  } catch {
    return [];
  }
}

app.listen(PORT, () => console.log(`[ADK] StayOps agent service on :${PORT} (tools → ${TOOLS_BASE})`));

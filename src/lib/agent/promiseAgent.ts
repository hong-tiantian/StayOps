import type { Content } from "@google/genai";
import { Type, ThinkingLevel } from "@google/genai";
import { generateWithRetry, GEMINI_MODEL } from "../gemini";
import { traceAsync, traceSync } from "../tracing";
import { ToolRunner } from "../tools";
import { Message, Reservation } from "../types";
import { AGENT_TOOL_DECLARATIONS, dispatchTool } from "./agentTools";

/**
 * The StayOps Promise Agent — a real function-calling (ReAct) loop on Gemini.
 *
 * The model reads the corporate booking email, extracts guest-facing promises,
 * and AUTONOMOUSLY calls read-only operational tools to gather evidence. Tool
 * execution is deterministic (CSV-backed) and every call is recorded for the UI.
 * The loop is bounded by MAX_STEPS. After exploration, the model emits a
 * structured proposal which the deterministic policy layer then adjudicates.
 */

const MAX_STEPS = 4;

export interface AgentProposal {
  promise_text: string;
  source_quote: string;
  promise_type: string[];
  owner_department: string;
  proposed_status: string;
  risk_reason: string;
  recommended_action: string;
  approval_required: boolean;
  evidence: string[];
}

export interface AgentRunResult {
  proposals: AgentProposal[];
  runner: ToolRunner;
  steps: number;
}

const SYSTEM_INSTRUCTION = `You are StayOps, an operational agent for a boutique hotel.
You audit guest-facing promises in a corporate booking BEFORE arrival. You are NOT a chatbot
and you must NOT invent guarantees. Your job:

1. Extract every distinct guest-facing promise or request from the email(s).
2. For each promise, CALL the read-only tools to gather real evidence: check data freshness
   first, then room readiness, SOP rules, event space, or inventory as relevant.
3. Never claim a promise is executable without tool evidence. If required guest info is
   missing (e.g. flight number, billing details) say so. If data is stale, do not guarantee.

SPEED IS CRITICAL: In your FIRST turn, emit ALL the tool calls you need across ALL
promises AT ONCE (parallel function calls). Do not explore one promise per turn. After
the tool results come back, if you have enough evidence, stop and wait for the final
formatting instruction.`;

/** Structured output schema for the final proposal step. */
const PROPOSAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    promises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          promise_text: { type: Type.STRING },
          source_quote: { type: Type.STRING },
          promise_type: { type: Type.ARRAY, items: { type: Type.STRING } },
          owner_department: { type: Type.STRING },
          proposed_status: { type: Type.STRING },
          risk_reason: { type: Type.STRING },
          recommended_action: { type: Type.STRING },
          approval_required: { type: Type.BOOLEAN },
          evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["promise_text", "proposed_status", "owner_department"],
      },
    },
  },
  required: ["promises"],
};

function buildEmailContext(messages: Message[], reservation: Reservation | null): string {
  const relevant = messages.filter((m) => m.message_type !== "complaint");
  const thread = relevant
    .map((m) => `[${m.channel} @ ${m.received_at}] ${m.sender}:\n${m.body}`)
    .join("\n\n");
  const res = reservation
    ? `Booking ${reservation.booking_id}: ${reservation.company_name}, ${reservation.room_count} rooms ` +
      `(${reservation.king_count} king/${reservation.twin_count} twin), arrival ${reservation.arrival_date} ` +
      `${reservation.arrival_time}, meeting room ${reservation.meeting_room_id}.`
    : "Reservation unavailable.";
  return `RESERVATION CONTEXT:\n${res}\n\nMESSAGE THREAD:\n${thread}`;
}

/**
 * Run the agent. Throws on any Gemini/auth failure so the caller can fall back
 * to the deterministic audit. Returns model proposals plus the tool-call trace.
 */
export async function runPromiseAgent(
  messages: Message[],
  reservation: Reservation | null
): Promise<AgentRunResult> {
  const emailContext = buildEmailContext(messages, reservation);

  // Root agent span — the whole audit shows up as one trace tree in Phoenix.
  return traceAsync("promise_audit", "AGENT", { "input.value": emailContext.slice(0, 2000) }, async () => {
    const runner = new ToolRunner();
    const contents: Content[] = [
      { role: "user", parts: [{ text: `${emailContext}\n\nBegin the promise audit.` }] },
    ];

    let steps = 0;
    for (; steps < MAX_STEPS; steps++) {
      const res = await traceAsync(
        "gemini.tool_calling",
        "LLM",
        { "llm.model_name": GEMINI_MODEL, "input.value": `tool-calling turn ${steps}` },
        () =>
          generateWithRetry({
            model: GEMINI_MODEL,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              tools: [{ functionDeclarations: AGENT_TOOL_DECLARATIONS }],
              temperature: 0,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            },
          })
      );

      const calls = res.functionCalls;
      const modelContent = res.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);

      if (!calls || calls.length === 0) break; // model finished exploring

      const responseParts = calls.map((call) => {
        const name = call.name ?? "";
        const args = call.args ?? {};
        // Each tool call is its own OpenInference TOOL span under the agent.
        const result = traceSync(
          `tool.${name}`,
          "TOOL",
          { "tool.name": name, "input.value": JSON.stringify(args) },
          () => dispatchTool(name, args, runner)
        );
        return { functionResponse: { name, response: { result } } };
      });
      contents.push({ role: "user", parts: responseParts });
    }

    // Finalization: ask for the structured proposal (no tools this turn).
    contents.push({
      role: "user",
      parts: [
        {
          text:
            "Now output the final audit as JSON. Use promise_type values from " +
            "{confirmed_commitment, request_noted, preference, operational_requirement, " +
            "commercial_requirement, missing_info_request, risk_sensitive_request} and " +
            "owner_department from {front_desk, housekeeping, fb, events, sales, concierge, manager}.",
        },
      ],
    });

    const finalRes = await traceAsync(
      "gemini.finalize",
      "LLM",
      { "llm.model_name": GEMINI_MODEL, "input.value": "structured proposal" },
      () =>
        generateWithRetry({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: PROPOSAL_SCHEMA,
            temperature: 0,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        })
    );

    const parsed = JSON.parse((finalRes.text ?? "{}").trim()) as { promises?: AgentProposal[] };
    return { proposals: parsed.promises ?? [], runner, steps };
  });
}

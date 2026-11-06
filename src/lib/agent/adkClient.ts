import { AgentProposal } from "./promiseAgent";
import { Message, ToolCall } from "../types";

/**
 * Client for the ADK (Google Cloud Agent Builder) agent service.
 *
 * The ADK agent lives in `agent/promise_agent/` and runs as a separate service
 * (Cloud Run). It is the PRIMARY orchestration layer — built on the ADK runtime,
 * which is the official Agent Builder framework. When `ADK_AGENT_URL` is set, the
 * audit is orchestrated there; otherwise the app falls back to the in-app Gemini
 * loop, then to the deterministic policy engine.
 *
 * Contract (to align with the ADK service's stage-2 HTTP wiring):
 *   POST {ADK_AGENT_URL}/audit   body: { booking_id, messages? }
 *   → { proposals: AgentProposal[], tool_calls?: ToolCall[] }
 * The ADK agent only proposes; the deterministic policy layer still decides.
 */

export interface AdkRunResult {
  proposals: AgentProposal[];
  tool_calls: ToolCall[];
}

export function adkConfigured(): boolean {
  return !!process.env.ADK_AGENT_URL;
}

export async function runAdkAgent(
  booking_id: string,
  messages?: Message[],
  trusted_context?: string
): Promise<AdkRunResult> {
  const url = process.env.ADK_AGENT_URL;
  if (!url) throw new Error("ADK_AGENT_URL not set");
  // `context` carries the hotel persona + retrieved SOP/case block. ADK builds
  // that accept it gain RAG grounding; older builds ignore the extra field.
  const res = await fetch(`${url.replace(/\/$/, "")}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id, messages, context: trusted_context }),
  });
  if (!res.ok) throw new Error(`ADK agent error: HTTP ${res.status}`);
  const data = (await res.json()) as { proposals?: AgentProposal[]; tool_calls?: ToolCall[] };
  return { proposals: data.proposals ?? [], tool_calls: data.tool_calls ?? [] };
}

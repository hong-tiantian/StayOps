import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * StayOps Promise Agent — ADK (Agent Builder) edition.
 *
 * This is the orchestration layer running on the ADK runtime (replacing the
 * hand-rolled ReAct loop in src/lib/agent/promiseAgent.ts). It does NOT contain
 * any tool logic or CSV data: each FunctionTool simply calls back into the
 * Next.js app's /api/tools/* endpoint, which executes the SAME deterministic
 * ToolRunner. Tool logic + data therefore live in exactly one place.
 */

// Base URL of the Next.js app that hosts /api/tools/*.
// Local dev: http://localhost:3000 ; production: the Cloud Run app URL.
const TOOLS_BASE = process.env.STAYOPS_TOOLS_URL ?? 'http://localhost:3000';

/** POST args to the Next.js tool endpoint and return its `result` payload. */
async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    const res = await fetch(`${TOOLS_BASE}/api/tools/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args ?? {}),
    });
    if (!res.ok) {
      return { error: `tool ${name} failed: HTTP ${res.status}` };
    }
    const data = (await res.json()) as { result?: unknown };
    return data.result ?? data;
  } catch (err) {
    return { error: `tool ${name} unreachable: ${String(err)}` };
  }
}

/* ---- The 5 read-only evidence tools (mirror AGENT_TOOL_DECLARATIONS) ---- */

const checkDataFreshness = new FunctionTool({
  name: 'check_data_freshness',
  description:
    'Check whether a synced operational data source is fresh enough to trust. ' +
    'Call this BEFORE confirming any promise that depends on the source. Valid ' +
    'source_name: reservations, room_inventory, room_readiness, housekeeping_roster, ' +
    'hotel_sop, event_spaces, billing_accounts, transport_vendors, ops_tasks, approval_records.',
  parameters: z.object({
    source_name: z.string().describe('The data source to check.'),
  }),
  execute: ({ source_name }) => callTool('check_data_freshness', { source_name }),
});

const checkRoomReadiness = new FunctionTool({
  name: 'check_room_readiness',
  description:
    'Find rooms matching constraints and report whether they are inspected and ready ' +
    'by arrival. Use for early check-in, quiet-room, and room-preference promises.',
  parameters: z.object({
    room_type: z.string().describe('e.g. "king" or "twin".'),
    quiet_zone: z.boolean().optional().describe('Require a quiet-zone room.'),
    away_from_elevator: z.boolean().optional().describe('Require away from elevator.'),
    arrival_time: z
      .string()
      .optional()
      .describe('ISO local arrival, e.g. 2026-07-18T11:00:00.'),
  }),
  execute: (args) => callTool('check_room_readiness', args),
});

const checkInventory = new FunctionTool({
  name: 'check_inventory',
  description: 'Check availability of an operational item or equipment, e.g. projector.',
  parameters: z.object({
    item_type: z.string().describe('e.g. "projector".'),
  }),
  execute: ({ item_type }) => callTool('check_inventory', { item_type }),
});

const retrieveSop = new FunctionTool({
  name: 'retrieve_sop',
  description:
    'Retrieve the hotel SOP policy for a promise category. Valid promise_type: ' +
    'early_check_in, quiet_room, gluten_free_breakfast, projector_setup, ' +
    'airport_transfer, company_invoice.',
  parameters: z.object({
    promise_type: z.string().describe('The SOP category.'),
  }),
  execute: ({ promise_type }) => callTool('retrieve_sop', { promise_type }),
});

const checkEventSpace = new FunctionTool({
  name: 'check_event_space',
  description:
    'Check meeting-room equipment and the REQUIRED setup due time ' +
    '(meeting_start - setup_lead_time). Use for projector / AV / meeting promises.',
  parameters: z.object({
    space_id: z.string().describe('Event space id, e.g. MR-BLUE.'),
    requirement: z.string().optional().describe('e.g. "projector setup".'),
    date_time: z.string().optional().describe('Meeting start ISO, e.g. 2026-07-18T14:00:00.'),
  }),
  execute: (args) => callTool('check_event_space', args),
});

/* ---------------------------- The agent --------------------------------- */

const SYSTEM_INSTRUCTION = `You are StayOps, an operational agent for a boutique hotel.
You audit guest-facing promises in a corporate booking BEFORE arrival. You are NOT a chatbot
and you must NOT invent guarantees. Your job:

1. Extract every distinct guest-facing promise or request from the email(s).
2. For each promise, CALL the read-only tools to gather real evidence: check data freshness
   first, then room readiness, SOP rules, event space, or inventory as relevant.
3. Never claim a promise is executable without tool evidence. If required guest info is
   missing (e.g. flight number, billing details) say so. If data is stale, do not guarantee.

After gathering evidence, output a concise per-promise audit: the promise text, the status
you propose (verifiable, at_risk, missing_info, conflict, needs_approval, or cannot_confirm),
and the evidence you relied on.`;

export const rootAgent = new LlmAgent({
  name: 'stayops_promise_agent',
  model: 'gemini-3.5-flash',
  description:
    'Audits guest-facing promises in a corporate hotel booking before arrival, ' +
    'gathering deterministic operational evidence via read-only tools.',
  instruction: SYSTEM_INSTRUCTION,
  tools: [
    checkDataFreshness,
    checkRoomReadiness,
    checkInventory,
    retrieveSop,
    checkEventSpace,
  ],
});

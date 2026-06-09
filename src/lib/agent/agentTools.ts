import { Type, type FunctionDeclaration } from "@google/genai";
import { ToolRunner } from "../tools";

/**
 * Agent-facing tool layer.
 *
 * These are the *read-only* evidence tools the Gemini agent is allowed to call
 * during a promise audit. Execution stays deterministic (CSV-backed ToolRunner);
 * the model only decides WHICH tools to call and with what arguments. Write tools
 * (create_ops_task, log_promise_decision) are deliberately NOT exposed — task
 * creation happens only after a manager approves, never from the model directly.
 */

/** Gemini function declarations describing each callable tool. */
export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "check_data_freshness",
    description:
      "Check whether a synced operational data source is fresh enough to trust. " +
      "Call this BEFORE confirming any promise that depends on the source. " +
      "Valid source_name values: reservations, room_inventory, room_readiness, " +
      "housekeeping_roster, hotel_sop, event_spaces, billing_accounts, " +
      "transport_vendors, ops_tasks, approval_records.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        source_name: { type: Type.STRING, description: "The data source to check." },
      },
      required: ["source_name"],
    },
  },
  {
    name: "check_room_readiness",
    description:
      "Find rooms matching constraints and report whether they are inspected and " +
      "ready by arrival. Use for early check-in, quiet-room, and room-preference promises.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        room_type: { type: Type.STRING, description: 'e.g. "king" or "twin".' },
        quiet_zone: { type: Type.BOOLEAN, description: "Require a quiet-zone room." },
        away_from_elevator: { type: Type.BOOLEAN, description: "Require away from elevator." },
        high_floor: { type: Type.BOOLEAN, description: "Require a high floor (4th floor or above)." },
        arrival_time: { type: Type.STRING, description: "ISO local arrival, e.g. 2026-07-18T11:00:00." },
      },
      required: ["room_type"],
    },
  },
  {
    name: "check_inventory",
    description: "Check availability of an operational item or equipment, e.g. projector.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_type: { type: Type.STRING, description: 'e.g. "projector".' },
        space_id: { type: Type.STRING, description: "Optional event space id for AV inventory." },
      },
      required: ["item_type"],
    },
  },
  {
    name: "retrieve_sop",
    description:
      "Retrieve the hotel SOP policy for an internal promise rule_key. Valid promise_type values: " +
      "early_check_in, quiet_room, gluten_free_breakfast, projector_setup, " +
      "airport_transfer, company_invoice.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        promise_type: { type: Type.STRING, description: "The SOP category." },
      },
      required: ["promise_type"],
    },
  },
  {
    name: "check_event_space",
    description:
      "Check meeting-room equipment and the REQUIRED setup due time " +
      "(meeting_start - setup_lead_time). Use for projector / AV / meeting promises.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        requirement: { type: Type.STRING, description: 'e.g. "projector setup".' },
        date_time: { type: Type.STRING, description: "Meeting start ISO, e.g. 2026-07-18T14:00:00." },
        space_id: { type: Type.STRING, description: "Event space id, e.g. MR-BLUE." },
      },
      required: ["space_id"],
    },
  },
];

type ToolArgs = Record<string, unknown>;

/**
 * Execute one model-requested tool call against the deterministic ToolRunner.
 * Every call is recorded on `runner.calls` so the UI tool-call log stays truthful.
 * Unknown tools return an error object rather than throwing, so the agent loop
 * can recover instead of crashing.
 */
export function dispatchTool(name: string, args: ToolArgs, runner: ToolRunner): unknown {
  switch (name) {
    case "check_data_freshness":
      return runner.check_data_freshness(String(args.source_name));
    case "check_room_readiness":
      return runner.check_room_readiness(
        String(args.room_type ?? "king"),
        {
          quiet_zone: Boolean(args.quiet_zone),
          away_from_elevator: Boolean(args.away_from_elevator),
          high_floor: Boolean(args.high_floor),
        },
        String(args.arrival_time ?? "2026-07-18T11:00:00")
      );
    case "check_inventory":
      return runner.check_inventory(String(args.item_type), {
        space_id: args.space_id ? String(args.space_id) : undefined,
      });
    case "retrieve_sop":
      return runner.retrieve_sop(String(args.promise_type));
    case "check_event_space":
      return runner.check_event_space(
        String(args.requirement ?? "setup"),
        String(args.date_time ?? "2026-07-18T14:00:00"),
        String(args.space_id ?? "MR-BLUE")
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

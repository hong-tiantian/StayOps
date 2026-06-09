import { NextResponse } from "next/server";
import { ToolRunner } from "@/lib/tools";
import { dispatchTool } from "@/lib/agent/agentTools";

/**
 * Internal tool-execution endpoint for the ADK agent service.
 *
 * The ADK agent (separate Cloud Run service) does NOT carry tool logic or data.
 * Instead, each of its FunctionTools POSTs here, and we execute the SAME
 * deterministic `ToolRunner` + `dispatchTool` the in-app audit uses. This keeps
 * tool logic and CSV data as a single source of truth inside the Next.js app.
 *
 * Only the read-only evidence tools are reachable (dispatchTool returns an error
 * object for any unknown name). Write tools are never exposed here.
 */

export const dynamic = "force-dynamic";

/** Read-only evidence tools the agent is allowed to call. */
const ALLOWED_TOOLS = new Set([
  "check_data_freshness",
  "check_room_readiness",
  "check_inventory",
  "retrieve_sop",
  "check_event_space",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tool: string }> }
) {
  const { tool } = await params;

  if (!ALLOWED_TOOLS.has(tool)) {
    return NextResponse.json(
      { tool, error: `Tool not allowed: ${tool}` },
      { status: 400 }
    );
  }

  // Args arrive as a JSON object in the request body; default to {} if empty.
  const args = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Reuse the exact same deterministic execution path as the in-app audit.
  const runner = new ToolRunner();
  const result = dispatchTool(tool, args, runner);

  return NextResponse.json({ tool, result });
}

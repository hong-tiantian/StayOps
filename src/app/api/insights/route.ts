import { NextResponse } from "next/server";
import { phoenixCallJson } from "@/lib/mcp/phoenixClient";
import { feedbackSummary } from "@/lib/learning/feedbackStore";

export const dynamic = "force-dynamic";

interface PhoenixProject {
  name: string;
  description: string | null;
  id: string;
}

/**
 * Agent self-introspection via the Arize Phoenix MCP server.
 * Queries the agent's own observability projects over MCP and reports what it
 * finds about itself — the runtime "meaningful use" of the partner MCP.
 */
export async function GET() {
  const learning = feedbackSummary(); // local — always available
  try {
    const projects = await phoenixCallJson<PhoenixProject[]>("list-projects");
    const self = projects.find((p) => p.name === "stayops") ?? null;
    return NextResponse.json({
      ok: true,
      source: "@arizeai/phoenix-mcp",
      self_project: self,
      all_projects: projects.map((p) => p.name),
      learning,
    });
  } catch (err) {
    // Degrade gracefully — the dashboard treats this as "MCP unavailable".
    return NextResponse.json({ ok: false, source: "@arizeai/phoenix-mcp", error: String(err), learning });
  }
}

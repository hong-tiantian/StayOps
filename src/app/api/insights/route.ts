import { NextResponse } from "next/server";
import { phoenixCallJson } from "@/lib/mcp/phoenixClient";
import { feedbackSummary } from "@/lib/learning/feedbackStore";
import { latestAuditTrace, type AuditTraceSummary } from "@/lib/evaluation/phoenixTrace";

export const dynamic = "force-dynamic";

interface PhoenixProject {
  name: string;
  description: string | null;
  id: string;
}

/**
 * Agent self-introspection via the Arize Phoenix MCP server.
 * The agent queries its OWN observability data over MCP: which project it traces
 * into, and a reconstruction of its latest audit run (Gemini turns, tool calls,
 * injection-screen result) — runtime "meaningful use" of the partner MCP. The
 * data is observational only; it never changes promise decisions.
 */
export async function GET() {
  const learning = feedbackSummary(); // local — always available
  try {
    const projects = await phoenixCallJson<PhoenixProject[]>("list-projects");
    const self = projects.find((p) => p.name === "stayops") ?? null;

    let audit_trace: AuditTraceSummary | null = null;
    try {
      audit_trace = await latestAuditTrace(self?.name ?? "stayops");
    } catch (err) {
      console.warn("[StayOps] Phoenix MCP trace summary failed:", err);
    }

    return NextResponse.json({
      ok: true,
      source: "@arizeai/phoenix-mcp",
      self_project: self,
      all_projects: projects.map((p) => p.name),
      audit_trace,
      learning,
    });
  } catch (err) {
    // Degrade gracefully — the dashboard treats this as "MCP unavailable".
    return NextResponse.json({ ok: false, source: "@arizeai/phoenix-mcp", error: String(err), learning });
  }
}

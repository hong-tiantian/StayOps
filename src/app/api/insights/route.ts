import { NextResponse } from "next/server";
import { phoenixCallJson } from "@/lib/mcp/phoenixClient";
import { feedbackSummary } from "@/lib/learning/feedbackStore";

export const dynamic = "force-dynamic";

interface PhoenixProject {
  name: string;
  description: string | null;
  id: string;
}

interface PhoenixSpan {
  id: string;
  name: string;
  context: { trace_id: string; span_id: string };
  span_kind: string;
  parent_id: string | null;
  start_time: string;
  end_time: string;
  status_code: string;
  attributes?: Record<string, unknown>;
}

interface SpansPage {
  spans: PhoenixSpan[];
}

/** Summary of the most recent promise_audit run, reconstructed from Phoenix spans. */
export interface AuditTraceSummary {
  trace_id: string;
  started_at: string;
  duration_ms: number;
  span_count: number;
  llm_calls: number;
  tool_calls: number;
  tool_names: string[];
  injection_flags: string;
  phoenix_url?: string;
}

async function latestAuditTrace(projectName: string): Promise<AuditTraceSummary | null> {
  // 1. Find the most recent root agent span ("promise_audit") in our own project.
  const roots = await phoenixCallJson<SpansPage>("get-spans", {
    project_identifier: projectName,
    names: ["promise_audit"],
    limit: 50,
  });
  const root = (roots.spans ?? [])
    .slice()
    .sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
  if (!root) return null;

  // 2. Pull the whole trace tree and summarize what the agent actually did.
  const tree = await phoenixCallJson<SpansPage>("get-spans", {
    project_identifier: projectName,
    trace_ids: [root.context.trace_id],
    limit: 200,
  });
  const spans = tree.spans ?? [];
  const llm = spans.filter((s) => s.name.startsWith("gemini."));
  const tools = spans.filter((s) => s.name.startsWith("tool."));
  const toolNames = Array.from(new Set(tools.map((s) => s.name.replace(/^tool\./, ""))));

  const base = process.env.PHOENIX_COLLECTOR_ENDPOINT;
  return {
    trace_id: root.context.trace_id,
    started_at: root.start_time,
    duration_ms: Math.max(0, Date.parse(root.end_time) - Date.parse(root.start_time)),
    span_count: spans.length,
    llm_calls: llm.length,
    tool_calls: tools.length,
    tool_names: toolNames,
    injection_flags: String(root.attributes?.["stayops.injection_flags"] ?? "none"),
    phoenix_url: base ? `${base.replace(/\/$/, "")}/projects` : undefined,
  };
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

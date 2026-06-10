import { phoenixCallJson } from "@/lib/mcp/phoenixClient";

interface PhoenixSpan {
  name: string;
  context: { trace_id: string; span_id: string };
  start_time: string;
  end_time: string;
  attributes?: Record<string, unknown>;
}

interface SpansPage {
  spans: PhoenixSpan[];
}

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

export async function latestAuditTrace(projectName = "stayops"): Promise<AuditTraceSummary | null> {
  const roots = await phoenixCallJson<SpansPage>("get-spans", {
    project_identifier: projectName,
    names: ["promise_audit"],
    limit: 50,
  });
  const root = (roots.spans ?? []).slice().sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
  if (!root) return null;

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

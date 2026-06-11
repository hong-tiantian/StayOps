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

interface ImprovementSuggestion {
  title: string;
  detail: string;
  basis: string;
}

function buildImprovementSuggestions(
  auditTrace: AuditTraceSummary | null,
  learning: ReturnType<typeof feedbackSummary>
): ImprovementSuggestion[] {
  const toolNames = new Set(auditTrace?.tool_names ?? []);
  const suggestions: ImprovementSuggestion[] = [];

  if (toolNames.has("check_room_readiness")) {
    suggestions.push({
      title: "Pre-lock high-risk room promises",
      detail: "Quiet-room and early-check-in commitments should be reviewed before arrival-day ops starts.",
      basis: "Observed room-readiness checks in the latest audit trace.",
    });
  }

  if (toolNames.has("check_event_space") || toolNames.has("check_inventory")) {
    suggestions.push({
      title: "Verify event setup deadlines against SOP",
      detail: "Meeting-room setup should be checked against the required lead time, not only equipment availability.",
      basis: "Observed event-space or inventory checks in the latest audit trace.",
    });
  }

  if (toolNames.has("check_data_freshness")) {
    suggestions.push({
      title: "Keep stale-source decisions in manager review",
      detail: "Promises backed by stale operational data should stay in a review lane until the source refreshes.",
      basis: "Observed freshness checks in the latest audit trace.",
    });
  }

  if (learning.learned_count > 0) {
    suggestions.push({
      title: "Reuse repeated manager decisions",
      detail: "Convert repeated approvals or rejections into suggested handling notes, while leaving final approval with the manager.",
      basis: `Learned from ${learning.total_decisions} manager decision(s).`,
    });
  }

  return suggestions.slice(0, 3);
}

function buildCostBasis(auditTrace: AuditTraceSummary | null) {
  return {
    measured: auditTrace
      ? {
          gemini_turns: auditTrace.llm_calls,
          tool_calls: auditTrace.tool_calls,
          trace_duration_ms: auditTrace.duration_ms,
          traced_spans: auditTrace.span_count,
        }
      : null,
    unavailable: ["token_count", "usd_estimate"],
    note:
      "Gemini turns, tool calls, trace duration, and spans are measured from Phoenix. Token and USD cost stay unavailable until Gemini usage metadata is captured in this deployment.",
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
      improvement_suggestions: buildImprovementSuggestions(audit_trace, learning),
      cost_basis: buildCostBasis(audit_trace),
      learning,
    });
  } catch (err) {
    // Degrade gracefully — the dashboard treats this as "MCP unavailable".
    return NextResponse.json({
      ok: false,
      source: "@arizeai/phoenix-mcp",
      error: String(err),
      improvement_suggestions: buildImprovementSuggestions(null, learning),
      cost_basis: buildCostBasis(null),
      learning,
    });
  }
}

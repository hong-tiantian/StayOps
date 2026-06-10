import { runPromiseAudit } from "@/lib/classifier";
import { traceComplaint } from "@/lib/recovery";
import { latestAuditTrace } from "@/lib/evaluation/phoenixTrace";
import { computeBookingMetrics, loadBookingEvalCase } from "@/lib/evaluation/metrics";

export async function runBookingEval(booking_id: string) {
  const evalCase = loadBookingEvalCase(booking_id);
  const start = performance.now();
  const audit = await runPromiseAudit(booking_id, { force: true });
  const latencyMs = Math.round(performance.now() - start);
  const complaintTrace = traceComplaint(booking_id, evalCase.case.complaint_text);

  let phoenixTrace = null;
  if (process.env.PHOENIX_COLLECTOR_ENDPOINT && process.env.PHOENIX_API_KEY) {
    try {
      phoenixTrace = await latestAuditTrace("stayops");
    } catch (err) {
      console.warn("[StayOps] Phoenix trace unavailable for eval metrics:", err);
    }
  }

  return computeBookingMetrics({
    audit,
    complaintTrace,
    evalCase: evalCase.case,
    expectations: evalCase.expectations,
    phoenixTrace,
    latency_ms: latencyMs,
  });
}

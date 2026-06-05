import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";

// OpenInference semantic-convention attribute keys (string literals — the
// @arizeai semconv package exports these as values but with varying names
// across versions, so we use the stable wire keys directly).
const OI_SPAN_KIND = "openinference.span.kind";
const OI_OUTPUT_VALUE = "output.value";

/**
 * OpenTelemetry → Arize Phoenix tracing for the StayOps agent.
 *
 * @google/genai has no JS auto-instrumentor, so we emit OpenInference spans
 * manually (one per LLM call and per tool call) via traceAsync/traceSync.
 * Initialization is a no-op when PHOENIX_* env vars are absent, so the app
 * runs fine without tracing.
 */

let started = false;

export function initTracing(): void {
  if (started) return;
  const base = process.env.PHOENIX_COLLECTOR_ENDPOINT;
  const apiKey = process.env.PHOENIX_API_KEY;
  if (!base || !apiKey) {
    console.log("[StayOps] Phoenix tracing disabled (no PHOENIX_* env).");
    return;
  }
  const exporter = new OTLPTraceExporter({
    url: `${base}/v1/traces`,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": "stayops",
      "openinference.project.name": process.env.PHOENIX_PROJECT ?? "stayops",
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();
  started = true;
  console.log("[StayOps] Phoenix tracing enabled →", base);
}

const getTracer = () => trace.getTracer("stayops-agent");

type Attrs = Record<string, string | number | boolean>;

function applyAttrs(span: Span, kind: string, attrs: Attrs): void {
  span.setAttribute(OI_SPAN_KIND, kind);
  for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v);
}

function safeJson(v: unknown): string {
  try {
    return (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 4000);
  } catch {
    return String(v);
  }
}

/** Wrap an async unit of agent work in an OpenInference span. */
export async function traceAsync<T>(
  name: string,
  kind: string,
  attrs: Attrs,
  fn: () => Promise<T>
): Promise<T> {
  return getTracer().startActiveSpan(name, async (span) => {
    applyAttrs(span, kind, attrs);
    try {
      const result = await fn();
      span.setAttribute(OI_OUTPUT_VALUE, safeJson(result));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Wrap a synchronous unit of agent work (e.g. a deterministic tool) in a span. */
export function traceSync<T>(name: string, kind: string, attrs: Attrs, fn: () => T): T {
  return getTracer().startActiveSpan(name, (span) => {
    applyAttrs(span, kind, attrs);
    try {
      const result = fn();
      span.setAttribute(OI_OUTPUT_VALUE, safeJson(result));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

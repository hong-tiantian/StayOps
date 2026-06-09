// Phoenix connectivity check: send one OpenInference span and confirm it exports.
// Run: node --env-file=.env.local scripts/test-phoenix.mjs
import { trace, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const base = process.env.PHOENIX_COLLECTOR_ENDPOINT;
const apiKey = process.env.PHOENIX_API_KEY;
if (!base || !apiKey) {
  console.error("Missing PHOENIX_COLLECTOR_ENDPOINT or PHOENIX_API_KEY in .env.local");
  process.exit(1);
}
const url = `${base}/v1/traces`;
console.log("Phoenix endpoint:", url);

const exporter = new OTLPTraceExporter({
  url,
  headers: { Authorization: `Bearer ${apiKey}` },
});

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    "service.name": "stayops",
    "openinference.project.name": "stayops",
  }),
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
provider.register();

const tracer = trace.getTracer("stayops-connectivity");
const span = tracer.startSpan("phoenix-connectivity-test");
span.setAttribute("openinference.span.kind", "CHAIN");
span.setAttribute("input.value", "ping");
span.setAttribute("output.value", "pong");
span.end();

await provider.forceFlush();
console.log("✅ flushed span — check Phoenix → Tracing → project 'stayops' for 'phoenix-connectivity-test'");
await provider.shutdown();

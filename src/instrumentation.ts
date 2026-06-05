// Next.js calls register() once at server startup. We initialize Phoenix
// tracing here so spans emitted from API routes are exported.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTracing } = await import("./lib/tracing");
    initTracing();
  }
}

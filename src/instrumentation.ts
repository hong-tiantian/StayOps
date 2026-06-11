// Next.js calls register() once at server startup. We initialize Phoenix
// tracing here, and — when DATABASE_URL is set — restore the learning state
// (hotels, SOP vectors, case memory, manager feedback) from Postgres into the
// fresh SQLite working store, so Cloud Run cold starts lose nothing.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initTracing } = await import("./lib/tracing");
    initTracing();

    const { pgEnabled, hydrateFromPg } = await import("./lib/store/pgMirror");
    if (pgEnabled()) {
      const { getDb } = await import("./lib/store/db");
      const { ensureHotelSchema } = await import("./lib/hotel/hotelStore");
      ensureHotelSchema(); // create tables (and seeds) before hydration upserts over them
      await hydrateFromPg(getDb());
    }
  }
}

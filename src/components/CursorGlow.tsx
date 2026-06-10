"use client";

import { useEffect } from "react";

/**
 * App-wide cursor effects:
 *  - a soft radial spotlight that follows the pointer (fixed, behind content)
 *  - publishes --mx/--my CSS vars on :root so any element can react
 * Respects prefers-reduced-motion.
 */
export default function CursorGlow() {
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let tx = window.innerWidth * 0.5;
    let ty = window.innerHeight * 0.3;
    let cx = tx;
    let cy = ty;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      // easing for a gentle trailing follow
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      const root = document.documentElement;
      root.style.setProperty("--mx", `${cx}px`);
      root.style.setProperty("--my", `${cy}px`);
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(460px circle at var(--mx) var(--my), rgb(var(--atmo-glow) / 9%), rgb(var(--atmo-glow) / 4%) 35%, transparent 60%)",
        transition: "opacity 0.3s ease",
      }}
    />
  );
}

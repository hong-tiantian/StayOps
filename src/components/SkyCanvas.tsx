"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * SkyCanvas — the living photographic sky.
 *
 * Planet-Earth-grade nature & travel photography, pooled per weather state,
 * with a daily feed on top:
 *
 *   curated pools  imported landscape photos shipped in /public/sky/imported
 *   daily pool     Bing's photo-of-the-day archive via /api/sky/daily —
 *                  fresh professional landscapes every day, merged into the
 *                  calm pool (the scrim keeps any photo on-mood)
 *   opening shot   RANDOM on every load (picked client-side after mount, so
 *                  SSR markup stays deterministic and hydration is clean)
 *   rotation       every 90s, plus the ✦ button for a manual random cut;
 *                  every swap is a 1.4s dissolve between two stacked panes
 *
 * Weather comes from <html data-weather> (owned by page.tsx) via a
 * MutationObserver, so this component needs no props and no context.
 *
 * Curated photos are committed under public/sky/imported so the core UI does
 * not depend on external photo sources.
 */

type Weather = "calm" | "warning" | "critical";

// Curated photos from Pexels (Pexels License, free to use). Per-image
// photographer credits and source pages are in ATTRIBUTIONS.md at the repo root.
const POOLS: Record<Weather, string[]> = {
  calm: [
    "/sky/imported/MountainLake.jpg",
    "/sky/imported/GreenMeadow.jpg",
    "/sky/imported/AlpsArles.jpg",
    "/sky/imported/BlueRoofSky.jpg",
  ],
  warning: [
    "/sky/imported/UrbanDusk.jpg",
    "/sky/imported/MountainLake.jpg",
    "/sky/imported/AlpsArles.jpg",
  ],
  critical: [
    "/sky/imported/Nebula.jpg",
    "/sky/imported/UrbanDusk.jpg",
    "/sky/imported/GreenMeadow.jpg",
  ],
};

/** Weather-toned scrim over the photo: contrast for white ink + hue coherence. */
const SCRIMS: Record<Weather, string> = {
  calm:
    "linear-gradient(168deg, rgba(6, 26, 28, 0.5) 0%, rgba(5, 24, 26, 0.26) 40%, rgba(4, 22, 26, 0.55) 100%)",
  warning:
    "linear-gradient(168deg, rgba(34, 18, 6, 0.52) 0%, rgba(30, 16, 6, 0.28) 40%, rgba(26, 13, 5, 0.58) 100%)",
  critical:
    "linear-gradient(168deg, rgba(18, 12, 30, 0.54) 0%, rgba(16, 11, 28, 0.32) 40%, rgba(12, 8, 22, 0.6) 100%)",
};

const ROTATE_MS = 90_000;
const FADE_MS = 1400;
const MAX_DAILY = 5;

function readWeather(): Weather {
  const w = document.documentElement.dataset.weather;
  return w === "warning" || w === "critical" ? w : "calm";
}

export default function SkyCanvas() {
  const [weather, setWeather] = useState<Weather>("calm");
  const [index, setIndex] = useState(0);
  const [daily, setDaily] = useState<string[]>([]);
  // Two stacked panes crossfade; one atomic state object avoids races
  // between "which pane is front" and "what each pane shows".
  // Both panes start EMPTY so the first photo (randomly chosen after mount)
  // fades in from the deep base color — and SSR/CSR markup match.
  const [view, setView] = useState<{ front: 0 | 1; srcs: [string, string] }>({
    front: 0,
    srcs: ["", ""],
  });
  const [booted, setBooted] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dailyRef = useRef<string[]>([]);
  dailyRef.current = daily;

  const poolFor = useCallback((w: Weather, dailyImages: string[]): string[] => {
    return w === "calm" ? [...POOLS.calm, ...dailyImages.slice(0, MAX_DAILY)] : POOLS[w];
  }, []);

  /** Dissolve to a specific image (no-op if it is already showing). */
  const showImage = useCallback((src: string) => {
    if (!src) return;
    setView((prev) => {
      if (prev.srcs[prev.front] === src) return prev;
      const back: 0 | 1 = prev.front === 0 ? 1 : 0;
      const srcs: [string, string] = [...prev.srcs] as [string, string];
      srcs[back] = src;
      return { front: back, srcs };
    });
  }, []);

  const advance = useCallback(
    (random = false) => {
      setIndex((i) => {
        const pool = poolFor(readWeather(), dailyRef.current);
        if (pool.length <= 1) return i;
        let next = (i + 1) % pool.length;
        if (random) {
          do {
            next = Math.floor(Math.random() * pool.length);
          } while (next === i % pool.length);
        }
        return next;
      });
    },
    [poolFor]
  );

  // Boot: watch <html data-weather>, pick a RANDOM opening shot, load the
  // daily feed (failures are silent — curated pools always exist).
  useEffect(() => {
    setWeather(readWeather());
    const observer = new MutationObserver(() => setWeather(readWeather()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-weather"] });

    setIndex(Math.floor(Math.random() * POOLS[readWeather()].length));
    setBooted(true);

    fetch("/api/sky/daily")
      .then((r) => r.json())
      .then((j: { images?: string[] }) => setDaily(j.images ?? []))
      .catch(() => setDaily([]));

    return () => observer.disconnect();
  }, []);

  // Weather or index change → dissolve to the right photo + preload the next.
  useEffect(() => {
    if (!booted) return;
    const pool = poolFor(weather, daily);
    const src = pool[index % pool.length];
    showImage(src);
    const preload = new Image();
    preload.src = pool[(index + 1) % pool.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, index, booted, daily]);

  // Timed rotation.
  useEffect(() => {
    timer.current = setInterval(() => advance(false), ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [advance]);

  const shuffle = useCallback(() => {
    advance(true);
    // restart the clock so a manual pick gets its full stage time
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => advance(false), ROTATE_MS);
  }, [advance]);

  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden
          className="sky-pane"
          style={{
            backgroundImage: view.srcs[i] ? `url(${view.srcs[i]})` : undefined,
            opacity: view.front === i && view.srcs[i] ? 1 : 0,
            transitionDuration: `${FADE_MS}ms`,
            animationDelay: i === 0 ? "0s" : "-23s",
          }}
        />
      ))}
      <div aria-hidden className="sky-scrim" style={{ backgroundImage: SCRIMS[weather] }} />
      <button
        type="button"
        onClick={shuffle}
        title="Shuffle the scenery"
        aria-label="Shuffle background landscape"
        className="sky-shuffle"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
    </>
  );
}

"use client";

import { ReactNode, useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Animated number                                                     */
/* ------------------------------------------------------------------ */
export function CountUp({
  value,
  className,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  value: number;
  className?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`
  );
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: EASE });
    return controls.stop;
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/* ------------------------------------------------------------------ */
/* Trend pill (+15.7% / -10.7%)                                        */
/* ------------------------------------------------------------------ */
export function TrendPill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={up ? "pill-up" : "pill-down"}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Glass card wrapper                                                  */
/* ------------------------------------------------------------------ */
export function GlassCard({
  children,
  className,
  interactive = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "relative overflow-hidden glass",
        interactive && "lift cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut chart                                                         */
/* ------------------------------------------------------------------ */
export type DonutSlice = { label: string; value: number; color: string };

export function Donut({
  data,
  size = 168,
  thickness = 20,
  centerTop,
  centerBottom,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerTop?: ReactNode;
  centerBottom?: ReactNode;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = frac * c;
          const seg = (
            <motion.circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`}
              initial={{ strokeDashoffset: -c }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.05 * i }}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          {centerTop}
          {centerBottom}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical bar chart                                                  */
/* ------------------------------------------------------------------ */
export type Bar = { label: string; value: number; hint?: string };

export function Bars({
  data,
  highlightIndex,
  height = 150,
}: {
  data: Bar[];
  highlightIndex?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / max) * (height - 26));
        const hot = i === highlightIndex;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
            <div className="relative flex w-full justify-center">
              {hot && (
                <div className="tnum absolute -top-6 whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900">
                  {d.hint ?? d.value}
                </div>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.05 * i }}
                className={cx(
                  "w-full max-w-[30px] rounded-t-md rounded-b-sm",
                  hot ? "bg-white/85" : "bg-white/[0.14]"
                )}
                style={{ height: h }}
              />
            </div>
            <div className="t-caption">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend dot                                                          */
/* ------------------------------------------------------------------ */
export function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="t-body !text-[12.5px]">{label}</span>
      </div>
      <span className="tnum text-[13px] font-semibold text-white/90">{value}</span>
    </div>
  );
}

"use client";

import { ReactNode } from "react";
import { cx } from "@/components/ui/visuals";

export default function WidgetCard({
  title,
  icon,
  accent,
  editing,
  onExpand,
  expandLabel,
  headerRight,
  bodyClassName,
  className,
  children,
}: {
  title?: string;
  icon?: ReactNode;
  accent?: string; // rgb string — renders as a small status dot
  editing?: boolean;
  onExpand?: () => void;
  expandLabel?: string;
  headerRight?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("widget relative flex h-full w-full flex-col overflow-hidden glass", className)}>
      {title !== undefined && (
        <div
          className={cx(
            "widget-drag flex h-10 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-5",
            editing && "select-none"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {/* One dot color per page — the ambient weather hue. Per-widget
                accents read as noise, so `accent` only toggles visibility. */}
            {accent && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "rgb(var(--ambient) / 0.85)" }}
              />
            )}
            {icon && <span className="shrink-0 text-[12px] opacity-70">{icon}</span>}
            <span className="t-label truncate">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerRight}
            {onExpand && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
              >
                {expandLabel ?? "Open"}
              </button>
            )}
            {editing && <span className="text-white/30" title="drag">⠿</span>}
          </div>
        </div>
      )}
      <div className={cx("min-h-0 flex-1 overflow-auto p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

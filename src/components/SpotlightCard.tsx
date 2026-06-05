"use client";

import { useRef } from "react";

/**
 * A card that shows a soft radial highlight tracking the pointer inside it,
 * plus a subtle lift on hover. Used for the main operational panels.
 */
export default function SpotlightCard({
  children,
  className = "",
  as: Tag = "div",
  onClick,
  glowColor = "99,102,241",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "button" | "li";
  onClick?: () => void;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };

  const Comp = Tag as any;
  return (
    <Comp
      ref={ref}
      onPointerMove={onMove}
      onClick={onClick}
      className={`group/spot card lift relative overflow-hidden ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(260px circle at var(--sx, 50%) var(--sy, 0%), rgba(${glowColor},0.12), transparent 60%)`,
        }}
      />
      <span className="relative z-[1] block">{children}</span>
    </Comp>
  );
}

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import RGL from "react-grid-layout";

const { WidthProvider, Responsive } = RGL as unknown as {
  WidthProvider: (c: unknown) => React.ComponentType<Record<string, unknown>>;
  Responsive: unknown;
};
const ResponsiveGridLayout = WidthProvider(Responsive);

export type GLayout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };
export type GLayouts = Record<string, GLayout[]>;

export const GRID_BREAKPOINTS = { lg: 1024, sm: 0 };
export const GRID_COLS = { lg: 12, sm: 1 };
export const ROW_HEIGHT = 20;

export type WidgetItem = { id: string; node: ReactNode };

export default function WidgetGrid({
  storageKey,
  editing,
  defaultLayouts,
  items,
  resetNonce = 0,
}: {
  storageKey: string;
  editing: boolean;
  defaultLayouts: GLayouts;
  items: WidgetItem[];
  resetNonce?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [layouts, setLayouts] = useState<GLayouts>(defaultLayouts);
  const firstReset = useRef(true);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(storageKey);
      setLayouts(raw ? JSON.parse(raw) : defaultLayouts);
    } catch {
      setLayouts(defaultLayouts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Reset to defaults when parent bumps the nonce.
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    setLayouts(defaultLayouts);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  const onLayoutChange = (_current: GLayout[], all: GLayouts) => {
    setLayouts(all);
    if (editing) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(all));
      } catch {
        /* ignore */
      }
    }
  };

  if (!mounted) {
    return <div style={{ minHeight: 480 }} />;
  }

  return (
    <ResponsiveGridLayout
      className={editing ? "grid-editing" : ""}
      layouts={layouts}
      breakpoints={GRID_BREAKPOINTS}
      cols={GRID_COLS}
      rowHeight={ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".widget-drag"
      resizeHandles={["se"]}
      onLayoutChange={onLayoutChange}
      compactType="vertical"
      useCSSTransforms
    >
      {items.map((it) => (
        <div key={it.id}>{it.node}</div>
      ))}
    </ResponsiveGridLayout>
  );
}

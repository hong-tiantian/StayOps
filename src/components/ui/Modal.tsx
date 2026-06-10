"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-6xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className={`glass-shell relative z-10 flex max-h-[88vh] w-full ${maxWidth} flex-col overflow-hidden rounded-[28px]`}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 bg-white/[0.04] px-5 py-3.5">
              <div className="min-w-0">
                {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
                {subtitle && <p className="mt-0.5 text-[11px] text-white/45">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-white/60 transition hover:bg-white/12 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

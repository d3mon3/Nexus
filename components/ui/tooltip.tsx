"use client";


import { t } from "@/lib/i18n";
import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredStyle } from "./floating";
import { cn } from "@/lib/utils";

/** Lightweight tooltip shown on hover and keyboard focus (mounted only while open). */
export function Tooltip({ content, children, side = "top", className }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const pos = useAnchoredStyle(ref, open && Boolean(content), { side, align: "center", gap: 8 });
  if (!content) return <>{children}</>;
  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && pos && typeof document !== "undefined" && createPortal(
        <span
          id={id}
          role="tooltip"
          style={pos}
          className={cn(
            "pointer-events-none w-max max-w-[260px] animate-[tooltip-in_120ms_ease-out] rounded-md border border-primary/30 bg-[#0d1226]/95 px-2.5 py-1.5 text-xs font-normal normal-case leading-snug tracking-normal text-fg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.8),0_0_16px_-6px_var(--primary-glow)] light:bg-white",
          )}
        >
          {typeof content === "string" ? t(content) : content}
        </span>,
        document.body,
      )}
    </span>
  );
}

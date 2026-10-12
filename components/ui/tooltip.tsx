"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Lightweight tooltip shown on hover and keyboard focus (mounted only while open). */
export function Tooltip({ content, children, side = "top", className }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom"; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!content) return <>{children}</>;
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-[60] w-max max-w-[240px] -translate-x-1/2 animate-[tooltip-in_120ms_ease-out] rounded-md border border-primary/30 bg-[#0d1226]/95 px-2.5 py-1.5 text-xs font-normal normal-case leading-snug tracking-normal text-fg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.8),0_0_16px_-6px_var(--primary-glow)] light:bg-white",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

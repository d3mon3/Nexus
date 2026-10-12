"use client";

import { motion } from "framer-motion";
import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
}

/** Underlined tab bar with an animated glowing indicator. Arrow keys move between tabs. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
  size = "md",
  label = "Sections",
}: {
  value: T;
  onChange: (v: T) => void;
  items: TabItem<T>[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].value);
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex items-end gap-1 overflow-x-auto scrollbar-none", className)}>
      {items.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative shrink-0 font-medium transition-colors",
              size === "sm" ? "px-3 pb-2 pt-1 text-[13px]" : "px-5 pb-3 pt-2 text-sm",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary shadow-[0_0_12px_2px_var(--primary-glow)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-style segmented control. */
export function Segmented<T extends string>({ value, onChange, items, className, label = "Options" }: { value: T; onChange: (v: T) => void; items: TabItem<T>[]; className?: string; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-surface-2/80 p-0.5", className)}>
      {items.map((t) => (
        <button
          key={t.value}
          role="radio"
          aria-checked={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
            t.value === value ? "bg-primary/90 text-white shadow-[0_0_14px_-3px_var(--primary-glow)]" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

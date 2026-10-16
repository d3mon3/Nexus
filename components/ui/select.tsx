"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredStyle } from "./floating";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

/**
 * Accessible listbox dropdown (keyboard: ↑ ↓ Home End Enter Esc, type-ahead).
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
  align = "left",
  icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  /** Icon shown before the selected value (e.g. a globe for the region). */
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const pos = useAnchoredStyle(ref, open, { align, matchWidth: true });
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => String(typeof o.label === "string" ? o.label : o.value).toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/80 text-fg transition-colors hover:border-primary/50 light:rounded-xl light:bg-white/60 light:shadow-[0_6px_18px_-12px_rgba(64,76,160,0.5)]",
          size === "sm" ? "h-8 px-2.5 text-xs" : "h-10 px-3 text-sm",
          open && "border-primary/70",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon}
          {current?.icon}
          {t(current?.label)}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
      <AnimatePresence>
        {open && pos && (
          <motion.ul
            ref={listRef}
            style={pos}
            id={listId}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "panel max-h-72 overflow-auto p-1 text-sm shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] light:bg-white/95 light:shadow-[0_16px_40px_-12px_rgba(64,76,160,0.5)]",
            )}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-muted",
                  i === active && "bg-surface-hover text-fg",
                  o.value === value && "text-fg",
                )}
              >
                {o.icon}
                <span className="flex-1">{t(o.label)}</span>
                {o.value === value && <Check className="size-3.5 text-primary" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

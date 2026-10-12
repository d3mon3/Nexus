"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages, onChange, hasMore, className }: { page: number; totalPages: number | null; onChange: (p: number) => void; hasMore?: boolean; className?: string }) {
  const last = totalPages ?? page + (hasMore ? 1 : 0);
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-xs font-medium transition-colors";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      <button className={cn(btn, "border-line text-muted hover:text-fg disabled:opacity-40")} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="size-3.5" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-dim">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(btn, p === page ? "border-primary/70 bg-primary-soft text-fg shadow-[0_0_12px_-4px_var(--primary-glow)]" : "border-line text-muted hover:text-fg")}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(btn, "border-line text-muted hover:text-fg disabled:opacity-40")} onClick={() => onChange(page + 1)} disabled={page >= last} aria-label="Next page">
        <ChevronRight className="size-3.5" />
      </button>
    </nav>
  );
}

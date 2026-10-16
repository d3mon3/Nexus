"use client";


import { t } from "@/lib/i18n";
import type { ReactNode } from "react";

/** Shared tooltip chrome for Recharts `content` render props. */
export function ChartTooltipBox({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-[#0d1226]/95 px-3 py-2 text-xs shadow-[0_8px_24px_-6px_rgba(0,0,0,0.8),0_0_18px_-8px_var(--primary-glow)] backdrop-blur light:bg-white">
      {title && <p className="mb-1 font-semibold text-fg">{title}</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2 text-muted">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
          <span>{t(r.label)}</span>
          <span className="ml-auto pl-3 font-semibold text-fg tabular">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

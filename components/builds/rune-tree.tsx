"use client";

import { RUNE_STYLES, RUNES, STAT_SHARDS } from "@/lib/static-data";
import type { RunePage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RuneIcon } from "../game/icons";

const SHARD_ROWS = [
  [5008, 5005, 5007],
  [5008, 5010, 5001],
  [5011, 5013, 5001],
];

/** Full rune page: primary tree (all options, chosen lit), secondary tree and stat shards. */
export function RuneTree({ page, compact = false }: { page: RunePage; compact?: boolean }) {
  const primary = RUNE_STYLES.find((s) => s.id === page.primaryStyle);
  const secondary = RUNE_STYLES.find((s) => s.id === page.subStyle);
  const chosen = new Set(page.perks);
  const size = compact ? 26 : 32;
  const rows = (styleId: number, from: number) =>
    [0, 1, 2, 3].filter((r) => r >= from).map((row) => RUNES.filter((x) => x.style === styleId && x.row === row));

  const column = (styleId: number, from: number, label: string | undefined, color: string | undefined) => (
    <div className="flex-1">
      <div className="mb-3 flex items-center gap-2">
        <RuneIcon id={styleId} size={22} />
        <span className="text-sm font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="relative space-y-3">
        <span className="absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" aria-hidden />
        {rows(styleId, from).map((row, i) => (
          <div key={i} className="relative flex items-center justify-center gap-3">
            {row.map((r) => {
              const on = chosen.has(r.id);
              return (
                <span key={r.id} className={cn("rounded-full p-0.5 transition-all", on && "ring-2 shadow-[0_0_14px_-2px_currentColor]")} style={{ color: on ? color : undefined, ["--tw-ring-color" as string]: color }}>
                  <RuneIcon id={r.id} size={r.row === 0 ? size + 8 : size} dim={!on} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      {column(page.primaryStyle, 0, primary?.name, primary?.color)}
      <div className="flex flex-1 flex-col gap-5">
        {column(page.subStyle, 1, secondary?.name, secondary?.color)}
        {page.shards.length > 0 && (
          <div className="space-y-1.5">
            {SHARD_ROWS.map((row, i) => (
              <div key={i} className="flex justify-center gap-3">
                {row.map((id, j) => (
                  <span key={j} title={STAT_SHARDS[id]?.name}>
                    <RuneIcon id={id} size={18} dim={page.shards[i] !== id} className="bg-black/40 p-0.5" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

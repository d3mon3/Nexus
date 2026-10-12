"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { compact, formatKda, kdaColor, pct, wrColor } from "@/lib/format";
import { useStatic } from "@/lib/static-context";
import type { MasteryEntry, PlayerStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Progress } from "../ui/progress";
import { SkeletonRows } from "../ui/skeleton";
import { EmptyState } from "../ui/states";

type SortKey = "games" | "winrate" | "kda" | "cs" | "mastery";

export function ChampionPerformanceTable({ stats, loading, mastery }: { stats: PlayerStats | undefined; loading: boolean; mastery: MasteryEntry[] }) {
  const { champion } = useStatic();
  const [sort, setSort] = useState<SortKey>("games");
  const [desc, setDesc] = useState(true);
  const masteryById = useMemo(() => new Map(mastery.map((m) => [m.championId, m])), [mastery]);

  const rows = useMemo(() => {
    const list = (stats?.champions ?? []).map((c) => ({ ...c, wr: c.wins / c.games, points: masteryById.get(c.championId)?.championPoints ?? 0 }));
    const val = (r: (typeof list)[number]) => ({ games: r.games, winrate: r.wr, kda: r.kda, cs: r.csPerMin, mastery: r.points })[sort];
    return list.sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
  }, [stats, sort, desc, masteryById]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-3 py-2 font-medium", className)} aria-sort={sort === key ? (desc ? "descending" : "ascending") : "none"}>
      <button
        onClick={() => (sort === key ? setDesc(!desc) : (setSort(key), setDesc(true)))}
        className={cn("inline-flex items-center gap-1 hover:text-fg", sort === key && "text-primary")}
      >
        {label}
        {sort === key && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );

  return (
    <Card>
      <CardHeader title="Champion Performance" action={stats && <span className="text-xs text-dim">from the last {stats.games} games · mastery from Champion-Mastery-V4</span>} />
      <CardBody className="overflow-x-auto">
        {loading ? (
          <SkeletonRows rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="No champion data" />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Champion</th>
                {header("games", "Games", "text-right")}
                {header("winrate", "Win rate")}
                {header("kda", "KDA")}
                {header("cs", "CS/min", "text-right")}
                {header("mastery", "Mastery", "text-right")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = champion(r.championId);
                return (
                  <tr key={r.championId} className="border-t border-line-soft/70 transition-colors hover:bg-surface-hover/40">
                    <td className="px-3 py-2">
                      <Link href={`/champions/${c?.key.toLowerCase() ?? r.championId}`} className="flex items-center gap-3 hover:text-primary">
                        <ChampionIcon id={r.championId} size={34} tooltip={false} />
                        <span className="font-medium">{c?.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{r.games}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Progress value={r.wr} className="w-24" color={r.wr >= 0.5 ? "#24D6A0" : "#FF4D78"} glow={false} />
                        <span className={cn("w-10 tabular", wrColor(r.wr))}>{pct(r.wr)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("font-semibold tabular", kdaColor(r.kda))}>{formatKda(r.kda)}</span>
                      <span className="ml-2 text-xs text-muted tabular">
                        {r.kills.toFixed(1)}/{r.deaths.toFixed(1)}/{r.assists.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular">{r.csPerMin.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-muted tabular">{r.points ? compact(r.points) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

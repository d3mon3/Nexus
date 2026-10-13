"use client";


import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, LayoutGrid, Rows3 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatKda, pct, ROLE_LABEL, wrColor } from "@/lib/format";
import { useChampionStats } from "@/lib/queries";
import { REGIONS } from "@/lib/regions";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, Role, TierGrade } from "@/lib/types";
import { ROLES, TIER_GRADES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { GRADE_STYLE, TierBadge } from "../game/tier-badge";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Segmented, Tabs } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";
import { rankOptions } from "./champions-view";

type SortKey = "tier" | "winRate" | "pickRate" | "banRate" | "games";

export function TierListView() {
  const [role, setRole] = useState<Role>("MIDDLE");
  const [rank, setRank] = useState("all");
  const [region, setRegion] = useState("all");
  const [patch, setPatch] = useState<string | undefined>();
  const [view, setView] = useState<"tiers" | "table">("tiers");
  const [sort, setSort] = useState<SortKey>("tier");
  const [desc, setDesc] = useState(true);
  const q = useChampionStats({ patch, role, rank: rank === "all" ? undefined : rank, region: region === "all" ? undefined : region });
  const { champion } = useStatic();

  const rows = q.data?.data.rows ?? [];
  const grouped = useMemo(() => {
    const m = new Map<TierGrade, ChampionStat[]>();
    for (const g of TIER_GRADES) m.set(g, []);
    for (const r of rows) m.get(r.tier)!.push(r);
    for (const list of m.values()) list.sort((a, b) => b.winRate - a.winRate);
    return m;
  }, [rows]);
  const sorted = useMemo(() => {
    const v = (r: ChampionStat) => (sort === "tier" ? -TIER_GRADES.indexOf(r.tier) * 10 + r.winRate : r[sort]);
    return [...rows].sort((a, b) => (desc ? v(b) - v(a) : v(a) - v(b)));
  }, [rows, sort, desc]);

  const th = (key: SortKey, label: string) => (
    <th className="px-3 py-2 text-right font-medium" aria-sort={sort === key ? (desc ? "descending" : "ascending") : "none"}>
      <button className={cn("inline-flex items-center gap-1 hover:text-fg", sort === key && "text-primary")} onClick={() => (sort === key ? setDesc(!desc) : (setSort(key), setDesc(true)))}>
        {label}
        {sort === key && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        title={t("Tier List")}
        description={
          <>
            Patch {q.data?.data.patch ?? "…"} ·{" "}
            {q.data?.data.sampleSize ? `${q.data.data.sampleSize.toLocaleString()} matches analysed` : "sample size unavailable for demo data"}
          </>
        }
        actions={<SourceBadge source={q.data?.source} note={t(q.data?.note)} />}
      />
      <Card className="mb-3 flex flex-wrap items-center gap-2 px-3 pt-1">
        <Tabs value={role} onChange={setRole} label={t("Role")} items={ROLES.map((r) => ({ value: r, label: <span className="flex items-center gap-1.5"><RoleIcon role={r} size={15} />{t(ROLE_LABEL[r])}</span> }))} />
        <div className="ml-auto flex flex-wrap items-center gap-2 pb-2">
          <Select size="sm" className="w-[120px]" label={t("Rank")} value={rank} onChange={setRank} options={rankOptions()} />
          <Select size="sm" className="w-[110px]" label={t("Region")} value={region} onChange={setRegion} options={[{ value: "all", label: t("All Regions") }, ...REGIONS.map((r) => ({ value: r.platform, label: t(r.label) }))]} />
          {q.data && <Select size="sm" className="w-[128px]" label={t("Patch")} value={q.data.data.patch} onChange={setPatch} options={q.data.data.patches.map((p) => ({ value: p, label: t("Patch {0}", [p]) }))} />}
          <Segmented
            label={t("View")}
            value={view}
            onChange={setView}
            items={[
              { value: "tiers", label: <><LayoutGrid className="size-3.5" />{" " + t("Tiers")}</> },
              { value: "table", label: <><Rows3 className="size-3.5" />{" " + t("Table")}</> },
            ]}
          />
        </div>
      </Card>

      {q.isLoading ? (
        <div className="space-y-2">
          {TIER_GRADES.map((g) => (
            <Skeleton key={g} className="h-[86px] rounded-[14px]" />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={q.data?.data.sampleSize === 0 ? t("Statistics are being collected") : t("No data for this filter")} description={q.data?.data.sampleSize === 0 ? t(q.data.note) : undefined} />
        </Card>
      ) : view === "tiers" ? (
        <div className="space-y-2">
          {TIER_GRADES.map((g, gi) => {
            const list = grouped.get(g)!;
            return (
              <motion.div key={g} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: gi * 0.05 }}>
                <Card className="flex items-stretch overflow-hidden">
                  <div className={cn("grid w-20 shrink-0 place-items-center border-r", GRADE_STYLE[g].bg)}>
                    <TierBadge tier={g} size="lg" className="border-0 bg-transparent" />
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2 p-3">
                    {list.length === 0 && <span className="self-center text-sm text-dim">{t("No champions in this tier")}</span>}
                    {list.map((r) => {
                      const c = champion(r.championId);
                      return (
                        <Tooltip key={r.championId} content={<span>{c?.name} · {pct(r.winRate, 1)} WR · {pct(r.pickRate, 1)} PR · {pct(r.banRate, 1)} BR · {r.games.toLocaleString()} games</span>}>
                          <Link href={`/champions/${c?.key.toLowerCase()}`} className="group flex flex-col items-center gap-1">
                            <ChampionIcon id={r.championId} size={52} tooltip={false} className="transition-all group-hover:-translate-y-0.5 group-hover:border-primary/70 group-hover:shadow-[0_0_16px_-4px_var(--primary-glow)]" />
                            <span className={cn("text-[11px] font-semibold tabular", wrColor(r.winRate))}>{pct(r.winRate, 1)}</span>
                          </Link>
                        </Tooltip>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">{t("Champion")}</th>
                {th("tier", "Tier")}
                {th("winRate", "Win rate")}
                {th("pickRate", "Pick rate")}
                {th("banRate", "Ban rate")}
                {th("games", "Games")}
                <th className="px-3 py-2 text-right font-medium">{t("KDA")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const c = champion(r.championId);
                return (
                  <tr key={r.championId} className="border-t border-line-soft/60 hover:bg-surface-hover/40">
                    <td className="px-3 py-2 text-dim tabular">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/champions/${c?.key.toLowerCase()}`} className="flex items-center gap-3 hover:text-primary">
                        <ChampionIcon id={r.championId} size={32} tooltip={false} /> {c?.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <TierBadge tier={r.tier} size="sm" />
                    </td>
                    <td className={cn("px-3 py-2 text-right font-semibold tabular", wrColor(r.winRate))}>{pct(r.winRate, 2)}</td>
                    <td className="px-3 py-2 text-right tabular">{pct(r.pickRate, 2)}</td>
                    <td className="px-3 py-2 text-right tabular">{pct(r.banRate, 2)}</td>
                    <td className="px-3 py-2 text-right text-muted tabular">{r.games.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-muted tabular">{formatKda(r.kda)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

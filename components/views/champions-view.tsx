"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { asset } from "@/lib/assets";
import { formatKda, pct, ROLE_LABEL, TIER_LABEL, wrColor } from "@/lib/format";
import { useChampionBuild, useChampionStats } from "@/lib/queries";
import { REGIONS } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, Role } from "@/lib/types";
import { ROLES, TIER_GRADES, TIERS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RuneTree } from "../builds/rune-tree";
import { SkillPriorityIcons } from "../builds/skill-icons";
import { GameImage } from "../game/game-image";
import { ChampionIcon, ItemIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { TierBadge } from "../game/tier-badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Tabs } from "../ui/tabs";

type Sort = "popularity" | "winrate" | "banrate" | "tier" | "name";

export function rankOptions() {
  return [{ value: "all", label: "All Ranks" }, ...TIERS.slice(3).map((tt) => ({ value: tt.toLowerCase(), label: `${t(TIER_LABEL[tt])}+` }))];
}

export function ChampionsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { champions, champion } = useStatic();
  const { settings, toggleFavoriteChampion } = useSettings();
  const [role, setRole] = useState<"all" | Role>((params?.get("role") as Role) ?? "all");
  const [rank, setRank] = useState("all");
  const [region, setRegion] = useState("all");
  const [sort, setSort] = useState<Sort>("popularity");
  const [patch, setPatch] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(40);
  const selectedKey = params?.get("selected");
  const select = (key: string | null) => {
    const next = new URLSearchParams(params?.toString());
    if (key) next.set("selected", key);
    else next.delete("selected");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const q = useChampionStats({ patch, role: role === "all" ? null : role, rank: rank === "all" ? undefined : rank, region: region === "all" ? undefined : region });
  const rows = useMemo(() => {
    const byChamp = new Map<number, ChampionStat>();
    for (const r of q.data?.data.rows ?? []) {
      const prev = byChamp.get(r.championId);
      if (!prev || r.games > prev.games) byChamp.set(r.championId, r);
    }
    const term = search.trim().toLowerCase();
    const list = champions
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .filter((c) => role === "all" || byChamp.has(c.id))
      .map((c) => ({ c, s: byChamp.get(c.id) }));
    const tierIdx = (s?: ChampionStat) => (s ? TIER_GRADES.indexOf(s.tier) : 9);
    return list.sort((a, b) => {
      switch (sort) {
        case "winrate":
          return (b.s?.winRate ?? 0) - (a.s?.winRate ?? 0);
        case "banrate":
          return (b.s?.banRate ?? 0) - (a.s?.banRate ?? 0);
        case "tier":
          return tierIdx(a.s) - tierIdx(b.s) || (b.s?.winRate ?? 0) - (a.s?.winRate ?? 0);
        case "name":
          return a.c.name.localeCompare(b.c.name);
        default:
          return (b.s?.pickRate ?? 0) - (a.s?.pickRate ?? 0);
      }
    });
  }, [q.data, champions, search, role, sort]);

  const selected = selectedKey ? champions.find((c) => c.key.toLowerCase() === selectedKey.toLowerCase()) : rows[0]?.c;
  const selectedStat = selected ? rows.find((r) => r.c.id === selected.id)?.s : undefined;

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold tracking-tight">{t("Champions")}</h1>
            <SourceBadge source={q.data?.source} note={t(q.data?.note)} />
            {q.data && <span className="text-xs text-dim">{t("Patch") + " "}{q.data.data.patch}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select size="sm" className="w-[156px]" label={t("Role")} value={role} onChange={setRole} options={[{ value: "all", label: t("All Roles") }, ...ROLES.map((r) => ({ value: r, label: t(ROLE_LABEL[r]), icon: <RoleIcon role={r} size={14} /> }))]} />
            <Select size="sm" className="w-[156px]" label={t("Rank")} value={rank} onChange={setRank} options={rankOptions()} />
            <Select size="sm" className="w-[156px]" label={t("Region")} value={region} onChange={setRegion} options={[{ value: "all", label: t("All Regions") }, ...REGIONS.map((r) => ({ value: r.platform, label: t(r.label) }))]} />
            <Select
              size="sm"
              className="w-[150px]"
              label={t("Sort")}
              value={sort}
              onChange={setSort}
              options={[
                { value: "popularity", label: t("Sort by Popularity") },
                { value: "winrate", label: t("Sort by Win Rate") },
                { value: "banrate", label: t("Sort by Ban Rate") },
                { value: "tier", label: t("Sort by Tier") },
                { value: "name", label: t("Sort by Name") },
              ]}
            />
            {q.data && <Select size="sm" className="w-[118px]" label={t("Patch")} value={q.data.data.patch} onChange={setPatch} options={q.data.data.patches.map((p) => ({ value: p, label: t("Patch {0}", [p]) }))} />}
            <Input wrapperClassName="h-8 w-full flex-1 sm:min-w-[160px]" className="text-xs" icon={<Search />} placeholder={t("Search champion…")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Search champion")} />
          </div>

          {q.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 15 }, (_, i) => (
                <Skeleton key={i} className="aspect-[0.78] rounded-xl" />
              ))}
            </div>
          ) : q.error ? (
            <Card>
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState title={t("No champions match")} description={t("Clear the search or pick another role.")} />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {rows.slice(0, limit).map(({ c, s }, i) => (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.015 }}
                  onClick={() => select(c.key.toLowerCase())}
                  aria-pressed={selected?.id === c.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border bg-surface-2/80 text-center transition-all duration-200",
                    selected?.id === c.id ? "glow-border" : "border-line-soft hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_0_24px_-8px_var(--primary-glow)]",
                  )}
                >
                  <div className="relative aspect-[1.05] overflow-hidden">
                    <GameImage src={asset.championLoading(c.key)} alt={c.name} className="absolute inset-0 h-full w-full scale-[1.25] object-[50%_12%] text-3xl transition-transform duration-500 group-hover:scale-[1.32]" />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0d1324] to-transparent" />
                  </div>
                  <div className="px-2 pb-2.5 pt-1">
                    <p className="text-[13px] font-semibold text-fg">{c.name}</p>
                    {s ? (
                      <>
                        <p className={cn("text-[12px] font-semibold tabular", s.winRate >= 0.5 ? "text-success" : "text-loss")}>{pct(s.winRate)}{" " + t("WR")}</p>
                        <p className="text-[12px] text-fg/80 tabular">{formatKda(s.kda)}{" " + t("KDA")}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-dim">{t("No data")}</p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
          {rows.length > limit && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + 40)}>{t("Show more champions (")}{rows.length - limit})
              </Button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {selected && (
            <motion.aside key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="xl:sticky xl:top-[84px] xl:self-start">
              <ChampionSidePanel
                championId={selected.id}
                stat={selectedStat}
                onClose={() => select(null)}
                name={champion(selected.id)?.name ?? ""}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type PanelTab = "overview" | "builds" | "runes" | "counters" | "matchups";

function ChampionSidePanel({ championId, stat, onClose, name }: { championId: number; stat: ChampionStat | undefined; onClose: () => void; name: string }) {
  const { champion } = useStatic();
  const c = champion(championId)!;
  const [tab, setTab] = useState<PanelTab>("overview");
  const build = useChampionBuild(championId, stat?.role);
  const b = build.data?.data;
  const wl = (games: number, wr: number) => `${Math.round(games * wr).toLocaleString()}W ${Math.round(games * (1 - wr)).toLocaleString()}L`;
  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="relative h-[124px]">
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            <GameImage src={asset.championSplash(c.key)} alt="" className="art-duotone h-full w-full object-[75%_20%]" />
            <div className="art-tint absolute inset-0" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0d1324_30%,rgba(13,19,36,0.35))]" />
          <div className="absolute right-2 top-2 flex gap-1">
            
            <button onClick={onClose} aria-label={t("Close panel")} className="grid size-8 place-items-center rounded-lg bg-black/40 text-white hover:text-primary xl:hidden">
              <X className="size-4" />
            </button>
          </div>
          <div className="absolute inset-y-0 left-3 flex items-center gap-3">
            <span className="glow-border block size-[86px] overflow-hidden rounded-xl">
              <GameImage src={asset.championLoading(c.key)} alt={c.name} className="size-full scale-[1.35] object-[50%_12%] text-2xl" />
            </span>
            <div>
              <h2 className="text-[26px] font-bold leading-tight text-white">{c.name}</h2>
              <p className="text-[15px] capitalize text-white/75">{t(c.title)}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-line-soft px-1">
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            label={t("Champion details")}
            items={[
              { value: "overview", label: t("Overview") },
              { value: "builds", label: t("Builds") },
              { value: "runes", label: t("Runes") },
              { value: "counters", label: t("Counters") },
              { value: "matchups", label: t("Matchups") },
            ]}
          />
        </div>
      </Card>

      {stat && (
        <Card className="grid grid-cols-[auto_1fr_1fr_1.2fr] items-center gap-2 p-3 text-center">
          <div className="grid place-items-center gap-0.5 rounded-lg border border-[#ff4d78]/30 bg-[#ff4d78]/8 px-3 py-1.5">
            <TierBadge tier={stat.tier} className="border-0 bg-transparent" />
            <span className="text-[10px] text-muted">{t("Tier")}</span>
          </div>
          <div>
            <p className={cn("text-[17px] font-bold tabular", wrColor(stat.winRate))}>{pct(stat.winRate)}</p>
            <p className="text-[11px] text-muted">{t("Win Rate")}</p>
          </div>
          <div>
            <p className="text-[17px] font-bold tabular text-success">{formatKda(stat.kda)}</p>
            <p className="text-[11px] text-muted">{t("KDA")}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">{t("Top Role")}</p>
            <p className="text-[13px] font-semibold text-secondary">
              {t(ROLE_LABEL[stat.role])} ({pct(b?.summary.pickRate ?? stat.pickRate)})
            </p>
          </div>
        </Card>
      )}

      {!b ? (
        <Skeleton className="h-60 rounded-[14px]" />
      ) : (
        <>
          {(tab === "overview" || tab === "builds") && (
            <Card className="p-3.5">
              <p className="mb-2 text-[13.5px] font-semibold">{tab === "builds" ? t("Most Popular Build") : t("Recommended Build")}</p>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {b.popular.items.map((id, i) => (
                    <ItemIcon key={i} id={id} size={32} />
                  ))}
                </div>
                <div className="ml-auto text-right">
                  <p className={cn("text-xs font-semibold tabular", wrColor(b.popular.winRate))}>{pct(b.popular.winRate)}{" " + t("WR")}</p>
                  <p className="text-[11px] text-muted tabular">{wl(b.popular.games, b.popular.winRate)}</p>
                </div>
              </div>
              {tab === "builds" && (
                <>
                  <p className="mb-2 mt-4 text-[13.5px] font-semibold">{t("Highest Win Rate")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1">
                      {b.highestWinRate.items.map((id, i) => (
                        <ItemIcon key={i} id={id} size={32} />
                      ))}
                    </div>
                    <div className="ml-auto text-right">
                      <p className={cn("text-xs font-semibold tabular", wrColor(b.highestWinRate.winRate))}>{pct(b.highestWinRate.winRate)}{" " + t("WR")}</p>
                      <p className="text-[11px] text-muted tabular">{wl(b.highestWinRate.games, b.highestWinRate.winRate)}</p>
                    </div>
                  </div>
                </>
              )}
            </Card>
          )}
          {tab === "overview" && (
            <Card className="p-3.5">
              <p className="mb-2 text-[13.5px] font-semibold">{t("Skill Order")}</p>
              <div className="flex items-center justify-between gap-3">
                <SkillPriorityIcons championId={championId} priority={b.skillOrder.priority} size={34} />
                <div className="text-center">
                  <p className="text-[12px] text-muted">{t("Victory Rate")}</p>
                  <p className="text-lg font-bold tabular text-success">{pct(b.skillOrder.winRate)}</p>
                </div>
              </div>
            </Card>
          )}
          {(tab === "overview" || tab === "runes") && b.runes[0] && (
            <Card className="p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13.5px] font-semibold">{t("Runes")}</p>
                <p className="text-[11px] text-muted tabular">
                  {pct(b.runes[0].winRate)}{" " + t("WR ·") + " "}{b.runes[0].games.toLocaleString()}{" " + t("games")}</p>
              </div>
              <RuneTree page={b.runes[0]} compact />
            </Card>
          )}
          {(tab === "counters" || tab === "matchups") && (
            <Card className="space-y-1.5 p-3.5">
              <p className="text-[13.5px] font-semibold">{tab === "counters" ? t("Counters") : t("Favourable matchups")}</p>
              <p className="text-xs text-muted">{tab === "counters" ? t("Champions {0} struggles against", [c.name]) : t("Champions {0} beats most often", [c.name])}</p>
              {(tab === "counters" ? b.counters : b.favorable).map((m) => (
                <div key={m.opponentId} className="flex items-center gap-2">
                  <ChampionIcon id={m.opponentId} size={28} />
                  <span className="flex-1 text-sm">{champion(m.opponentId)?.name}</span>
                  <span className={cn("text-sm font-semibold tabular", wrColor(m.winRate))}>{pct(m.winRate, 1)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      <Link href={`/champions/${c.key.toLowerCase()}`} className="block">
        <Button variant="primary" className="w-full">{t("Full champion page") + " "}<ArrowRight />
        </Button>
      </Link>
    </div>
  );
}

"use client";


import { t } from "@/lib/i18n";
import { Crown, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { pct, TIER_LABEL, wrColor } from "@/lib/format";
import { useLeaderboard } from "@/lib/queries";
import { parseRiotId, profileHref, REGIONS, type Platform } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ChampionIcon, ProfileIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { SourceBadge } from "../game/source-badge";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { Select } from "../ui/select";
import { SkeletonRows } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Segmented } from "../ui/tabs";

export function LeaderboardsView() {
  const { settings } = useSettings();
  const [region, setRegion] = useState<Platform>(settings.region);
  const [tier, setTier] = useState<"all" | "challenger" | "grandmaster" | "master">("all");
  const [sort, setSort] = useState<"lp" | "winrate" | "games">("lp");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const tt = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(tt);
  }, [search]);
  const pageSize = 25;
  const q = useLeaderboard({ region, tier, page, pageSize, sort, q: query || undefined });
  const d = q.data?.data;
  const top3 = page === 1 && sort === "lp" && !query && tier === "all" ? d?.entries.slice(0, 3) : undefined;

  return (
    <div>
      <PageHeader title={t("Leaderboards")} description={t("Ranked Solo/Duo apex ladder — Challenger, Grandmaster and Master.")} actions={<SourceBadge source={q.data?.source} note={t(q.data?.note)} />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="w-[110px]" label={t("Region")} value={region} onChange={(v) => (setRegion(v), setPage(1))} options={REGIONS.map((r) => ({ value: r.platform, label: t(r.label) }))} />
        <Segmented
          label={t("Tier")}
          value={tier}
          onChange={(v) => (setTier(v), setPage(1))}
          items={[
            { value: "all", label: t("All") },
            { value: "challenger", label: t("Challenger") },
            { value: "grandmaster", label: t("Grandmaster") },
            { value: "master", label: t("Master") },
          ]}
        />
        <Select
          className="w-[150px]"
          label={t("Sort")}
          value={sort}
          onChange={(v) => (setSort(v), setPage(1))}
          options={[
            { value: "lp", label: t("Sort by LP") },
            { value: "winrate", label: t("Sort by Win Rate") },
            { value: "games", label: t("Sort by Games") },
          ]}
        />
        <Input wrapperClassName="ml-auto w-[240px]" icon={<Search />} placeholder={q.data?.source === "riot" ? t("Find Name#TAG on ladder") : t("Search player…")} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t("Search leaderboard")} />
      </div>

      {top3 && top3.length === 3 && (
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          {[top3[1], top3[0], top3[2]].map((e) => {
            const id = parseRiotId(e.riotId);
            return (
              <Card key={e.puuid} hover className={cn("relative flex items-center gap-4 overflow-hidden p-4", e.rank === 1 && "glow-border md:-translate-y-2")}>
                <span className="absolute right-3 top-2 font-display text-5xl font-bold text-white/5">#{e.rank}</span>
                <div className="relative">
                  <ProfileIcon id={e.profileIconId ?? 29} size={56} className="rounded-xl" />
                  {e.rank === 1 && <Crown className="absolute -right-2 -top-3 size-5 rotate-12 fill-warning text-warning" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted">#{e.rank}</p>
                  {id ? (
                    <Link href={profileHref(region, id.gameName, id.tagLine)} className="block truncate font-semibold hover:text-primary">
                      {id.gameName}
                    </Link>
                  ) : (
                    <p className="truncate font-semibold">{e.riotId}</p>
                  )}
                  <p className="text-sm text-primary tabular">{e.lp.toLocaleString()}{" " + t("LP")}</p>
                </div>
                <RankEmblem tier={e.tier} size={52} className="ml-auto" />
              </Card>
            );
          })}
        </div>
      )}

      <Card className="overflow-x-auto">
        {q.isLoading ? (
          <SkeletonRows rows={10} className="p-4" />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !d?.entries.length ? (
          <EmptyState title={t("No players found")} description={query ? t("Nobody matching “{0}” in this ladder.", [query]) : undefined} />
        ) : (
          <table className={cn("w-full min-w-[760px] text-sm transition-opacity", q.isFetching && "opacity-60")}>
            <thead className="text-left text-[11px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Rank")}</th>
                <th className="px-4 py-3 font-medium">{t("Player")}</th>
                <th className="px-4 py-3 font-medium">{t("Tier")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("LP")}</th>
                <th className="px-4 py-3 font-medium">{t("Win rate")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("Games")}</th>
                <th className="px-4 py-3 font-medium">{t("Champions")}</th>
              </tr>
            </thead>
            <tbody>
              {d.entries.map((e) => {
                const id = parseRiotId(e.riotId);
                const games = e.wins + e.losses;
                const wr = games ? e.wins / games : 0;
                return (
                  <tr key={e.puuid} className="border-t border-line-soft/60 transition-colors hover:bg-surface-hover/40">
                    <td className="px-4 py-2.5 font-semibold tabular text-muted">{e.rank}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <ProfileIcon id={e.profileIconId ?? 29} size={30} className="rounded-lg" />
                        {id ? (
                          <Link href={profileHref(region, id.gameName, id.tagLine)} className="font-medium hover:text-primary">
                            {id.gameName}
                            <span className="text-muted">#{id.tagLine}</span>
                          </Link>
                        ) : (
                          <span className="text-muted">{e.riotId || t("Unknown")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <RankEmblem tier={e.tier} size={22} /> {t(TIER_LABEL[e.tier])}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular text-primary">{e.lp.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-4 w-28 overflow-hidden rounded-md text-[10px] font-semibold leading-4">
                          <span className="bg-win/80 pl-1 text-black" style={{ width: `${wr * 100}%` }}>
                            {e.wins}W
                          </span>
                          <span className="flex-1 bg-loss/70 pr-1 text-right text-black">{e.losses}L</span>
                        </div>
                        <span className={cn("tabular", wrColor(wr))}>{pct(wr)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted tabular">{games}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">{e.topChampionIds?.map((c) => <ChampionIcon key={c} id={c} size={24} rounded="md" />) ?? <span className="text-xs text-dim">—</span>}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {d && d.total > pageSize && <Pagination className="mt-3" page={page} totalPages={Math.ceil(d.total / pageSize)} onChange={setPage} />}
    </div>
  );
}

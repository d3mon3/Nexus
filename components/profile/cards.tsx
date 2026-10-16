"use client";


import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Star, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { asset } from "@/lib/assets";
import { compact, duration, formatKda, kda, kdaColor, pct, rankLabel, ROLE_LABEL, shortDate, TIER_COLOR, timeAgo, winRate, wrColor } from "@/lib/format";
import { useMatches } from "@/lib/queries";
import { profileHref, regionLabel } from "@/lib/regions";
import { QUEUE_FILTERS, RUNES } from "@/lib/static-data";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { LiveGame, MasteryEntry, MatchSummary, PlayerProfile, PlayerStats, RankedEntry, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LpChart } from "../charts/lp-chart";
import { StatRadar } from "../charts/radar-chart";
import { TrendChart } from "../charts/trend-chart";
import { ChampionIcon, RuneIcon, SpellIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { RoleIcon } from "../game/role-icon";
import { MatchRow } from "../matches/match-row";
import { Button } from "../ui/button";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Progress } from "../ui/progress";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Segmented } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";

/* ------------------------------------------------------------- rank card */

export function RankCard({ profile }: { profile: PlayerProfile }) {
  const [queue, setQueue] = useState<"RANKED_SOLO_5x5" | "RANKED_FLEX_SR">("RANKED_SOLO_5x5");
  const entry = profile.ranked.find((r) => r.queue === queue);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t("Current Rank")}
        action={
          <Segmented
            className="[&_button]:py-0.5"
            label={t("Ranked queue")}
            value={queue}
            onChange={setQueue}
            items={[
              { value: "RANKED_SOLO_5x5", label: t("Solo/Duo") },
              { value: "RANKED_FLEX_SR", label: t("Flex") },
            ]}
          />
        }
      />
      <CardBody className="flex flex-1 items-center gap-3 pb-3">
        <RankBlock entry={entry} />
        <div className="hidden h-[92px] w-px bg-line-soft sm:block" />
        <div className="hidden w-[92px] shrink-0 flex-col items-center text-center sm:flex">
          <p className="text-[12px] text-fg/85">{t("Peak Rank")}</p>
          {profile.peak ? (
            <>
              <RankEmblem tier={profile.peak.tier} size={40} />
              <p className="text-[12px] font-semibold leading-tight text-fg">{rankLabel(profile.peak.tier, profile.peak.division)}</p>
              <p className="text-[11px] leading-tight text-muted">{profile.peak.lp}{" " + t("LP")}</p>
              <p className="text-[11px] text-dim">{profile.peak.season}</p>
            </>
          ) : (
            <Tooltip content={t("The Riot API does not expose past-season peaks.")}>
              <p className="text-[11px] text-dim">{t("Not available")}</p>
            </Tooltip>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function RankBlock({ entry }: { entry: RankedEntry | undefined }) {
  if (!entry)
    return (
      <div className="flex flex-1 items-center gap-3">
        <RankEmblem tier={null} size={84} />
        <div>
          <p className="text-lg font-semibold text-fg">{t("Unranked")}</p>
          <p className="text-xs text-muted">{t("No placement in this queue yet.")}</p>
        </div>
      </div>
    );
  const apex = ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(entry.tier);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
        <RankEmblem tier={entry.tier} size={80} />
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold tracking-tight text-fg" style={{ textShadow: `0 0 18px ${TIER_COLOR[entry.tier]}55` }}>
          {rankLabel(entry.tier, entry.division)}
        </p>
        <p className="text-[13px] text-muted tabular">{entry.lp}{" " + t("LP")}</p>
        <Progress className="mt-2" value={apex ? Math.min(1, entry.lp / 1000) : entry.lp / 100} color="#8C6BFF" />
        <p className="mt-2 text-[13px] text-fg/90">
          <span className={cn("font-semibold", wrColor(winRate(entry)))}>{pct(winRate(entry))}</span>{" " + t("Win Rate")}</p>
        <p className="text-[13px] text-muted tabular">
          {entry.wins}W {entry.losses}L
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- recent performance */

export function RecentPerformanceCard({ stats, loading, artKey }: { stats: PlayerStats | undefined; loading: boolean; artKey?: string }) {
  const points = useMemo(() => {
    if (!stats) return [];
    const usesLp = stats.timeline.some((tt) => tt.cumulativeLp !== null);
    let net = 0;
    return stats.timeline.map((tt, i) => {
      net += tt.win ? 1 : -1;
      return { i, value: usesLp ? (tt.cumulativeLp ?? 0) : net, win: tt.win, date: tt.date };
    });
  }, [stats]);
  const usesLp = stats?.timeline.some((tt) => tt.cumulativeLp !== null) ?? false;
  const total = points.at(-1)?.value ?? 0;
  return (
    <Card className="flex flex-col overflow-hidden">
      {artKey && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img src={asset.championSplash(artKey)} alt="" className="art-duotone h-full w-full object-cover object-[60%_25%] opacity-25" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div className="art-tint absolute inset-0 opacity-40" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,17,29,0.75),rgba(12,17,29,0.4)_50%,rgba(12,17,29,0.85))] light:bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.55)_50%,rgba(255,255,255,0.88))]" />
        </div>
      )}
      <CardHeader title={t("Recent Performance")} className="relative" />
      <CardBody className="relative flex-1 pb-2.5">
        {loading || !stats ? (
          <Skeleton className="h-[120px]" />
        ) : stats.games === 0 ? (
          <EmptyState title={t("No recent games")} className="py-4" />
        ) : (
          <>
            <LpChart data={points} height={74} valueLabel={usesLp ? "LP" : "net wins"} />
            <div className="mt-1 flex items-end justify-between">
              <div>
                <p className={cn("text-[19px] font-bold leading-tight tabular", total >= 0 ? "text-win" : "text-loss")}>
                  {total > 0 ? "+" : ""}
                  {total} {usesLp ? t("LP") : ""}
                </p>
                <p className="text-[12px] text-muted">{t("Last {0} games", [stats.games])}{!usesLp && t(" · net wins")}
                </p>
              </div>
              <p className="text-[17px] font-bold tabular">
                <span className="text-win">{stats.wins}W</span> <span className="text-loss">{stats.losses}L</span>
              </p>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------ role distribution */

const ROLE_COLORS = ["#9161FF", "#3D8BFF", "#3D9BFF", "#4FA8FF", "#FF4D78"];

export function RoleDistributionCard({ stats, loading }: { stats: PlayerStats | undefined; loading: boolean }) {
  const roles: { role: Role; share: number; games: number; winRate: number }[] = useMemo(() => {
    const all: Role[] = ["MIDDLE", "TOP", "JUNGLE", "BOTTOM", "UTILITY"];
    const total = stats?.roles.reduce((s, r) => s + r.games, 0) || 1;
    return all
      .map((role) => {
        const r = stats?.roles.find((x) => x.role === role);
        return { role, share: (r?.games ?? 0) / total, games: r?.games ?? 0, winRate: r?.winRate ?? 0 };
      })
      .sort((a, b) => b.share - a.share);
  }, [stats]);
  return (
    <Card className="flex flex-col">
      <CardHeader title={t("Role Distribution")} />
      <CardBody className="flex flex-1 items-end justify-between gap-2 px-5 pb-3">
        {loading || !stats
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[110px] w-6" />)
          : roles.map((r, i) => (
              <Tooltip key={r.role} content={t("{0}: {1} games · {2} WR", [ROLE_LABEL[r.role], r.games, pct(r.winRate)])}>
                <div className="flex flex-col items-center gap-1.5" tabIndex={0}>
                  <div className="relative h-[62px] w-[17px] overflow-hidden rounded-[5px] bg-white/[0.06]">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(4, r.share * 100 * 1.6)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
                      className="absolute inset-x-0 bottom-0 rounded-[5px]"
                      style={{ background: `linear-gradient(180deg, ${ROLE_COLORS[i]}, ${ROLE_COLORS[i]}aa)`, boxShadow: `0 0 12px ${ROLE_COLORS[i]}88` }}
                    />
                  </div>
                  <p className="text-[12px] font-semibold text-fg tabular">{Math.round(r.share * 100)}%</p>
                  <RoleIcon role={r.role} size={17} className="text-muted" />
                </div>
              </Tooltip>
            ))}
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------------- personal stats */

export function PersonalStatsCard({ stats, loading }: { stats: PlayerStats | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader title={t("Personal Stats")} />
      <CardBody className="pb-2">
        {loading || !stats ? <Skeleton className="mx-auto h-[170px] w-[170px] rounded-full" /> : stats.radar.length ? <StatRadar height={158} data={stats.radar} series={[{ key: "value", label: "Score", color: "#9161FF" }]} /> : <EmptyState title={t("Not enough games")} className="py-6" />}
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------- most played */

export function MostPlayedCard({ stats, loading, onShowMore }: { stats: PlayerStats | undefined; loading: boolean; onShowMore: () => void }) {
  const { champion } = useStatic();
  const list = stats?.champions.slice(0, 5) ?? [];
  const maxGames = Math.max(1, ...list.map((c) => c.games));
  return (
    <Card className="flex flex-col">
      <CardHeader title={t("Most Played Champions")} action={stats && <span className="text-[11px] text-dim">{t("last") + " "}{stats.games}{" " + t("games")}</span>} />
      <CardBody className="flex flex-1 flex-col gap-1 px-3">
        {loading || !stats
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[50px]" />)
          : list.map((c) => {
              const info = champion(c.championId);
              const wr = c.wins / c.games;
              return (
                <Link
                  key={c.championId}
                  href={`/champions/${info?.key.toLowerCase() ?? c.championId}`}
                  className="group flex items-center gap-3 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-surface-hover/60"
                >
                  <ChampionIcon id={c.championId} size={42} tooltip={false} className="group-hover:border-primary/60" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-fg">{info?.name ?? c.championId}</p>
                      <p className={cn("text-[13px] font-semibold tabular", c.kda >= 3 ? "text-success" : "text-fg/85")}>{formatKda(c.kda)}{" " + t("KDA")}</p>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-3">
                      <Progress value={c.games / maxGames} className="h-1 max-w-[150px]" />
                      <p className="shrink-0 whitespace-nowrap text-[12px] text-muted tabular">
                        {c.kills.toFixed(1)} / {c.deaths.toFixed(1)} / {c.assists.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="w-[64px] text-right">
                    <p className="text-[14px] font-semibold tabular text-fg">{pct(wr)}</p>
                    <p className="text-[12px] text-muted tabular">{t("{0} games", [c.games])}</p>
                  </div>
                </Link>
              );
            })}
        {stats && stats.champions.length === 0 && <EmptyState title={t("No champions played yet")} className="py-4" />}
        <Button size="sm" variant="secondary" className="mx-auto mt-auto w-[180px]" onClick={onShowMore}>{t("Show More")}</Button>
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------------- recent matches */

export function RecentMatchesCard({ region, puuid, onViewAll }: { region: string; puuid: string | undefined; onViewAll: () => void }) {
  const [queue, setQueue] = useState("all");
  const q = useMatches(region, puuid, { start: 0, count: 5, queue });
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t("Recent Matches")}
        action={
          <div className="flex items-center gap-3">
            <button onClick={onViewAll} className="flex items-center gap-1 text-xs text-muted hover:text-primary">{t("View all") + " "}<ArrowRight className="size-3" />
            </button>
            <Select size="sm" className="w-[130px]" label={t("Queue")} value={queue} onChange={setQueue} options={QUEUE_FILTERS.map((f) => ({ value: f.value, label: t(f.label) }))} align="right" />
          </div>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-1.5 px-3 pb-3">
        {q.isLoading || !puuid ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[54px] rounded-xl" />)
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.data.matches.length ? (
          <EmptyState title={t("No matches in this queue")} />
        ) : (
          q.data.data.matches.map((m: MatchSummary) => <MatchRow key={m.matchId} match={m} region={region} puuid={puuid} variant="compact" />)
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------- live game */

export function LiveStatusCard({ live, loading, puuid, href }: { live: LiveGame | null | undefined; loading: boolean; puuid: string | undefined; href: string }) {
  const me = live?.participants.find((p) => p.puuid === puuid);
  return (
    <Card>
      <CardHeader title={t("Live Game")} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-[110px]" />
        ) : !live || !me ? (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <span className="size-2.5 rounded-full bg-dim" />
            <p className="text-sm text-muted">{t("Not in a game right now")}</p>
            <Link href={href} className="text-xs text-primary hover:underline">{t("Open live game page")}</Link>
          </div>
        ) : (
          <>
            <p className="-mt-1 mb-2 flex items-center gap-2 text-[13px] font-medium text-success">
              <span className="size-2 rounded-full bg-success animate-pulse-glow" />{" " + t("In Game") + " "}{duration(live.gameLengthSec)}
            </p>
            <div className="flex items-center gap-3">
              <ChampionIcon id={me.championId} size={52} />
              <div className="min-w-0 flex-1">
                {me.live ? (
                  <>
                    <p className="text-[15px] font-semibold text-fg tabular">
                      {me.live.kills} / <span className="text-loss">{me.live.deaths}</span> / {me.live.assists}
                    </p>
                    <p className="text-[12px] text-muted tabular">{me.live.cs}{" " + t("CS")}</p>
                    <p className="text-[12px] text-muted tabular">{t("Lvl") + " "}{me.live.level}</p>
                  </>
                ) : (
                  <Tooltip content={t("Spectator data has no KDA. The desktop app reads it from your own client.")}>
                    <p className="text-[12px] text-muted">{t("Live stats unavailable")}</p>
                  </Tooltip>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <SpellIcon id={me.spells[0]} size={22} />
                <SpellIcon id={me.spells[1]} size={22} />
                {me.perks && <RuneIcon id={me.perks.keystone} size={22} />}
                {me.perks && <RuneIcon id={me.perks.subStyle} size={22} />}
              </div>
            </div>
            <Link href={href} className="mt-3 block">
              <Button variant="blue" className="w-full">{t("Spectate")}</Button>
            </Link>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------- spells and runes */

export function SpellsRunesCard({ match, championId }: { match: MatchSummary | undefined; championId: number | undefined }) {
  const { champion } = useStatic();
  const key = championId ? champion(championId)?.key : undefined;
  const keystone = match ? RUNES.find((r) => r.id === match.me.primaryRune) : undefined;
  const tree = keystone ? RUNES.filter((r) => r.style === keystone.style && r.row > 0).slice(0, 3) : [];
  return (
    <Card>
      <CardHeader title={t("Summoner Spells & Runes")} />
      <CardBody>
        {!match ? (
          <Skeleton className="h-12" />
        ) : (
          <div className="flex items-center gap-2">
            <SpellIcon id={match.me.spells[0]} size={34} />
            <SpellIcon id={match.me.spells[1]} size={34} />
            <span className="mx-2 h-8 w-px bg-line" />
            <RuneIcon id={match.me.primaryRune} size={30} />
            {tree.map((r) => (
              <RuneIcon key={r.id} id={r.id} size={24} />
            ))}
            <RuneIcon id={match.me.secondaryStyle} size={24} />
          </div>
        )}
        <Link href={key ? `/builds?champion=${key.toLowerCase()}` : "/builds"} className="mt-3 block">
          <Button size="sm" variant="outline" className="w-full">{t("View Full Runes & Build")}</Button>
        </Link>
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------- mastery */

export function MasteryCard({ mastery }: { mastery: MasteryEntry[] }) {
  const { champion } = useStatic();
  return (
    <Card>
      <CardHeader title={t("Champion Mastery")} />
      <CardBody className="grid grid-cols-3 gap-2 pb-3 sm:grid-cols-5">
        {mastery.slice(0, 5).map((m, i) => {
          const c = champion(m.championId);
          return (
            <Tooltip key={m.championId} content={t("Mastery level {0} · last played {1}", [m.championLevel, timeAgo(m.lastPlayTime)])}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                tabIndex={0}
                className="group relative h-[84px] w-full overflow-hidden rounded-lg border border-line-soft transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_var(--primary-glow)]"
              >
                {c && <img src={asset.championCentered(c.key)} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_25%] transition-transform duration-500 group-hover:scale-110" onError={(e) => (e.currentTarget.style.display = "none")} />}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#3b2a7a,#101729)] -z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-1.5 text-center">
                  <p className="text-[12px] font-semibold text-white drop-shadow">{c?.name}</p>
                  <p className="text-[12px] font-bold text-amber-200 tabular drop-shadow">{compact(m.championPoints).toUpperCase()}</p>
                </div>
              </motion.div>
            </Tooltip>
          );
        })}
        {mastery.length === 0 && <EmptyState title={t("No mastery yet")} className="col-span-full py-4" />}
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------------------- trends */

type TrendMetric = "winrate" | "kda" | "cs" | "damage";

export function TrendsCard({ stats, loading, height = 92 }: { stats: PlayerStats | undefined; loading: boolean; height?: number }) {
  const [metric, setMetric] = useState<TrendMetric>("winrate");
  const data = useMemo(
    () =>
      (stats?.timeline ?? []).map((tt) => ({
        label: shortDate(tt.date),
        winrate: Math.round(tt.rollingWinRate * 100),
        kda: tt.kda,
        cs: tt.csPerMin,
        damage: tt.damagePerMin,
      })),
    [stats],
  );
  const fmt = metric === "winrate" ? (v: number) => `${v}%` : metric === "damage" ? (v: number) => compact(v) : (v: number) => v.toFixed(1);
  return (
    <Card>
      <CardHeader
        title={t("Trends")}
        action={
          <Select
            size="sm"
            className="w-[120px]"
            label={t("Trend metric")}
            value={metric}
            onChange={setMetric}
            align="right"
            options={[
              { value: "winrate", label: t("Win Rate") },
              { value: "kda", label: t("KDA") },
              { value: "cs", label: t("CS / min") },
              { value: "damage", label: t("Damage / min") },
            ]}
          />
        }
      />
      <CardBody>
        {loading || !stats ? <Skeleton style={{ height }} className="w-full" /> : <TrendChart data={data} series={[{ key: metric, label: metric === "winrate" ? "Win rate (last 10)" : metric.toUpperCase(), color: "#9161FF" }]} height={height} format={fmt} endBadge showGrid={false} />}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------- champion pool */

export function ChampionPoolCard({ mastery, onViewAll }: { mastery: MasteryEntry[]; onViewAll: () => void }) {
  return (
    <Card>
      <CardHeader
        title={t("Champion Pool")}
        action={
          <button onClick={onViewAll} className="text-xs font-medium text-primary hover:underline">{t("View All")}</button>
        }
      />
      <CardBody className="grid grid-cols-8 gap-1.5 pb-3 sm:grid-cols-10">
        {mastery.slice(0, 20).map((m) => (
          <ChampionIcon key={m.championId} id={m.championId} size={28} className="w-full! h-auto! aspect-square transition-transform hover:scale-110 hover:border-primary/70" />
        ))}
      </CardBody>
    </Card>
  );
}

/* --------------------------------------------------- favorites & recents */

export function PlayersCard({ kind }: { kind: "favorites" | "recent" }) {
  const { settings, update, toggleFavorite } = useSettings();
  const list: (PlayerRef & { viewedAt?: number })[] = kind === "favorites" ? settings.favorites : settings.recent;
  return (
    <Card>
      <CardHeader
        title={kind === "favorites" ? t("Favorite Players") : t("Recently Viewed")}
        icon={kind === "favorites" ? <Star className="size-4 text-warning" /> : <Clock className="size-4 text-secondary" />}
        action={
          kind === "recent" &&
          list.length > 0 && (
            <button onClick={() => update({ recent: [] })} className="flex items-center gap-1 text-xs text-muted hover:text-danger" aria-label={t("Clear recently viewed")}>
              <Trash2 className="size-3.5" />{" " + t("Clear")}</button>
          )
        }
      />
      <CardBody>
        {list.length === 0 ? (
          <EmptyState icon={<UserRound />} title={kind === "favorites" ? t("No favorites yet") : t("Nothing viewed yet")} description={kind === "favorites" ? t("Star a profile to pin it here.") : t("Profiles you open will appear here.")} className="py-5" />
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {list.slice(0, 8).map((p) => (
              <li key={`${p.gameName}#${p.tagLine}@${p.platform}`} className="group flex items-center gap-2 rounded-lg border border-line-soft bg-white/[0.02] px-2.5 py-2 transition-colors hover:border-primary/40">
                <span className="grid size-8 place-items-center rounded-md bg-primary-soft text-xs font-bold text-primary">{p.gameName.slice(0, 2).toUpperCase()}</span>
                <Link href={profileHref(p.platform, p.gameName, p.tagLine)} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg group-hover:text-primary">
                    {p.gameName}
                    <span className="text-muted">#{p.tagLine}</span>
                  </p>
                  <p className="text-[11px] text-dim">
                    {regionLabel(p.platform)}
                    {p.viewedAt ? ` · ${timeAgo(p.viewedAt)}` : ""}
                  </p>
                </Link>
                {kind === "favorites" && (
                  <button onClick={() => toggleFavorite(p)} aria-label={t("Remove {0} from favorites", [p.gameName])} className="text-warning opacity-70 hover:opacity-100">
                    <Star className="size-4 fill-warning" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

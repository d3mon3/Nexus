"use client";

import { ArrowRight, ChevronRight, Clock, MonitorPlay, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { asset } from "@/lib/assets";
import { duration, formatKda, pct, rankLabel, ROLE_LABEL, shortDate, TIER_LABEL, timeAgo, winRate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useMatches } from "@/lib/queries";
import { profileHref, regionLabel } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { queueName } from "@/lib/static-data";
import type { LiveGame, MatchSummary, PlayerProfile, PlayerStats, RankedEntry, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TrendChart } from "../charts/trend-chart";
import { ChampionIcon, ItemIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { RoleIcon } from "../game/role-icon";
import { Card } from "../ui/card";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";

/** Small pill tabs used in panel headers (Recent Matches filters, Most Played tabs). */
function PillTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {items.map((i) => (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          className={cn(
            "relative rounded-lg px-2.5 py-1 text-[13px] transition",
            value === i.value ? "bg-[rgba(79,145,255,0.25)] font-semibold text-white light:bg-white light:text-primary" : "text-muted hover:text-fg",
          )}
        >
          {i.label}
          {value === i.value && <span className="absolute inset-x-2 -bottom-[2px] h-[2px] rounded-full bg-[#7fb0ff]" />}
        </button>
      ))}
    </div>
  );
}

function PanelTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-3.5">
      <h2 className="text-[17px] font-semibold tracking-tight text-fg">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ game-style banners */

const HERO_TILES = [
  { href: "/builds", title: "Builds & runes", text: "Every champion, every mode — imported for you in champion select.", art: "Ahri", ring: "border-[#7fb0ff]/60", tint: "from-[#13235c]/95 via-[#24409a]/55", title2: "bg-[linear-gradient(180deg,#ffe7a3,#e0a93b)]", btn: "bg-[#4f91ff]" },
  { href: "/tier-list", title: "Tier list", text: "Win, pick and ban rates from real ranked games.", art: "Jinx", ring: "border-[#ff7f9c]/50", tint: "from-[#4a0f2a]/95 via-[#9a2148]/55", title2: "bg-[linear-gradient(180deg,#ff9fb4,#ff486e)]", btn: "bg-[#8365ff]" },
  { href: "/live", title: "Live game", text: "Scout all ten players, then follow your game live.", art: "Yasuo", ring: "border-[#ffc26b]/50", tint: "from-[#3b1d0c]/95 via-[#8a4a17]/55", title2: "bg-[linear-gradient(180deg,#fff,#d8deef)]", btn: "bg-white/25" },
] as const;

/** Three feature banners with champion art (top of the home page). */
export function HeroTiles() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {HERO_TILES.map((h) => (
        <Link key={h.href} href={h.href} className={cn("hero-tile group block h-[137px] border", h.ring)}>
          <img src={asset.championCentered(h.art)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_22%] transition-transform duration-700 group-hover:scale-105" onError={(e) => (e.currentTarget.style.display = "none")} />
          <div className={cn("absolute inset-0 -z-10 bg-gradient-to-r to-transparent", h.tint)} />
          <div className="flex h-full flex-col justify-center px-5">
            <p className={cn("bg-clip-text text-[26px] font-black uppercase italic leading-none tracking-tight text-transparent drop-shadow", h.title2)}>{t(h.title)}</p>
            <p className="mt-2 max-w-[230px] text-[14px] leading-snug text-white/90">{t(h.text)}</p>
          </div>
          <span className={cn("absolute bottom-4 right-4 grid size-9 place-items-center rounded-full text-white shadow-lg transition group-hover:scale-110", h.btn)}>
            <ArrowRight className="size-4" />
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ rank cards */

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-14" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full overflow-visible" aria-hidden style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RankCard({ title, entry, art, color, accent, trend, href, children }: { title: string; entry?: RankedEntry; art?: string; color: string; accent: string; trend: number[]; href: string; children?: React.ReactNode }) {
  return (
    <Card className={cn("relative overflow-hidden p-0", accent)}>
      {art && <img src={asset.championCentered(art)} alt="" aria-hidden className="absolute inset-y-0 right-0 h-full w-[65%] object-cover object-[50%_20%] opacity-35 [mask-image:linear-gradient(90deg,transparent,black_55%)]" onError={(e) => (e.currentTarget.style.display = "none")} />}
      <div className="relative p-4">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-semibold text-fg">{t(title)}</p>
          <Link href={href} className="grid size-7 place-items-center rounded-lg border border-white/15 bg-white/10 text-fg/80 hover:text-fg" aria-label={t(title)}>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {children ?? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <RankEmblem tier={entry?.tier ?? null} size={74} />
              <div className="min-w-0">
                <p className="text-[18px] font-bold text-fg">{entry ? (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(entry.tier) ? t(TIER_LABEL[entry.tier]) : rankLabel(entry.tier, entry.division)) : t("Unranked")}</p>
                {entry && <p className="text-[13.5px] text-muted tabular">{entry.lp} LP</p>}
              </div>
            </div>
            <div className="-mt-3 flex items-end gap-3">
              <div className="min-w-0 flex-1 pl-24">
                <Sparkline values={trend} color={color} />
              </div>
              {entry && (
                <p className="shrink-0 text-right text-[13px] leading-tight text-muted tabular">
                  <span className="block font-semibold text-fg">{pct(winRate(entry))} WR</span>
                  {entry.wins}W {entry.losses}L
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/** Solo/Duo (blue), Flex (pink) and recent form (orange). */
export function RankTiles({ profile, stats, onTab }: { profile: PlayerProfile; stats: PlayerStats | undefined; onTab: (tab: "statistics" | "trends") => void }) {
  const { champion } = useStatic();
  const solo = profile.ranked.find((r) => r.queue === "RANKED_SOLO_5x5");
  const flex = profile.ranked.find((r) => r.queue === "RANKED_FLEX_SR");
  const tl = stats?.timeline ?? [];
  const lp = tl.map((g) => g.cumulativeLp).filter((v): v is number => v !== null);
  const form = tl.map((g) => g.rollingWinRate);
  const arts = profile.mastery.slice(0, 3).map((m) => champion(m.championId)?.key);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <RankCard title="Ranked Solo/Duo" entry={solo} art={arts[0]} color="#4f91ff" accent="" trend={lp.length > 1 ? lp : form} href="?tab=trends" />
      <RankCard title="Ranked Flex" entry={flex} art={arts[1]} color="#ff486e" accent="bg-[linear-gradient(180deg,rgba(80,24,60,0.55),rgba(25,39,77,0.6))]" trend={form.map((v, i) => v + Math.sin(i) * 0.01)} href="?tab=trends" />
      <RankCard title="Recent form" art={arts[2]} color="#ffb339" accent="bg-[linear-gradient(180deg,rgba(80,52,20,0.5),rgba(25,39,77,0.6))]" trend={form} href="?tab=statistics">
        {stats ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={cn("text-[34px] font-bold leading-none tabular", stats.winRate >= 0.5 ? "text-win" : "text-loss")}>{pct(stats.winRate)}</span>
              <span className="text-[13px] text-muted">WR</span>
            </div>
            <p className="mt-1 text-[13px] text-muted tabular">
              {stats.wins}W {stats.losses}L · {formatKda(stats.kda)} KDA · {t("Last {0} games", [stats.games])}
            </p>
            <Sparkline values={form} color="#ffb339" />
          </>
        ) : (
          <Skeleton className="mt-3 h-24" />
        )}
      </RankCard>
    </div>
  );
}

/* ------------------------------------------------------------------ recent matches */

const MATCH_FILTERS = [
  { value: "all", label: "All" },
  { value: "solo", label: "Solo/Duo" },
  { value: "flex", label: "Flex" },
  { value: "aram", label: "ARAM" },
  { value: "arena", label: "Arena" },
] as const;
type MatchFilter = (typeof MATCH_FILTERS)[number]["value"];

/** Five match cards in a row with queue filters. */
export function MatchStrip({ region, puuid, onViewAll }: { region: string; puuid: string | undefined; onViewAll: () => void }) {
  const [filter, setFilter] = useState<MatchFilter>("all");
  const q = useMatches(region, puuid, { start: 0, count: 5, queue: filter });
  const { champion } = useStatic();
  const matches = q.data?.data.matches;
  return (
    <Card>
      <PanelTitle
        action={
          <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none">
            <PillTabs value={filter} onChange={setFilter} items={MATCH_FILTERS.map((f) => ({ value: f.value, label: t(f.label) }))} />
            <button onClick={onViewAll} className="flex items-center gap-1 text-[13.5px] font-medium text-primary hover:underline">
              {t("See all")} <ArrowRight className="size-3.5" />
            </button>
          </div>
        }
      >
        {t("Recent Matches")}
      </PanelTitle>
      <div className="grid gap-2.5 p-3 pt-0.5 sm:grid-cols-3 xl:grid-cols-5">
        {q.isLoading || !matches
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
          : matches.length === 0
            ? <p className="col-span-full py-6 text-center text-sm text-muted">{t("No matches in this queue")}</p>
            : matches.slice(0, 5).map((m) => {
                const c = champion(m.me.championId);
                const remake = m.durationSec < 300;
                const win = m.me.win && !remake;
                return (
                  <div key={m.matchId} className={cn("hero-tile h-[118px] border", remake ? "border-white/15" : win ? "border-[#00d5a4]/35" : "border-[#ff4c70]/40")}>
                    {c && <img src={asset.championCentered(c.key)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_20%] opacity-60" onError={(e) => (e.currentTarget.style.display = "none")} />}
                    <div className={cn("absolute inset-0 -z-10", remake ? "bg-[#202b4f]/85" : win ? "bg-[linear-gradient(110deg,rgba(18,36,86,0.96)_40%,rgba(14,80,98,0.55))]" : "bg-[linear-gradient(110deg,rgba(66,18,44,0.96)_40%,rgba(140,30,60,0.5))]")} />
                    <div className="flex h-full gap-2.5 p-2.5">
                      <ChampionIcon id={m.me.championId} size={40} rounded="full" tooltip={false} className={cn("mt-1 shrink-0 ring-2", win ? "ring-[#00d5a4]/70" : remake ? "ring-white/30" : "ring-[#ff4c70]/70")} />
                      <div className={cn("min-w-0 flex-1 leading-tight", m.lpChange !== null && "pr-7")}>
                        <p className={cn("truncate text-[14px] font-bold", remake ? "text-fg/80" : win ? "text-[#00d5a4]" : "text-[#ff4c70]")}>{remake ? t("Remake") : win ? t("Victory") : t("Defeat")}</p>
                        <p className="text-[15px] font-bold text-white tabular">
                          {m.me.kills} / {m.me.deaths} / {m.me.assists}
                        </p>
                        <p className="truncate text-[11.5px] text-white/75">{t(queueName(m.queueId))}</p>
                        <p className="truncate text-[11px] text-white/60">{timeAgo(m.gameCreation + m.durationSec * 1000)}</p>
                      </div>
                      {m.lpChange !== null && (
                        <span className={cn("absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular", m.lpChange >= 0 ? "bg-[#00d5a4]/90 text-[#062a22]" : "bg-[#ff4c70]/90 text-white")}>
                          {m.lpChange >= 0 ? "+" : ""}
                          {m.lpChange}
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-2.5 bottom-2 flex gap-0.5">
                      {m.me.items.items.slice(0, 6).filter((i) => i > 0).map((id, i) => <ItemIcon key={`${id}-${i}`} id={id} size={20} className="rounded-[4px] ring-1 ring-black/40" />)}
                    </div>
                  </div>
                );
              })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ performance */

const PERF_SERIES = [
  { key: "kda", label: "KDA", color: "#4f91ff" },
  { key: "cs", label: "CS / min", color: "#ff486e" },
  { key: "vision", label: "Vision (÷10)", color: "#ffb339" },
];

/** KDA, CS per minute and vision across recent games. */
export function PerformanceCard({ stats20, stats40 }: { stats20: PlayerStats | undefined; stats40: PlayerStats | undefined }) {
  const [range, setRange] = useState<"20" | "40">("40");
  const stats = range === "20" ? stats20 : stats40;
  const data = useMemo(
    () => (stats?.timeline ?? []).map((g) => ({ label: shortDate(g.date), kda: Number(Math.min(10, g.kda).toFixed(2)), cs: Number(g.csPerMin.toFixed(1)), vision: Number((g.visionScore / 10).toFixed(1)) })),
    [stats],
  );
  return (
    <Card>
      <PanelTitle
        action={
          <Select
            size="sm"
            className="w-[150px]"
            label={t("Range")}
            value={range}
            onChange={setRange}
            align="right"
            options={[
              { value: "20", label: t("Last {0} games", [20]) },
              { value: "40", label: t("Last {0} games", [40]) },
            ]}
          />
        }
      >
        {t("Performance")}
      </PanelTitle>
      <div className="flex flex-wrap gap-4 px-4 text-[12.5px] text-muted">
        {PERF_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} /> {t(s.label)}
          </span>
        ))}
      </div>
      <div className="px-2 pb-3 pt-1">{!stats ? <Skeleton className="m-2 h-[190px]" /> : <TrendChart data={data} series={PERF_SERIES.map((s) => ({ ...s, label: t(s.label) }))} height={200} showGrid format={(v) => v.toFixed(1)} />}</div>
    </Card>
  );
}

/* ------------------------------------------------------------------ most played */

/** Most played champions (or roles) with win rate, KDA and the main role. */
export function MostPlayedPanel({ stats }: { stats: PlayerStats | undefined }) {
  const [tab, setTab] = useState<"champions" | "roles">("champions");
  const { champion } = useStatic();
  const roleOf = (id: number) => (champion(id)?.roles[0] ?? null) as Role | null;
  return (
    <Card>
      <PanelTitle
        action={
          <PillTabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "champions", label: t("Champions") },
              { value: "roles", label: t("Roles") },
            ]}
          />
        }
      >
        {t("Most Played")}
      </PanelTitle>
      <div className="space-y-2 p-3 pt-0.5">
        {!stats
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[58px] rounded-xl" />)
          : tab === "champions"
            ? stats.champions.slice(0, 4).map((c) => {
                const info = champion(c.championId);
                const role = roleOf(c.championId);
                return (
                  <Link key={c.championId} href={`/champions/${info?.key.toLowerCase() ?? ""}`} className="flex items-center gap-3 rounded-xl border border-[#9bb7ff]/15 bg-[rgba(16,28,64,0.55)] px-2.5 py-2 transition hover:border-primary/50 light:border-white light:bg-white/60">
                    <ChampionIcon id={c.championId} size={42} tooltip={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-fg">{info?.name}</p>
                      <p className="text-[12.5px] text-muted">{t("{0} games", [c.games])}</p>
                    </div>
                    <span className={cn("w-16 text-right text-[14px] font-semibold tabular", c.wins / c.games >= 0.5 ? "text-win" : "text-loss")}>{pct(c.wins / c.games)} WR</span>
                    <span className="w-16 text-right text-[14px] text-fg tabular">{formatKda(c.kda)} KDA</span>
                    {role && (
                      <span className="grid size-8 place-items-center rounded-full border border-[#9bb7ff]/30 bg-white/5 text-[#ff6b8f]">
                        <RoleIcon role={role} size={16} />
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                );
              })
            : stats.roles.map((r) => (
                <div key={r.role} className="flex items-center gap-3 rounded-xl border border-[#9bb7ff]/15 bg-[rgba(16,28,64,0.55)] px-3 py-2.5 light:border-white light:bg-white/60">
                  <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                    <RoleIcon role={r.role} size={20} />
                  </span>
                  <p className="flex-1 text-[15px] font-semibold text-fg">{t(ROLE_LABEL[r.role])}</p>
                  <span className="text-[13px] text-muted">{t("{0} games", [r.games])}</span>
                  <span className={cn("w-16 text-right text-[14px] font-semibold tabular", r.winRate >= 0.5 ? "text-win" : "text-loss")}>{pct(r.winRate)} WR</span>
                </div>
              ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ right rail */

/** "Live now": your game (from the spectator API / League client). */
export function LiveNowPanel({ live, loading, puuid, href }: { live: LiveGame | null | undefined; loading: boolean; puuid: string | undefined; href: string }) {
  const me = live?.participants.find((p) => p.puuid === puuid);
  return (
    <Card>
      <PanelTitle
        action={
          <Link href={href} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            {t("Open")} <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {t("Live Game")}
      </PanelTitle>
      <div className="px-3 pb-3">
        {loading ? (
          <Skeleton className="h-[120px]" />
        ) : !live || !me ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 light:bg-white/60">
            <span className="grid size-10 place-items-center rounded-full bg-white/10 text-muted">
              <MonitorPlay className="size-5" />
            </span>
            <div className="text-[13px] leading-snug">
              <p className="font-semibold text-fg">{t("Not in a game right now")}</p>
              <p className="text-muted">{t("Starts by itself when your game loads.")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[#ff4c70]">
              <span className="size-2 rounded-full bg-[#ff4c70] shadow-[0_0_8px_#ff4c70]" /> LIVE · {duration(live.gameLengthSec)}
            </p>
            {live.participants
              .filter((p) => p.teamId === me.teamId)
              .map((p) => (
                <div key={p.riotId} className="flex items-center gap-2.5">
                  <ChampionIcon id={p.championId} size={36} rounded="full" tooltip={false} className={cn(p.puuid === puuid && "ring-2 ring-primary")} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[14px] font-semibold text-fg">{p.riotId.split("#")[0] || t("Hidden player")}</p>
                    <p className="text-[12px] text-muted">{p.ranked ? rankLabel(p.ranked.tier, p.ranked.division) : t("Unranked")}</p>
                  </div>
                  {p.live && (
                    <span className="text-[12px] text-fg tabular">
                      {p.live.kills}/{p.live.deaths}/{p.live.assists}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Recently viewed players as a contact list (like a friends panel). */
export function RecentPlayersPanel() {
  const { settings, update } = useSettings();
  const list = settings.recent;
  return (
    <Card>
      <PanelTitle
        action={
          list.length > 0 && (
            <button onClick={() => update({ recent: [] })} className="text-muted hover:text-danger" aria-label={t("Clear recently viewed")}>
              <Trash2 className="size-4" />
            </button>
          )
        }
      >
        {t("Recently Viewed")} <span className="text-primary">({list.length})</span>
      </PanelTitle>
      <div className="space-y-1 px-2 pb-3">
        {list.length === 0 ? (
          <p className="flex items-center gap-2 px-2 py-4 text-[13px] text-muted">
            <Clock className="size-4" /> {t("Profiles you open will appear here.")}
          </p>
        ) : (
          list.slice(0, 10).map((p, i) => (
            <Link key={`${p.gameName}#${p.tagLine}@${p.platform}`} href={profileHref(p.platform, p.gameName, p.tagLine)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.06] light:hover:bg-white/60">
              <span className={cn("grid size-[38px] shrink-0 place-items-center rounded-full text-[13px] font-bold text-white", ["bg-[linear-gradient(135deg,#4f91ff,#8365ff)]", "bg-[linear-gradient(135deg,#ff486e,#8365ff)]", "bg-[linear-gradient(135deg,#ffb339,#ff486e)]", "bg-[linear-gradient(135deg,#00d5a4,#4f91ff)]"][i % 4])}>
                {p.gameName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[14px] font-semibold text-fg">{p.gameName}</p>
                <p className="text-[12px] text-muted">
                  {regionLabel(p.platform)} · {p.viewedAt ? timeAgo(p.viewedAt) : ""}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

"use client";

import { Activity, Ban, Eye, MonitorPlay, RefreshCw, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { asset } from "@/lib/assets";
import { compact, duration, pct, rankLabel, winRate, wrColor } from "@/lib/format";
import { getBridge, useClientState, useLiveClient, type LiveClientSnapshot } from "@/lib/desktop";
import { useChampionStats, useLiveGame } from "@/lib/queries";
import { parseRiotId, profileHref } from "@/lib/regions";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { DataSource, LiveGame, LiveParticipant, Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GameImage } from "../game/game-image";
import { ChampionIcon, RuneIcon, SpellIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { Button } from "../ui/button";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Select } from "../ui/select";
import { ScoutBoard } from "./scout-board";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState, Unavailable } from "../ui/states";
import { Tooltip } from "../ui/tooltip";

function useTicker(start: number, initial: number) {
  const [sec, setSec] = useState(initial);
  useEffect(() => {
    setSec(initial);
    const base = Date.now() - initial * 1000;
    const t = setInterval(() => setSec(Math.round((Date.now() - (start > 0 ? start : base)) / 1000)), 1000);
    return () => clearInterval(t);
  }, [start, initial]);
  return sec;
}

/** Merges the desktop app's local Live Client Data into a spectator snapshot (own game only). */
function mergeLocal(game: LiveGame, local: LiveClientSnapshot | null, byName: (n: string) => number | undefined): LiveGame {
  if (!local) return game;
  return {
    ...game,
    participants: game.participants.map((p) => {
      const lp = local.players.find((x) => x.riotId.toLowerCase() === p.riotId.toLowerCase()) ?? local.players.find((x) => byName(x.championName) === p.championId);
      const isActive = lp && lp.riotId.toLowerCase() === local.activeRiotId.toLowerCase();
      return lp ? { ...p, live: { kills: lp.kills, deaths: lp.deaths, assists: lp.assists, cs: lp.cs, level: lp.level, items: lp.items, gold: isActive ? local.activeGold : null } } : p;
    }),
    unavailable: game.unavailable.filter((u) => !["KDA", "Items"].includes(u)),
  };
}

export function LivePanel({ region, puuid, player }: { region: string; puuid: string; player: PlayerRef }) {
  const { settings } = useSettings();
  const q = useLiveGame(region, puuid, settings.liveRefreshSec);
  const client = useClientState();
  const isOwnClient = Boolean(client?.connected && client.summoner && client.summoner.puuid === puuid);
  const local = useLiveClient(isOwnClient && client?.phase === "InProgress");
  const { findChampion } = useStatic();

  const game = useMemo(() => (q.data?.data ? mergeLocal(q.data.data, local, (n) => findChampion(n)?.id) : null), [q.data, local, findChampion]);
  const source: DataSource | undefined = local ? "local-client" : q.data?.source;

  if (q.isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-[14px]" />
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_300px]">
          <Skeleton className="h-[380px] rounded-[14px]" />
          <Skeleton className="h-[380px] rounded-[14px]" />
          <Skeleton className="h-[380px] rounded-[14px]" />
        </div>
      </div>
    );
  if (q.error)
    return (
      <Card>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Card>
    );
  if (!game)
    return (
      <Card>
        <EmptyState
          icon={<MonitorPlay />}
          title={`${player.gameName} is not in a game`}
          description="The page checks again automatically. Spectator data appears a few moments after the game loads."
          action={
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              <RefreshCw className={cn(q.isFetching && "animate-spin")} /> Check now
            </Button>
          }
        />
      </Card>
    );
  return <LiveBoard game={game} source={source} note={local ? "KDA, CS and items read from your League client." : q.data?.note} region={region} onRefresh={() => q.refetch()} refreshing={q.isFetching} trackedPuuid={puuid} events={local?.events ?? null} />;
}

function LiveBoard({ game, source, note, region, onRefresh, refreshing, trackedPuuid, events }: { game: LiveGame; source: DataSource | undefined; note?: string; region: string; onRefresh: () => void; refreshing: boolean; trackedPuuid: string; events: LiveClientSnapshot["events"] | null }) {
  const sec = useTicker(game.gameStartTime, game.gameLengthSec);
  const blue = game.participants.filter((p) => p.teamId === 100);
  const red = game.participants.filter((p) => p.teamId === 200);
  const hasLive = game.participants.some((p) => p.live);
  const [view, setView] = useState<"live" | "pro" | "scout">("scout");
  const desktop = Boolean(getBridge()?.spectate);
  const spectate = async () => {
    const res = await getBridge()?.spectate?.(trackedPuuid);
    if (res?.ok) toast.success("Opening spectator in the League client…");
    else toast.error(res?.error ?? "Spectating failed.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="text-[22px] font-bold tracking-tight">Live Game</h2>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <span className="grid size-4 place-items-center rounded-[4px] bg-success/20">
            <span className="size-1.5 rounded-full bg-success animate-pulse-glow" />
          </span>
          Live {duration(Math.max(0, sec))}
        </span>
        <span className="text-sm text-fg/85">
          {game.queueName.replace("Ranked Solo/Duo", "Ranked Solo")} · {game.mapName}
        </span>
        <SourceBadge source={source} note={note} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Tooltip content={desktop ? "Open the spectator in your League client" : "Spectating needs the NEXUS desktop app with League running"} side="bottom">
            <Button size="sm" variant="primary" onClick={spectate} disabled={!desktop}>
              <MonitorPlay /> Spectate
            </Button>
          </Tooltip>
          <Button size="sm" variant={view === "live" ? "secondary" : "outline"} onClick={() => setView("live")} aria-pressed={view === "live"}>
            <Activity /> Live Stats
          </Button>
          <Button size="sm" variant={view === "pro" ? "secondary" : "outline"} onClick={() => setView("pro")} aria-pressed={view === "pro"}>
            <Eye /> Pro View
          </Button>
          <Button size="sm" variant={view === "scout" ? "secondary" : "outline"} onClick={() => setView("scout")} aria-pressed={view === "scout"}>
            <Users /> Scouting
          </Button>
          <Button size="icon-sm" variant="outline" onClick={onRefresh} aria-label="Refresh live game">
            <RefreshCw className={cn(refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {view === "scout" ? (
        <ScoutBoard game={game} region={region} />
      ) : (
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_270px]">
        <TeamTable title="Blue Team" color="blue" players={blue} region={region} view={view === "live" ? "live" : "pro"} trackedPuuid={trackedPuuid} />
        <TeamTable title="Red Team" color="red" players={red} region={region} view={view === "live" ? "live" : "pro"} trackedPuuid={trackedPuuid} />
        <ObjectivesCard events={events} gameSec={sec} />
      </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[1fr_270px]">
        <MatchupsCard game={game} />
        <BansCard game={game} />
      </div>

      {game.unavailable.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {game.unavailable.map((u) => (
            <Unavailable key={u} label={u} reason={hasLive ? "not provided for other players" : "not provided by the Spectator API"} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamTable({ title, color, players, region, view, trackedPuuid }: { title: string; color: "blue" | "red"; players: LiveParticipant[]; region: string; view: "live" | "pro"; trackedPuuid: string }) {
  const [sortBy, setSortBy] = useState<"role" | "kda" | "cs">("role");
  const live = players.some((p) => p.live);
  const tot = (k: "kills" | "deaths" | "assists") => players.reduce((s, p) => s + (p.live?.[k] ?? 0), 0);
  const rows = useMemo(() => {
    if (sortBy === "role" || !live) return players;
    const v = (p: LiveParticipant) => (sortBy === "cs" ? (p.live?.cs ?? 0) : ((p.live?.kills ?? 0) + (p.live?.assists ?? 0)) / Math.max(1, p.live?.deaths ?? 0));
    return [...players].sort((a, b) => v(b) - v(a));
  }, [players, sortBy, live]);
  const accent = color === "blue" ? "text-secondary" : "text-loss";
  const showLive = view === "live" && live;
  return (
    <Card className="overflow-hidden">
      <div className={cn("grid items-center gap-2 border-b border-line-soft px-3 py-2.5 text-[12px] text-muted", showLive ? "grid-cols-[1fr_62px_40px_48px_70px]" : "grid-cols-[1fr_120px_70px]")}>
        <span className="flex items-center gap-3">
          <span className={cn("text-[14px] font-semibold", accent)}>{title}</span>
          {live && (
            <span className="font-semibold tabular">
              <span className="text-secondary">{tot("kills")}</span> / <span className="text-loss">{tot("deaths")}</span> / {tot("assists")}
            </span>
          )}
        </span>
        {showLive ? (
          <>
            <span className="text-center">KDA</span>
            <span className="text-center">CS</span>
            <span className="text-center">Gold</span>
          </>
        ) : (
          <>
            <span>Rank</span>
            <span className="text-center">Win rate</span>
          </>
        )}
        {showLive ? (
          <Select
            size="sm"
            className="[&>button]:h-7 [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-1 [&>button]:text-secondary"
            label={`${title} sort`}
            value={sortBy}
            onChange={setSortBy}
            align="right"
            options={[
              { value: "role", label: "Runes" },
              { value: "kda", label: "By KDA" },
              { value: "cs", label: "By CS" },
            ]}
          />
        ) : null}
      </div>
      <div className="divide-y divide-line-soft/50">
        {rows.map((p) => {
          const id = parseRiotId(p.riotId);
          const me = p.puuid === trackedPuuid;
          return (
            <div key={`${p.championId}-${p.riotId}`} className={cn("grid items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-hover/40", showLive ? "grid-cols-[1fr_62px_40px_48px_70px]" : "grid-cols-[1fr_120px_70px]", me && "bg-primary-soft")}>
              <div className="flex min-w-0 items-center gap-2.5">
                <ChampionIcon id={p.championId} size={38} rounded="full" className={cn("border-2", color === "blue" ? "border-secondary/60" : "border-loss/60")} />
                <div className="min-w-0">
                  {id ? (
                    <Link href={profileHref(region, id.gameName, id.tagLine)} className="block truncate text-[13px] font-medium text-fg hover:text-primary">
                      {id.gameName}
                    </Link>
                  ) : (
                    <p className="truncate text-[13px] text-muted">{p.riotId}</p>
                  )}
                  {showLive && p.ranked && <p className="truncate text-[10px] text-muted">{rankLabel(p.ranked.tier, p.ranked.division)}</p>}
                </div>
              </div>
              {showLive ? (
                <>
                  <span className="text-center text-[13px] tabular">
                    {p.live ? (
                      <>
                        {p.live.kills} / <span className="text-loss">{p.live.deaths}</span> / {p.live.assists}
                      </>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </span>
                  <span className="text-center text-[13px] tabular text-fg/90">{p.live?.cs ?? "—"}</span>
                  <span className="text-center text-[13px] tabular text-fg/90">
                    {p.live?.gold != null ? (
                      compact(p.live.gold)
                    ) : (
                      <Tooltip content="Gold is only available for your own champion">
                        <span className="text-dim">—</span>
                      </Tooltip>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
                    {p.ranked ? (
                      <>
                        <RankEmblem tier={p.ranked.tier} size={18} />
                        <span className="truncate">
                          {rankLabel(p.ranked.tier, p.ranked.division)} · {p.ranked.lp}
                        </span>
                      </>
                    ) : (
                      "Unranked"
                    )}
                  </span>
                  <span className={cn("text-center text-[12px] tabular", p.ranked ? wrColor(winRate(p.ranked)) : "text-dim")}>{p.ranked ? `${pct(winRate(p.ranked))} (${p.ranked.wins + p.ranked.losses})` : "—"}</span>
                </>
              )}
              <div className="flex items-center justify-end gap-1">
                <SpellIcon id={p.spells[0]} size={20} />
                <SpellIcon id={p.spells[1]} size={20} />
                {p.perks && <RuneIcon id={p.perks.keystone} size={20} />}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ObjectivesCard({ events, gameSec }: { events: LiveClientSnapshot["events"] | null; gameSec: number }) {
  const last = (name: string) => events?.filter((e) => e.name === name).at(-1);
  const timer = (name: string, first: number, respawn: number) => {
    if (!events) return null;
    const e = last(name);
    const next = e ? e.time + respawn : first;
    return Math.max(0, next - gameSec);
  };
  // Standard Summoner's Rift timings; adjust here if Riot changes them.
  const rows = [
    { label: "Dragon", value: timer("DragonKill", 300, 300), color: "text-loss" },
    { label: "Rift Herald", value: last("HeraldKill") || gameSec > 1185 ? -1 : timer("HeraldKill", 840, 0), color: "text-primary" },
    { label: "Baron", value: timer("BaronKill", 1200, 360), color: "text-fg" },
  ];
  return (
    <Card className="p-3">
      <div className="relative overflow-hidden rounded-xl border border-line-soft">
        <GameImage src={asset.map(11)} alt="Summoner's Rift minimap" className="aspect-square w-full brightness-[0.62] contrast-125 saturate-[0.65]" />
        <div className="pointer-events-none absolute inset-0 bg-[#1b2260]/45 mix-blend-multiply" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(69,140,255,0.25),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(255,77,120,0.25),transparent_45%)]" />
      </div>
      <p className="mb-2 mt-3 text-[13.5px] font-semibold">Objective Timers</p>
      {events ? (
        <>
          <div className="grid grid-cols-3 text-center">
            {rows.map((r) => (
              <div key={r.label}>
                <p className="text-[11px] text-muted">{r.label}</p>
                <p className={cn("text-[15px] font-bold tabular", r.color)}>{r.value === null ? "—" : r.value < 0 ? "—" : r.value === 0 ? "Up" : duration(r.value)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-dim">Estimated from your client&apos;s event feed.</p>
        </>
      ) : (
        <div className="grid grid-cols-3 text-center">
          {rows.map((r) => (
            <Tooltip key={r.label} content="Objective timers are not provided by the Spectator API. The desktop app tracks them from your own client.">
              <div tabIndex={0}>
                <p className="text-[11px] text-muted">{r.label}</p>
                <p className="text-[15px] font-bold text-dim">—</p>
              </div>
            </Tooltip>
          ))}
        </div>
      )}
    </Card>
  );
}

function BansCard({ game }: { game: LiveGame }) {
  return (
    <Card>
      <CardHeader title="Bans" icon={<Ban className="size-4 text-loss" />} />
      <CardBody className="space-y-2">
        {([100, 200] as const).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <span className={cn("w-10 text-xs font-semibold", t === 100 ? "text-secondary" : "text-loss")}>{t === 100 ? "Blue" : "Red"}</span>
            {game.bans.filter((b) => b.teamId === t).map((b, i) => (
              <ChampionIcon key={i} id={b.championId} size={28} className="grayscale" />
            ))}
            {game.bans.filter((b) => b.teamId === t).length === 0 && <span className="text-xs text-dim">No bans</span>}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function MatchupsCard({ game }: { game: LiveGame }) {
  const stats = useChampionStats({});
  const { champion } = useStatic();
  const blue = game.participants.filter((p) => p.teamId === 100);
  const red = game.participants.filter((p) => p.teamId === 200);
  const wrOf = (id: number, role: Role) => stats.data?.data.rows.find((r) => r.championId === id && r.role === role) ?? stats.data?.data.rows.find((r) => r.championId === id);
  return (
    <Card>
      <CardHeader title="Lane Matchups" icon={<Swords className="size-4 text-primary" />} action={<SourceBadge source={stats.data?.source} note="Champion win rates for the current patch." />} />
      <CardBody className="grid gap-2 md:grid-cols-5">
        {ROLES.map((role, i) => {
          const a = blue[i];
          const b = red[i];
          if (!a || !b) return null;
          const wa = wrOf(a.championId, role);
          const wb = wrOf(b.championId, role);
          const diff = wa && wb ? wa.winRate - wb.winRate : 0;
          return (
            <div key={role} className="rounded-xl border border-line-soft bg-white/[0.02] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-dim">
                <RoleIcon role={role} size={14} /> {role === "UTILITY" ? "Support" : role === "BOTTOM" ? "Bot" : role.toLowerCase()}
              </p>
              <div className="flex items-center justify-between">
                <ChampionIcon id={a.championId} size={34} />
                <span className={cn("text-xs font-semibold tabular", diff > 0.005 ? "text-secondary" : diff < -0.005 ? "text-loss" : "text-muted")}>{diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}%</span>
                <ChampionIcon id={b.championId} size={34} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] tabular text-muted">
                <span>{wa ? pct(wa.winRate, 1) : "—"}</span>
                <span>{wb ? pct(wb.winRate, 1) : "—"}</span>
              </div>
              <p className="sr-only">
                {champion(a.championId)?.name} versus {champion(b.championId)?.name}
              </p>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

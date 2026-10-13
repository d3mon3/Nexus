"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Award, Clock, Crown, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { getBridge, useClientState } from "@/lib/desktop";
import { formatKda, pct, ROLE_LABEL } from "@/lib/format";
import { ratePlayers, type PlayerRating } from "@/lib/performance";
import { t } from "@/lib/i18n";
import { useMatch, useMatches, usePlayerStats, useProfile } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { queueName } from "@/lib/static-data";
import type { MatchDetail, ParticipantSummary, PlayerStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/states";

const FRESH_MS = 45 * 60_000;

/**
 * Post-game summary: result, LP change, and how the game compared with the lane opponent
 * and with the player's own recent average. Opened by the desktop app when a game ends.
 */
export function PostGameView() {
  const { settings } = useSettings();
  const client = useClientState();
  const s = client?.summoner;
  const player: PlayerRef | null = s?.gameName ? { gameName: s.gameName, tagLine: s.tagLine, platform: resolveRegion(s.platform ?? "")?.platform ?? settings.region } : settings.myAccount;
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;
  const region = player?.platform;
  const [endedAt, setEndedAt] = useState<number | null>(null);
  useEffect(() => {
    getBridge()?.getLastGame?.().then((g) => setEndedAt(g?.endedAt ?? null)).catch(() => undefined);
  }, []);

  // Riot publishes the match a minute or two after the game; poll until it shows up.
  const [waiting, setWaiting] = useState(true);
  const latest = useMatches(region, puuid, { start: 0, count: 1, queue: "all" });
  const top = latest.data?.data.matches[0];
  const isFresh = top ? top.gameCreation + top.durationSec * 1000 > (endedAt ?? Date.now()) - FRESH_MS : false;
  const refetchRef = useRef(latest.refetch);
  refetchRef.current = latest.refetch;
  useEffect(() => {
    if (!puuid || isFresh || !waiting) return;
    const id = setInterval(() => refetchRef.current(), 20_000);
    const stop = setTimeout(() => setWaiting(false), 6 * 60_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [puuid, isFresh, waiting]);

  // Once the match exists, refresh the profile so the LP change can be computed.
  const qc = useQueryClient();
  const refreshed = useRef<string | null>(null);
  useEffect(() => {
    if (!top || !isFresh || !puuid || !region || refreshed.current === top.matchId) return;
    refreshed.current = top.matchId;
    api
      .refresh(puuid, region)
      .then(() => qc.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes(puuid) }))
      .catch(() => undefined);
  }, [top, isFresh, puuid, region, qc]);

  const match = useMatch(region ?? "", isFresh && top ? top.matchId : null, puuid);
  const avg = usePlayerStats(region, puuid, 20);

  if (!player) return <Card><EmptyState title={t("No account yet")} description={t("Set your Riot ID in Settings or open the League client.")} /></Card>;
  if (profile.isLoading || latest.isLoading) return <Skeleton className="h-[420px] rounded-[14px]" />;
  if (!top || !isFresh)
    return (
      <Card>
        <EmptyState
          icon={<Clock />}
          title={waiting ? t("Waiting for Riot to publish your game…") : t("No recent game found")}
          description={waiting ? t("This usually takes 1–2 minutes after the game ends. The page updates by itself.") : t("Your last game will appear here after you finish one.")}
        />
      </Card>
    );
  const detail = match.data?.data;
  return detail ? <Summary m={detail} puuid={puuid!} avg={avg.data?.data} lpChange={top.lpChange} /> : <Skeleton className="h-[420px] rounded-[14px]" />;
}

interface Metric {
  key: string;
  label: string;
  you: number;
  opp: number | null;
  avg: number | null;
  fmt: (v: number) => string;
  /** Lower is better (deaths). */
  invert?: boolean;
}

function Summary({ m, puuid, avg, lpChange }: { m: MatchDetail; puuid: string; avg: PlayerStats | undefined; lpChange: number | null }) {
  const me = m.participants.find((p) => p.puuid === puuid)!;
  const opp = me.role ? m.participants.find((p) => p.teamId !== me.teamId && p.role === me.role) ?? null : null;
  const min = Math.max(1, m.durationSec / 60);
  const per = (p: ParticipantSummary | null, f: (p: ParticipantSummary) => number) => (p ? f(p) : null);
  const metrics: Metric[] = useMemo(
    () => [
      { key: "cs", label: "CS / min", you: me.cs / min, opp: per(opp, (p) => p.cs / min), avg: avg?.csPerMin ?? null, fmt: (v) => v.toFixed(1) },
      { key: "dmg", label: "Damage / min", you: me.damageToChampions / min, opp: per(opp, (p) => p.damageToChampions / min), avg: avg?.damagePerMin ?? null, fmt: (v) => String(Math.round(v)) },
      { key: "vision", label: "Vision / min", you: me.visionScore / min, opp: per(opp, (p) => p.visionScore / min), avg: avg?.visionPerMin ?? null, fmt: (v) => v.toFixed(2) },
      { key: "gold", label: "Gold", you: me.gold, opp: per(opp, (p) => p.gold), avg: null, fmt: (v) => `${(v / 1000).toFixed(1)}k` },
      { key: "deaths", label: "Deaths", you: me.deaths, opp: per(opp, (p) => p.deaths), avg: avg?.avgDeaths ?? null, fmt: (v) => v.toFixed(v % 1 ? 1 : 0), invert: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m.matchId, avg],
  );
  const better = (x: Metric) => (x.opp == null ? null : x.invert ? x.you <= x.opp : x.you >= x.opp);
  const won = metrics.filter((x) => better(x) === true).length;
  const compared = metrics.filter((x) => x.opp != null).length;
  const grade = compared ? (won / compared >= 0.8 ? "S" : won / compared >= 0.6 ? "A" : won / compared >= 0.4 ? "B" : won / compared >= 0.2 ? "C" : "D") : null;

  return (
    <div className="space-y-3">
      <Card className={cn("glow-border overflow-hidden p-0")}>
        <div className={cn("flex flex-wrap items-center gap-4 p-5", me.win ? "bg-win/8" : "bg-loss/8")}>
          <ChampionIcon id={me.championId} size={68} rounded="full" ring="primary" tooltip={false} />
          <div className="min-w-0">
            <p className={cn("text-2xl font-bold", me.win ? "text-win" : "text-loss")}>{me.win ? t("Victory") : t("Defeat")}</p>
            <p className="text-sm text-muted">
              {me.championName} · {t(queueName(m.queueId))} · {Math.floor(m.durationSec / 60)}:{String(m.durationSec % 60).padStart(2, "0")}
              {me.role ? ` · ${t(ROLE_LABEL[me.role])}` : ""}
            </p>
            <p className="mt-1 text-lg font-semibold tabular">
              {me.kills} / <span className="text-loss">{me.deaths}</span> / {me.assists} <span className="text-sm font-normal text-muted">· {formatKda((me.kills + me.assists) / Math.max(1, me.deaths))} KDA</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="grid min-w-[86px] place-items-center rounded-xl border border-line bg-surface-2/70 px-4 py-2">
              <span className={cn("text-xl font-bold tabular", lpChange == null ? "text-muted" : lpChange >= 0 ? "text-win" : "text-loss")}>{lpChange == null ? "—" : `${lpChange > 0 ? "+" : ""}${lpChange} LP`}</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">{t("LP change")}</span>
            </div>
            {grade && (
              <div className="grid min-w-[86px] place-items-center rounded-xl border border-primary/50 bg-primary-soft px-4 py-2">
                <span className="text-xl font-bold text-primary">{grade}</span>
                <span className="text-[10px] uppercase tracking-wider text-dim">{t("Lane rating")}</span>
              </div>
            )}
          </div>
        </div>
        {lpChange == null && m.queueId === 420 && <p className="px-5 pb-3 pt-2 text-xs text-dim">{t("LP change appears after the next profile refresh when it can be measured reliably.")}</p>}
      </Card>

      <Card>
        <CardHeader
          title={opp ? t("You vs {0}", [opp.championName]) : t("Your game")}
          icon={<Award className="size-4 text-warning" />}
          action={grade && <span className="text-xs text-muted">{t("Better than your lane opponent in {0} of {1}", [won, compared])}</span>}
        />
        <div className="grid gap-2 p-3 pt-0 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((x) => {
            const b = better(x);
            const delta = x.avg != null && x.avg > 0 ? (x.you - x.avg) / x.avg : null;
            const up = delta != null && (x.invert ? delta < -0.05 : delta > 0.05);
            const down = delta != null && (x.invert ? delta > 0.05 : delta < -0.05);
            return (
              <div key={x.key} className={cn("rounded-xl border p-3", b == null ? "border-line-soft" : b ? "border-win/35 bg-win/6" : "border-loss/35 bg-loss/6")}>
                <p className="text-[11px] uppercase tracking-wider text-dim">{t(x.label)}</p>
                <p className="mt-1 text-xl font-bold tabular">{x.fmt(x.you)}</p>
                {x.opp != null && <p className="text-xs text-muted tabular">{t("Opponent {0}", [x.fmt(x.opp)])}</p>}
                {x.avg != null && (
                  <p className={cn("mt-1 flex items-center gap-1 text-xs tabular", up ? "text-win" : down ? "text-loss" : "text-muted")}>
                    {up ? <ArrowUp className="size-3" /> : down ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
                    {t("Your average {0}", [x.fmt(x.avg)])}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 px-3 pb-3">
          <Link href="/matches">
            <Button size="sm" variant="secondary">{t("Full match history")}</Button>
          </Link>
          <Link href="/statistics">
            <Button size="sm" variant="ghost">{t("What to improve")}</Button>
          </Link>
          {avg && <span className="ml-auto self-center text-[11px] text-dim">{t("Average from your last {0} games · win rate {1}", [avg.games, pct(avg.winRate)])}</span>}
        </div>
      </Card>

      <AllPlayers m={m} puuid={puuid} />
    </div>
  );
}

const GRADE_TONE: Record<PlayerRating["grade"], string> = {
  "S+": "text-[#f2b544]",
  S: "text-[#f2b544]",
  A: "text-success",
  B: "text-secondary",
  C: "text-muted",
  D: "text-loss",
};

/** All ten players rated against each other, with MVP and ACE. */
function AllPlayers({ m, puuid }: { m: MatchDetail; puuid: string }) {
  const ratings = useMemo(() => new Map(ratePlayers(m.participants, m.durationSec).map((r) => [r.puuid, r])), [m]);
  const teams = [100, 200] as const;
  return (
    <Card>
      <CardHeader title={t("Player ratings")} icon={<Crown className="size-4 text-warning" />} action={<span className="text-xs text-muted">{t("Compared with the other players in this game")}</span>} />
      <div className="grid gap-3 p-3 pt-0 lg:grid-cols-2">
        {teams.map((team) => {
          const players = m.participants.filter((p) => p.teamId === team);
          const won = players[0]?.win;
          return (
            <div key={team} className="rounded-xl border border-line-soft">
              <p className={cn("border-b border-line-soft px-3 py-1.5 text-xs font-semibold", won ? "text-win" : "text-loss")}>{won ? t("Victory") : t("Defeat")}</p>
              <ul>
                {players.map((p) => {
                  const r = ratings.get(p.puuid);
                  return (
                    <li key={p.puuid} className={cn("flex items-center gap-2.5 px-3 py-1.5", p.puuid === puuid && "bg-primary-soft")}>
                      <ChampionIcon id={p.championId} size={28} rounded="md" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{p.riotId.split("#")[0] || p.championName}</span>
                      <span className="w-20 text-right text-xs text-muted tabular">
                        {p.kills}/{p.deaths}/{p.assists}
                      </span>
                      {r?.badge ? (
                        <span className={cn("w-11 rounded px-1 py-0.5 text-center text-[10px] font-bold", r.badge === "MVP" ? "bg-[#f2b544] text-[#070a13]" : "bg-secondary text-[#070a13]")}>{r.badge}</span>
                      ) : (
                        <span className="w-11 text-center text-[11px] text-dim tabular">#{r?.rank}</span>
                      )}
                      <span className={cn("w-8 text-right text-sm font-bold tabular", r ? GRADE_TONE[r.grade] : "")}>{r?.grade}</span>
                      <span className="w-8 text-right text-xs text-muted tabular">{r?.score.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

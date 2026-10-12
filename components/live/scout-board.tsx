"use client";

import { compact, pct, rankLabel, ROLE_LABEL, TIER_LABEL, winRate } from "@/lib/format";
import { useScoutPlayer } from "@/lib/queries";
import { useSettings } from "@/lib/settings";
import type { LiveGame, LiveParticipant, Role, ScoutPlayer, ScoutTag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon, ProfileIcon, RuneIcon, SpellIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { RoleIcon } from "../game/role-icon";
import { Skeleton } from "../ui/skeleton";
import { Tooltip } from "../ui/tooltip";

/**
 * Loading-screen scouting board (Porofessor-style): one card per player, ally team on
 * top, enemies below. Each card loads independently so the board fills in progressively.
 */
export function ScoutBoard({ game, region, compactMode = false, className }: { game: LiveGame; region: string; compactMode?: boolean; className?: string }) {
  const { settings } = useSettings();
  const teams = [100, 200] as const;
  return (
    <div className={cn("space-y-3", className)}>
      {teams.map((t) => (
        <div key={t} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {game.participants
            .filter((p) => p.teamId === t)
            .map((p) => (
              <ScoutCard key={`${p.puuid}-${p.championId}`} participant={p} region={region} depth={settings.scoutDepth} compactMode={compactMode} />
            ))}
        </div>
      ))}
    </div>
  );
}

function ScoutCard({ participant, region, depth, compactMode }: { participant: LiveParticipant; region: string; depth: number; compactMode: boolean }) {
  const q = useScoutPlayer(region, participant, depth);
  const s = q.data?.data;
  const blue = participant.teamId === 100;
  // Players with Riot's privacy option (no puuid) are never looked up or de-anonymised.
  const hidden = !participant.puuid;
  const [name, tag] = hidden ? ["Hidden player", ""] : participant.riotId.split("#");

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line-soft bg-[#0b0f1a]/95 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.9)] backdrop-blur", compactMode && "text-[0.92em]")}>
      {/* header */}
      <div className={cn("flex items-center gap-2.5 border-b-2 px-3 py-2", blue ? "border-secondary/80" : "border-loss/80")}>
        {s ? (
          <ProfileIcon id={s.profileIconId} size={34} className="rounded-lg" />
        ) : hidden ? (
          <ChampionIcon id={participant.championId} size={34} className="rounded-lg" />
        ) : (
          <Skeleton className="size-[34px] rounded-lg" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-fg" title={participant.riotId}>
            {name}
            {tag && <span className="text-muted">#{tag}</span>}
          </p>
          <p className="text-[11px] font-medium text-muted">{s ? `Level ${s.summonerLevel}` : " "}</p>
        </div>
        {s?.tags.some((t) => t.label === "Few recent games") && <span className="text-[10px] text-dim">new</span>}
      </div>

      {hidden ? (
        <p className="p-3 text-xs leading-relaxed text-muted">This player uses Riot&apos;s privacy option, so their profile isn&apos;t shown.</p>
      ) : q.error ? (
        <p className="p-3 text-xs text-loss">{(q.error as Error).message || "Couldn't load this player."}</p>
      ) : q.isLoading || !s ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-16" />
          <Skeleton className="h-6" />
        </div>
      ) : (
        <>
          {/* champion + rank */}
          <div className="grid grid-cols-2 divide-x divide-line-soft border-b border-line-soft">
            <ChampionCell s={s} />
            <RankCell s={s} />
          </div>
          {/* rings */}
          <div className="grid grid-cols-3 divide-x divide-line-soft border-b border-line-soft py-2.5">
            <Ring label="12 Hr" games={s.last12h.games} wins={s.last12h.wins} />
            <RoleRing role={s.mainRole} />
            <Ring label="30 Day" games={s.last30d.games} wins={s.last30d.wins} analysed={s.last30d.analysed} />
          </div>
          {/* tags */}
          <div className="flex min-h-[54px] flex-wrap content-start justify-center gap-1.5 p-2.5">
            {s.tags.length === 0 && <span className="text-[11px] text-dim">No notable traits</span>}
            {s.tags.map((t) => (
              <Tag key={t.label} tag={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function kdaTone(k: number, d: number, a: number) {
  const r = d === 0 ? k + a : (k + a) / d;
  return r >= 3 ? "text-success" : r < 2 ? "text-loss" : "text-warning";
}

function ChampionCell({ s }: { s: ScoutPlayer }) {
  const c = s.champion;
  return (
    <div className="px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col gap-0.5">
          {s.keystone ? <RuneIcon id={s.keystone} size={16} /> : <span className="size-4" />}
          {s.subStyle ? <RuneIcon id={s.subStyle} size={14} className="ml-px" /> : null}
        </div>
        <ChampionIcon id={s.championId} size={36} rounded="md" />
        <div className="leading-tight">
          <div className="flex gap-0.5">
            <SpellIcon id={s.spells[0]} size={14} />
            <SpellIcon id={s.spells[1]} size={14} />
          </div>
          <Tooltip content={s.mastery ? `${s.mastery.points.toLocaleString()} mastery points` : "No mastery data"}>
            <span className="text-[11px] font-bold text-fg">LVL {s.mastery?.level ?? "–"}</span>
          </Tooltip>
        </div>
      </div>
      {c ? (
        <>
          <p className={cn("mt-1.5 text-[13px] font-bold tabular", kdaTone(c.kills, c.deaths, c.assists))}>
            {c.kills.toFixed(1)} <span className="text-dim">/</span> <span className="text-loss">{c.deaths.toFixed(1)}</span> <span className="text-dim">/</span> {c.assists.toFixed(1)}
          </p>
          <p className="text-[11px] text-muted tabular">
            {pct(c.wins / c.games)} ({c.wins}/{c.games})
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[11px] text-dim">No recent games on this champion</p>
      )}
      <p className="text-[11px] text-muted tabular">{s.mastery ? `${compact(s.mastery.points)} pts` : " "}</p>
    </div>
  );
}

function RankCell({ s }: { s: ScoutPlayer }) {
  const r = s.ranked;
  return (
    <div className="flex flex-col items-center px-2 py-2 text-center">
      <RankEmblem tier={r?.tier ?? null} size={40} />
      {r ? (
        <>
          <p className="text-[11.5px] font-semibold leading-tight text-fg">
            {["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? TIER_LABEL[r.tier] : rankLabel(r.tier, r.division)} <span className="font-normal text-muted">{r.lp} LP</span>
          </p>
          <p className="text-[11px] text-muted tabular">
            {pct(winRate(r))} ({r.wins}/{r.wins + r.losses})
          </p>
          <p className="text-[11px] text-muted tabular">Rank: {s.ladderRank ? `#${s.ladderRank.toLocaleString("en-US")}` : "-"}</p>
        </>
      ) : (
        <p className="text-[11px] text-dim">Unranked</p>
      )}
    </div>
  );
}

function ringColor(wr: number | null, games: number) {
  if (!games || wr === null) return "#3a4058";
  if (wr >= 0.55) return "#2fcf98";
  if (wr >= 0.45) return "#f2b544";
  return "#f54c7c";
}

function Circle({ value, color, children }: { value: number; color: string; children: React.ReactNode }) {
  const r = 21;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[52px]">
      <svg viewBox="0 0 52 52" className="size-full -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * Math.max(0.0001, value)} ${c}`} style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">{children}</div>
    </div>
  );
}

function Ring({ label, games, wins, analysed }: { label: string; games: number; wins: number | null; analysed?: number }) {
  const base = analysed ?? games;
  const wr = wins !== null && base > 0 ? wins / base : null;
  const color = ringColor(wr, games);
  return (
    <Tooltip content={analysed !== undefined && analysed < games ? `Win rate from the ${analysed} most recent of ${games} games` : undefined}>
      <div className="flex flex-col items-center gap-1" tabIndex={0}>
        <Circle value={wr ?? 0} color={color}>
          <span className="text-[11px] font-bold tabular" style={{ color: games ? color : "#8285a6" }}>
            {wr === null ? (games ? "?" : "0%") : pct(wr, wr === 1 || wr === 0 ? 0 : 1)}
          </span>
          <span className="mt-0.5 text-[8.5px] text-muted">{label}</span>
        </Circle>
        <p className="text-[11px] font-semibold text-fg tabular">{games} Games</p>
        <p className="text-[10.5px] tabular" style={{ color: games ? color : "#8285a6" }}>
          {analysed !== undefined && analysed < games ? `(${wins ?? 0}/${analysed} Wins)` : `(${wins ?? "?"} Wins)`}
        </p>
      </div>
    </Tooltip>
  );
}

function RoleRing({ role }: { role: Role | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Circle value={role ? 1 : 0} color={role ? "#2fcf98" : "#3a4058"}>
        {role ? <RoleIcon role={role} size={22} className="text-fg" /> : <span className="text-[10px] text-dim">?</span>}
      </Circle>
      <p className="text-[11px] font-semibold text-fg">Main Role:</p>
      <p className="text-[10.5px] text-muted">{role ? ROLE_LABEL[role] : "Unknown"}</p>
    </div>
  );
}

const TAG_STYLE: Record<ScoutTag["tone"], string> = {
  good: "border-success/60 text-success bg-success/8",
  bad: "border-loss/60 text-loss bg-loss/8",
  neutral: "border-warning/60 text-warning bg-warning/8",
  info: "border-secondary/60 text-secondary bg-secondary/8",
};

function Tag({ tag }: { tag: ScoutTag }) {
  return <span className={cn("rounded-[5px] border px-1.5 py-0.5 text-[11px] font-medium leading-tight", TAG_STYLE[tag.tone])}>{tag.label}</span>;
}

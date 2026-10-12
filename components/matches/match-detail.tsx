"use client";

import Link from "next/link";
import { compact, formatKda, kda } from "@/lib/format";
import { useMatch } from "@/lib/queries";
import { parseRiotId, profileHref } from "@/lib/regions";
import type { MatchDetail, ParticipantSummary, TeamObjectives } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { Skeleton } from "../ui/skeleton";
import { ErrorState } from "../ui/states";
import { Tooltip } from "../ui/tooltip";

export function MatchDetailPanel({ matchId, region, puuid }: { matchId: string; region: string; puuid: string }) {
  const q = useMatch(region, matchId, puuid);
  if (q.isLoading) return <div className="space-y-2 border-t border-line-soft p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Scoreboard match={q.data.data} region={region} puuid={puuid} />;
}

function Objectives({ o }: { o: TeamObjectives | undefined }) {
  if (!o) return null;
  const item = (label: string, v: number) => (
    <span className="flex items-center gap-1">
      <span className="text-dim">{label}</span> <span className="font-semibold text-fg tabular">{v}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      {item("Baron", o.baron)}
      {item("Dragon", o.dragon)}
      {item("Herald", o.herald)}
      {item("Grubs", o.grubs)}
      {item("Towers", o.tower)}
      {item("Inhibs", o.inhibitor)}
    </div>
  );
}

export function Scoreboard({ match, region, puuid }: { match: MatchDetail; region: string; puuid: string }) {
  const maxDmg = Math.max(...match.participants.map((p) => p.damageToChampions), 1);
  const mins = Math.max(1, match.durationSec / 60);
  return (
    <div className="space-y-3 border-t border-line-soft bg-black/15 p-3 sm:p-4">
      {([100, 200] as const).map((teamId) => {
        const team = match.participants.filter((p) => p.teamId === teamId);
        const obj = match.objectives.find((o) => o.teamId === teamId);
        const won = team[0]?.win;
        const kills = team.reduce((s, p) => s + p.kills, 0);
        const gold = team.reduce((s, p) => s + p.gold, 0);
        return (
          <div key={teamId} className="overflow-x-auto">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className={cn("text-xs font-semibold", won ? "text-win" : "text-loss")}>
                {won ? "Victory" : "Defeat"} <span className="text-muted">· {teamId === 100 ? "Blue" : "Red"} team · {kills} kills · {compact(gold)} gold</span>
              </p>
              <Objectives o={obj} />
            </div>
            <table className="w-full min-w-[720px] text-[12px]">
              <thead className="text-[10px] uppercase tracking-wider text-dim">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Player</th>
                  <th className="px-2 py-1 text-left font-medium">KDA</th>
                  <th className="px-2 py-1 text-left font-medium">Damage</th>
                  <th className="px-2 py-1 text-right font-medium">Gold</th>
                  <th className="px-2 py-1 text-right font-medium">CS</th>
                  <th className="px-2 py-1 text-right font-medium">Vision</th>
                  <th className="px-2 py-1 text-left font-medium">Items</th>
                </tr>
              </thead>
              <tbody>
                {team.map((p) => (
                  <Row key={p.puuid} p={p} me={p.puuid === puuid} maxDmg={maxDmg} mins={mins} teamKills={kills} region={region} />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Row({ p, me, maxDmg, mins, teamKills, region }: { p: ParticipantSummary; me: boolean; maxDmg: number; mins: number; teamKills: number; region: string }) {
  const id = parseRiotId(p.riotId);
  const ratio = kda(p.kills, p.deaths, p.assists);
  const kp = teamKills ? Math.round(((p.kills + p.assists) / teamKills) * 100) : 0;
  return (
    <tr className={cn("border-t border-line-soft/60", me && "bg-primary-soft")}>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <ChampionIcon id={p.championId} size={30} />
          <div className="flex flex-col gap-0.5">
            <SpellIcon id={p.spells[0]} size={14} />
            <SpellIcon id={p.spells[1]} size={14} />
          </div>
          <RuneIcon id={p.primaryRune} size={18} />
          {p.role && <RoleIcon role={p.role} size={14} className="text-dim" />}
          {id ? (
            <Link href={profileHref(region, id.gameName, id.tagLine)} className={cn("max-w-[130px] truncate hover:text-primary", me ? "font-semibold text-fg" : "text-fg/85")}>
              {id.gameName}
            </Link>
          ) : (
            <span className="max-w-[130px] truncate text-fg/85">{p.riotId}</span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 tabular">
        <span className="font-medium text-fg">
          {p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}
        </span>
        <span className="ml-1.5 text-[11px] text-muted">{formatKda(ratio)}</span>
        <span className="ml-1.5 text-[11px] text-dim">{kp}%</span>
      </td>
      <td className="px-2 py-1.5">
        <Tooltip content={`${p.damageToChampions.toLocaleString()} damage to champions · ${p.damageTaken.toLocaleString()} taken`}>
          <div className="flex w-[120px] items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-glow to-secondary" style={{ width: `${(p.damageToChampions / maxDmg) * 100}%` }} />
            </div>
            <span className="w-9 text-right text-[11px] text-muted tabular">{compact(p.damageToChampions)}</span>
          </div>
        </Tooltip>
      </td>
      <td className="px-2 py-1.5 text-right text-muted tabular">{compact(p.gold)}</td>
      <td className="px-2 py-1.5 text-right tabular">
        {p.cs} <span className="text-[11px] text-dim">({(p.cs / mins).toFixed(1)})</span>
      </td>
      <td className="px-2 py-1.5 text-right text-muted tabular">{p.visionScore}</td>
      <td className="px-2 py-1.5">
        <div className="flex gap-[2px]">
          {[...p.items.items, p.items.trinket].map((it, i) => (
            <ItemIcon key={i} id={it} size={20} />
          ))}
        </div>
      </td>
    </tr>
  );
}

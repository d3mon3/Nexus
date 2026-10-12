"use client";

import { ClipboardPaste, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatKda, pct, rankLabel, ROLE_LABEL, winRate, wrColor } from "@/lib/format";
import { usePlayerStats, useProfile } from "@/lib/queries";
import { profileHref, REGIONS, type Platform } from "@/lib/regions";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ChampionIcon, ProfileIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { RoleIcon } from "../game/role-icon";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/states";
import { parseLobby } from "./multi-search-parse";

export function MultiSearchView() {
  const { settings } = useSettings();
  const [text, setText] = useState("");
  const [region, setRegion] = useState<Platform>(settings.region);
  const [players, setPlayers] = useState<PlayerRef[]>([]);
  const preview = useMemo(() => parseLobby(text), [text]);
  const run = () => setPlayers(preview.map((p) => ({ ...p, platform: region })));
  return (
    <div>
      <PageHeader title="Multi Search" description="Paste your champion-select lobby to scout up to 10 players at once." />
      <Card className="mb-3 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"d3monek #EUW joined the lobby\nKaizen#PRO joined the lobby\nRavenna#PRO"}
          className="w-full resize-y rounded-lg border border-line bg-surface-2/80 p-3 text-sm text-fg outline-none placeholder:text-dim focus:border-primary/70"
          aria-label="Lobby text or Riot IDs"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select className="w-[100px]" label="Region" value={region} onChange={setRegion} options={REGIONS.map((r) => ({ value: r.platform, label: r.label }))} />
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.readText().then(setText).catch(() => undefined)}>
            <ClipboardPaste /> Paste
          </Button>
          <span className="text-xs text-muted">{preview.length} player{preview.length === 1 ? "" : "s"} detected</span>
          <div className="ml-auto flex gap-2">
            {players.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => (setPlayers([]), setText(""))}>
                <X /> Clear
              </Button>
            )}
            <Button variant="primary" onClick={run} disabled={!preview.length}>
              <Search /> Search {preview.length || ""}
            </Button>
          </div>
        </div>
      </Card>
      {players.length === 0 ? (
        <Card>
          <EmptyState icon={<Users />} title="No players yet" description="Copy the lobby chat from the League client (or type Riot IDs one per line) and press Search." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {players.map((p) => (
            <ScoutCard key={`${p.gameName}#${p.tagLine}`} player={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoutCard({ player }: { player: PlayerRef }) {
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;
  const stats = usePlayerStats(player.platform, puuid, 20);
  const s = stats.data?.data;
  const solo = profile.data?.data.ranked.find((r) => r.queue === "RANKED_SOLO_5x5");
  if (profile.isLoading) return <Skeleton className="h-[330px] rounded-[14px]" />;
  if (profile.error)
    return (
      <Card className="p-4 text-center">
        <p className="font-semibold">
          {player.gameName}
          <span className="text-muted">#{player.tagLine}</span>
        </p>
        <p className="mt-2 text-sm text-loss">{profile.error instanceof Error ? profile.error.message : "Not found"}</p>
      </Card>
    );
  const acc = profile.data!.data.account;
  return (
    <Card hover className="flex flex-col gap-3 p-4">
      <Link href={profileHref(player.platform, player.gameName, player.tagLine)} className="flex items-center gap-3 hover:text-primary">
        <ProfileIcon id={acc.profileIconId} size={44} className="rounded-xl" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{acc.gameName}</p>
          <p className="text-xs text-muted">
            #{acc.tagLine} · Lvl {acc.summonerLevel}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-white/[0.02] p-2">
        <RankEmblem tier={solo?.tier ?? null} size={44} />
        <div>
          <p className="text-sm font-semibold">{solo ? rankLabel(solo.tier, solo.division) : "Unranked"}</p>
          {solo && (
            <p className="text-xs text-muted tabular">
              {solo.lp} LP · <span className={wrColor(winRate(solo))}>{pct(winRate(solo))}</span> ({solo.wins + solo.losses})
            </p>
          )}
        </div>
      </div>
      {!s ? (
        <Skeleton className="h-28" />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Last {s.games}</span>
            <span className={cn("font-semibold", wrColor(s.winRate))}>
              {s.wins}W {s.losses}L · {formatKda(s.kda)}
            </span>
          </div>
          <div className="flex gap-[3px]" aria-label="Recent results">
            {s.timeline.slice(-10).map((t) => (
              <span key={t.matchId} className={cn("h-5 flex-1 rounded-sm", t.win ? "bg-win/80" : "bg-loss/70")} title={t.win ? "Win" : "Loss"} />
            ))}
          </div>
          {s.roles[0] && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <RoleIcon role={s.roles[0].role} size={14} className="text-primary" /> Mostly {ROLE_LABEL[s.roles[0].role]} ({s.roles[0].games}/{s.games})
            </p>
          )}
          <div className="space-y-1.5">
            {s.champions.slice(0, 3).map((c) => (
              <div key={c.championId} className="flex items-center gap-2 text-xs">
                <ChampionIcon id={c.championId} size={26} />
                <span className="flex-1 tabular text-muted">{c.games} games</span>
                <span className={cn("font-semibold tabular", wrColor(c.wins / c.games))}>{pct(c.wins / c.games)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

"use client";

import type { LiveClientSnapshot } from "./desktop";
import { SPELLS } from "./static-data";

/**
 * Builds a Live Client Data–shaped snapshot from the demo live game, so the overlay can be
 * previewed in a browser (`/overlay?demo=1`) without League running.
 */
export async function demoLiveSnapshot(): Promise<LiveClientSnapshot | null> {
  const [{ demoLiveGame, demoPuuid }, { FALLBACK_CHAMPIONS }] = await Promise.all([import("@/server/demo"), import("./static-data")]);
  const game = demoLiveGame(demoPuuid("d3monek", "EUW"));
  if (!game) return null;
  const roles = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
  const t = game.gameLengthSec;
  return {
    gameTime: t,
    gameMode: "CLASSIC",
    activeRiotId: "d3monek#EUW",
    activeGold: 1240,
    players: game.participants.map((p, i) => ({
      riotId: p.riotId,
      championName: FALLBACK_CHAMPIONS.find((c) => c.id === p.championId)?.name ?? "",
      team: p.teamId === 100 ? "ORDER" : "CHAOS",
      level: p.live?.level ?? 1,
      kills: p.live?.kills ?? 0,
      deaths: p.live?.deaths ?? 0,
      assists: p.live?.assists ?? 0,
      cs: p.live?.cs ?? 0,
      items: p.live?.items ?? [],
      spells: p.spells.map((id) => SPELLS[id]?.name ?? ""),
      position: roles[i % 5],
      keystone: p.perks?.keystone ?? null,
    })),
    events: [
      { name: "DragonKill", time: Math.max(0, t - 140) },
      { name: "HordeKill", time: Math.min(t, 520) },
    ],
  };
}

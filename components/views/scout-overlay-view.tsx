"use client";


import { t } from "@/lib/i18n";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { duration } from "@/lib/format";
import { useClientState } from "@/lib/desktop";
import { useLiveGame, useProfile } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { Logo } from "../layout/logo";
import { ScoutBoard } from "../live/scout-board";

/** Loading-screen scouting window (desktop). `?demo=1` previews it with the demo game. */
export function ScoutOverlayView() {
  const params = useSearchParams();
  const demo = params?.get("demo") === "1";
  const client = useClientState();
  const { settings } = useSettings();
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  const s = client?.summoner;
  const player = demo
    ? settings.myAccount ?? { gameName: "d3monek", tagLine: "EUW", platform: "euw1" as const }
    : s
      ? { gameName: s.gameName, tagLine: s.tagLine, platform: resolveRegion(s.platform ?? "")?.platform ?? settings.region }
      : null;
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;
  const live = useLiveGame(player?.platform, puuid, 0);
  const game = live.data?.data;

  return (
    <div className="flex h-dvh flex-col p-3" style={{ opacity: settings.overlayOpacity }}>
      <div className="mb-2 flex items-center gap-3 rounded-xl border border-[#a58df8]/30 bg-[#070a13]/92 px-4 py-2">
        <Logo size="sm" />
        <span className="text-sm text-fg/85">
          {game ? `${game.queueName.replace("Ranked Solo/Duo", "Ranked Solo")} · ${game.mapName} · ${duration(game.gameLengthSec)}` : t("Waiting for the game to load…")}
        </span>
        <span className="ml-auto text-xs text-muted">{t("Ctrl+Shift+S to hide")}</span>
      </div>
      {game && player ? <ScoutBoard game={game} region={player.platform} compactMode /> : null}
    </div>
  );
}

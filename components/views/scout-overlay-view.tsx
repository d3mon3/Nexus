"use client";


import { t } from "@/lib/i18n";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { duration } from "@/lib/format";
import { getBridge, useClientState } from "@/lib/desktop";
import { useLiveGame, useProfile } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Logo } from "../layout/logo";
import { ScoutBoard } from "../live/scout-board";

/** Loading-screen scouting window (desktop). `?demo=1` previews it with the demo game. */
export function ScoutOverlayView() {
  const params = useSearchParams();
  const demo = params?.get("demo") === "1";
  const client = useClientState();
  const { settings } = useSettings();
  const [edit, setEdit] = useState(params?.get("edit") === "1");
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return getBridge()?.onOverlayEdit?.(setEdit);
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
    <div className={cn("flex h-dvh flex-col overflow-auto p-3", edit && "rounded-xl outline-2 outline-dashed outline-primary")} style={{ opacity: settings.overlayOpacity }}>
      <div
        className={cn("widget-card mb-2 flex items-center gap-3 px-4 py-2", edit && "cursor-move !border-primary")}
        style={edit ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
      >
        <Logo size="sm" />
        <span className="text-sm text-fg/85">
          {game ? `${game.queueName.replace("Ranked Solo/Duo", "Ranked Solo")} · ${game.mapName} · ${duration(game.gameLengthSec)}` : t("Waiting for the game to load…")}
        </span>
        <span className={cn("ml-auto text-xs", edit ? "text-primary" : "text-muted")}>
          {edit
            ? t("Drag this bar to move the board — drop it on a second monitor and it fills that screen. Alt+{0} to lock.", [settings.hotkeys.edit])
            : t("Alt+{0} to hide · Alt+{1} to move", [settings.hotkeys.scout, settings.hotkeys.edit])}
        </span>
      </div>
      {game && player ? <ScoutBoard game={game} region={player.platform} compactMode /> : null}
    </div>
  );
}

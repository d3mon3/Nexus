"use client";

import { useEffect } from "react";
import { useClientState, useIsDesktop } from "@/lib/desktop";
import { useProfile } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { LivePanel } from "../live/live-panel";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { PlayerPicker, usePlayerParam } from "./player-picker";

export function LiveView() {
  const [player, setPlayer] = usePlayerParam();
  const { settings } = useSettings();
  const desktop = useIsDesktop();
  const client = useClientState();
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;

  // Desktop: follow the account logged into the League client automatically.
  useEffect(() => {
    const s = client?.summoner;
    if (!settings.autoDetectClient || !s || !client?.connected) return;
    const platform = resolveRegion(s.platform ?? "")?.platform ?? settings.region;
    if (!player || player.gameName.toLowerCase() !== s.gameName.toLowerCase() || player.tagLine.toLowerCase() !== s.tagLine.toLowerCase()) setPlayer({ gameName: s.gameName, tagLine: s.tagLine, platform });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.summoner?.puuid, client?.connected, settings.autoDetectClient]);

  return (
    <div className="space-y-3">
      {!player ? (
        <Card>
          <EmptyState title="Choose a player" description="Enter a Riot ID below to check whether they're in a game." />
        </Card>
      ) : profile.isLoading ? (
        <Skeleton className="h-[420px] rounded-[14px]" />
      ) : profile.error || !puuid ? (
        <Card>
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        </Card>
      ) : (
        <LivePanel region={player.platform} puuid={puuid} player={player} />
      )}
      <PlayerPicker player={player} onChange={setPlayer} label={desktop ? (client?.connected ? `Watching · League client ${client.phase}` : "Watching · League client not running") : "Watching player"} />
    </div>
  );
}

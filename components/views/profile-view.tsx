"use client";


import { t } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useLiveGame, useMatches, usePlayerStats, useProfile } from "@/lib/queries";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { BuildPanel } from "../builds/build-panel";
import { LivePanel } from "../live/live-panel";
import { MatchList } from "../matches/match-list";
import {
  ChampionPoolCard,
  LiveStatusCard,
  MasteryCard,
  MostPlayedCard,
  PersonalStatsCard,
  PlayersCard,
  RankCard,
  RecentMatchesCard,
  RecentPerformanceCard,
  RoleDistributionCard,
  SpellsRunesCard,
  TrendsCard,
} from "../profile/cards";
import { ChampionPerformanceTable } from "../profile/champion-table";
import { ProfileBanner, PROFILE_TABS, type ProfileTab } from "../profile/banner";
import { InsightsCard } from "../stats/insights-card";
import { HeroTiles, LiveNowPanel, MatchStrip, MostPlayedPanel, PerformanceCard, RankTiles, RecentPlayersPanel } from "../home/home-dashboard";
import { StatsPanel } from "../stats/stats-panel";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";

const same = (a: PlayerRef | null, b: PlayerRef) => !!a && a.gameName.toLowerCase() === b.gameName.toLowerCase() && a.tagLine.toLowerCase() === b.tagLine.toLowerCase() && a.platform === b.platform;

/** Dashboard (own account + favorites) and Player Profile share this view. */
export function ProfileView({ player, variant }: { player: PlayerRef; variant: "dashboard" | "profile" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { settings, pushRecent } = useSettings();
  const { champion } = useStatic();
  const tabParam = params?.get("tab");
  const tab: ProfileTab = PROFILE_TABS.some((tt) => tt.value === tabParam) ? (tabParam as ProfileTab) : "overview";
  const setTab = (tt: ProfileTab) => {
    const next = new URLSearchParams(params?.toString());
    if (tt === "overview") next.delete("tab");
    else next.set("tab", tt);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const profile = useProfile(player);
  const data = profile.data?.data;
  const puuid = data?.account.puuid;
  const region = player.platform;
  const stats = usePlayerStats(region, puuid, 20);
  const statsLong = usePlayerStats(region, puuid, 40);
  const live = useLiveGame(region, puuid, settings.liveRefreshSec);
  const latest = useMatches(region, puuid, { start: 0, count: 5, queue: "all" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (variant === "profile" && data) pushRecent(player);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, data?.account.puuid]);

  const refresh = async () => {
    if (!puuid) return;
    setRefreshing(true);
    try {
      await api.refresh(puuid, region);
      await qc.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).includes(puuid) || q.queryKey[0] === "profile" });
      toast.success(t("Profile refreshed"));
    } catch {
      toast.error(t("Refresh failed — try again in a moment."));
    } finally {
      setRefreshing(false);
    }
  };

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.error || !data) {
    const notFound = profile.error instanceof Error && /not found/i.test(profile.error.message);
    return (
      <Card className="mt-2">
        {notFound ? (
          <EmptyState
            icon={<SearchX />}
            title={t("Player not found")}
            description={t("No account named {0}#{1} on this region. Check the tag and region.", [player.gameName, player.tagLine])}
            action={
              <Link href="/">
                <Button variant="outline" size="sm">{t("Back home")}</Button>
              </Link>
            }
          />
        ) : (
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        )}
      </Card>
    );
  }

  const mainId = data.mainChampionId ?? data.mastery[0]?.championId;
  const artKey = champion(data.mastery[1]?.championId ?? mainId ?? 0)?.key;
  const lastOnMain = latest.data?.data.matches.find((m) => m.me.championId === mainId) ?? latest.data?.data.matches[0];
  const liveHref = `/live?player=${encodeURIComponent(`${player.gameName}#${player.tagLine}`)}&region=${region}`;
  const isMine = same(settings.myAccount, player);

  const dashboard = variant === "dashboard";
  const main = (
    <div className="min-w-0 space-y-3">
      {dashboard && <HeroTiles />}
      <ProfileBanner
        profile={data}
        player={player}
        source={profile.data!.source}
        note={t(profile.data!.note)}
        tab={tab}
        onTab={setTab}
        inGame={Boolean(live.data?.data)}
        onRefresh={refresh}
        refreshing={refreshing}
        isMine={isMine}
      />

      {tab === "overview" && dashboard && (
        <>
          <RankTiles profile={data} stats={statsLong.data?.data} onTab={setTab} />
          <MatchStrip region={region} puuid={puuid} onViewAll={() => setTab("matches")} />
          <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
            <PerformanceCard stats20={stats.data?.data} stats40={statsLong.data?.data} />
            <MostPlayedPanel stats={statsLong.data?.data} />
          </div>
          {statsLong.data?.data && <InsightsCard insights={statsLong.data.data.insights} games={statsLong.data.data.games} />}
        </>
      )}

      {tab === "overview" && !dashboard && (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_270px]">
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[1.42fr_1.55fr_0.92fr]">
              <RankCard profile={data} />
              <RecentPerformanceCard stats={stats.data?.data} loading={stats.isLoading} artKey={artKey} />
              <RoleDistributionCard stats={statsLong.data?.data} loading={statsLong.isLoading} />
              <MostPlayedCard stats={statsLong.data?.data} loading={statsLong.isLoading} onShowMore={() => setTab("champions")} />
              <div className="md:col-span-2 xl:col-span-2">
                <RecentMatchesCard region={region} puuid={puuid} onViewAll={() => setTab("matches")} />
              </div>
            </div>
            <div className="grid content-start gap-3 md:grid-cols-3 xl:grid-cols-1">
              <PersonalStatsCard stats={statsLong.data?.data} loading={statsLong.isLoading} />
              <LiveStatusCard live={live.data?.data} loading={live.isLoading} puuid={puuid} href={liveHref} />
              <SpellsRunesCard match={lastOnMain} championId={mainId} />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.6fr_1.3fr_1fr]">
            <MasteryCard mastery={data.mastery} />
            <TrendsCard stats={statsLong.data?.data} loading={statsLong.isLoading} />
            <ChampionPoolCard mastery={data.mastery} onViewAll={() => setTab("champions")} />
          </div>
          {statsLong.data?.data && <InsightsCard insights={statsLong.data.data.insights} games={statsLong.data.data.games} />}
        </>
      )}

      {tab === "champions" && <ChampionPerformanceTable stats={statsLong.data?.data} loading={statsLong.isLoading} mastery={data.mastery} />}
      {tab === "matches" && puuid && (
        <Card className="p-4">
          <MatchList region={region} puuid={puuid} onRefresh={refresh} />
        </Card>
      )}
      {tab === "live" && puuid && <LivePanel region={region} puuid={puuid} player={player} />}
      {tab === "statistics" && puuid && <StatsPanel region={region} puuid={puuid} />}
      {tab === "builds" && <BuildPanel championId={mainId ?? 157} />}
      {tab === "trends" && <TrendsCard stats={statsLong.data?.data} loading={statsLong.isLoading} height={300} />}
    </div>
  );
  if (!dashboard) return main;
  // Home: right rail with live status, personal stats and recently viewed players.
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_255px]">
      {main}
      <div className="grid content-start gap-3 md:grid-cols-2 xl:sticky xl:top-[68px] xl:grid-cols-1 xl:self-start">
        <LiveNowPanel live={live.data?.data} loading={live.isLoading} puuid={puuid} href={liveHref} />
        <RecentPlayersPanel />
        <PersonalStatsCard stats={statsLong.data?.data} loading={statsLong.isLoading} />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label={t("Loading profile")}>
      <Skeleton className="h-[290px] rounded-[20px]" />
      <div className="grid gap-3 xl:grid-cols-[1.42fr_1.55fr_0.92fr_270px]">
        <Skeleton className="h-[170px] rounded-[20px]" />
        <Skeleton className="h-[170px] rounded-[20px]" />
        <Skeleton className="h-[170px] rounded-[20px]" />
        <Skeleton className="h-[200px] rounded-[20px]" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.42fr_2.47fr_270px]">
        <Skeleton className="h-[340px] rounded-[20px]" />
        <Skeleton className="h-[340px] rounded-[20px]" />
        <Skeleton className="h-[340px] rounded-[20px]" />
      </div>
    </div>
  );
}

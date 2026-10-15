import type { ReactNode } from "react";
import { BuildsView } from "@/components/views/builds-view";
import { AugmentsView } from "@/components/views/augments-view";
import { ChampionDetailView } from "@/components/views/champion-detail-view";
import { ChampionsView } from "@/components/views/champions-view";
import { CompareView } from "@/components/views/compare-view";
import { DashboardView } from "@/components/views/dashboard-view";
import { DownloadView } from "@/components/views/download-view";
import { LeaderboardsView } from "@/components/views/leaderboards-view";
import { LiveView } from "@/components/views/live-view";
import { MatchesView } from "@/components/views/matches-view";
import { MultiSearchView } from "@/components/views/multi-search-view";
import { PlayerProfilePage, ProfileLanding } from "@/components/views/player-profile-page";
import { ProPlayersView } from "@/components/views/pro-players-view";
import { SettingsView } from "@/components/views/settings-view";
import { StatisticsView } from "@/components/views/statistics-view";
import { TierListView } from "@/components/views/tier-list-view";

export const routes: { pattern: RegExp; render: (p: string[]) => ReactNode }[] = [
  { pattern: /^\/$/, render: () => <DashboardView /> },
  { pattern: /^\/profile$/, render: () => <ProfileLanding /> },
  { pattern: /^\/profile\/([^/]+)\/([^/]+)$/, render: ([r, id]) => <PlayerProfilePage region={r} riotId={id} /> },
  { pattern: /^\/champions$/, render: () => <ChampionsView /> },
  { pattern: /^\/champions\/([^/]+)$/, render: ([k]) => <ChampionDetailView championKey={k} /> },
  { pattern: /^\/matches$/, render: () => <MatchesView /> },
  { pattern: /^\/live$/, render: () => <LiveView /> },
  { pattern: /^\/leaderboards$/, render: () => <LeaderboardsView /> },
  { pattern: /^\/tier-list$/, render: () => <TierListView /> },
  { pattern: /^\/builds$/, render: () => <BuildsView /> },
  { pattern: /^\/statistics$/, render: () => <StatisticsView /> },
  { pattern: /^\/compare$/, render: () => <CompareView /> },
  { pattern: /^\/multi-search$/, render: () => <MultiSearchView /> },
  { pattern: /^\/pro-players$/, render: () => <ProPlayersView /> },
  { pattern: /^\/settings$/, render: () => <SettingsView /> },
  { pattern: /^\/download$/, render: () => <DownloadView /> },
  { pattern: /^\/augments$/, render: () => <AugmentsView /> },
];

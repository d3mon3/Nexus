/**
 * Shared domain types used by the server services, API routes and UI.
 * Every payload carries a `source` so the UI can label demo / aggregated data honestly.
 */

export type DataSource = "riot" | "demo" | "aggregate" | "local-client";

export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
export const ROLES: Role[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

export type Tier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export const TIERS: Tier[] = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

export type Division = "I" | "II" | "III" | "IV";

export type QueueKey = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";

export interface Envelope<T> {
  data: T;
  source: DataSource;
  /** ISO timestamp the data was produced or fetched. */
  fetchedAt: string;
  /** Free-text caveat shown next to the data (API limitations, demo notice …). */
  note?: string;
}

export interface RankedEntry {
  queue: QueueKey;
  tier: Tier;
  division: Division | null;
  lp: number;
  wins: number;
  losses: number;
  hotStreak?: boolean;
}

export interface PlayerAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: string;
  profileIconId: number;
  summonerLevel: number;
}

export interface MasteryEntry {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
}

export interface PeakRank {
  tier: Tier;
  division: Division | null;
  lp: number;
  season: string;
}

export interface PlayerProfile {
  account: PlayerAccount;
  ranked: RankedEntry[];
  mastery: MasteryEntry[];
  /** Ladder position — only exists in demo or when the DB has a ladder snapshot. */
  ladder?: { position: number; topPercent: number | null; scope: string } | null;
  peak?: PeakRank | null;
  /** Optional, user-set tagline shown under the name (stored locally). */
  motto?: string;
  mainChampionId?: number | null;
}

export interface ItemSlots {
  items: number[]; // 6 regular slots (0 = empty)
  trinket: number;
}

export interface ParticipantSummary {
  puuid: string;
  riotId: string;
  championId: number;
  championName: string;
  teamId: 100 | 200;
  role: Role | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageToChampions: number;
  damageTaken: number;
  visionScore: number;
  wardsPlaced: number;
  champLevel: number;
  items: ItemSlots;
  spells: [number, number];
  primaryRune: number;
  secondaryStyle: number;
  win: boolean;
}

export interface TeamObjectives {
  teamId: 100 | 200;
  win: boolean;
  kills: number;
  baron: number;
  dragon: number;
  herald: number;
  tower: number;
  inhibitor: number;
  grubs: number;
}

export interface MatchSummary {
  matchId: string;
  queueId: number;
  queueName: string;
  gameCreation: number;
  durationSec: number;
  patch: string;
  /** The tracked player's line. */
  me: ParticipantSummary;
  /** LP change; only set when reliably known (DB snapshots or demo). */
  lpChange: number | null;
  /** Champion ids of all 10 players for compact rendering. */
  teams: { teamId: 100 | 200; championIds: number[]; riotIds: string[] }[];
}

export interface MatchDetail extends MatchSummary {
  participants: ParticipantSummary[];
  objectives: TeamObjectives[];
}

export interface LiveParticipant {
  puuid: string | null;
  riotId: string;
  championId: number;
  teamId: 100 | 200;
  spells: [number, number];
  perks: { primaryStyle: number; subStyle: number; keystone: number } | null;
  ranked: RankedEntry | null;
  /** Only provided by the local Live Client Data API (desktop, own game). */
  live?: {
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    level: number;
    items: number[];
    /** Only known for the player running the client. */
    gold?: number | null;
  } | null;
}

export interface LiveGame {
  gameId: number;
  queueId: number;
  queueName: string;
  mapName: string;
  gameStartTime: number;
  gameLengthSec: number;
  participants: LiveParticipant[];
  bans: { championId: number; teamId: 100 | 200 }[];
  /** Fields the source cannot provide, shown as explicit "unavailable" states. */
  unavailable: string[];
}

export interface ChampionInfo {
  id: number;
  key: string; // Data Dragon id, e.g. "MonkeyKing"
  name: string;
  title: string;
  roles: Role[];
  tags: string[];
}

export interface ChampionStat {
  championId: number;
  role: Role;
  tier: TierGrade;
  winRate: number;
  pickRate: number;
  banRate: number;
  games: number;
  kda: number;
}

export type TierGrade = "S+" | "S" | "A" | "B" | "C" | "D";
export const TIER_GRADES: TierGrade[] = ["S+", "S", "A", "B", "C", "D"];

export interface BuildPath {
  items: number[];
  games: number;
  winRate: number;
  pickRate: number;
}

export interface RunePage {
  primaryStyle: number;
  subStyle: number;
  /** Selected perk ids in order: keystone, 3 primary, 2 secondary. */
  perks: number[];
  shards: number[];
  games: number;
  winRate: number;
}

export interface Matchup {
  opponentId: number;
  games: number;
  winRate: number;
}

export interface ChampionBuild {
  championId: number;
  /** Game mode the build is for (see lib/modes.ts); older payloads omit it (= "sr"). */
  mode?: import("./modes").GameModeId;
  /** Lane for Summoner's Rift; other modes use "ANY". */
  role: Role;
  patch: string;
  summary: ChampionStat;
  starting: BuildPath[];
  popular: BuildPath;
  highestWinRate: BuildPath;
  boots: BuildPath[];
  situational: { itemId: number; winRate: number; pickRate: number }[];
  runes: RunePage[];
  spells: { ids: [number, number]; games: number; winRate: number }[];
  skillOrder: { priority: ("Q" | "W" | "E")[]; sequence: ("Q" | "W" | "E" | "R")[]; winRate: number };
  counters: Matchup[]; // hardest matchups
  favorable: Matchup[]; // easiest matchups
}

export interface LeaderboardEntry {
  rank: number;
  puuid: string;
  riotId: string;
  tier: Tier;
  lp: number;
  wins: number;
  losses: number;
  profileIconId?: number;
  topChampionIds?: number[];
}

export interface ProPlayer {
  handle: string;
  realName: string;
  team: string;
  league: string;
  role: Role;
  country: string;
  riotId: string | null;
  platform: string;
  signatureChampionIds: number[];
}

export interface PlayerStats {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  kda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  csPerMin: number;
  visionPerMin: number;
  damagePerMin: number;
  killParticipation: number;
  roles: { role: Role; games: number; winRate: number }[];
  champions: {
    championId: number;
    games: number;
    wins: number;
    kda: number;
    kills: number;
    deaths: number;
    assists: number;
    csPerMin: number;
  }[];
  /** Chronological (oldest → newest) per-game timeline. */
  timeline: {
    matchId: string;
    date: number;
    win: boolean;
    kda: number;
    csPerMin: number;
    damagePerMin: number;
    visionScore: number;
    lpChange: number | null;
    cumulativeLp: number | null;
    rollingWinRate: number;
  }[];
  /** 0–100 scores for the "Personal Stats" radar. */
  radar: { axis: string; value: number }[];
  /** "What to improve" findings (server/services/insights.ts). */
  insights?: PlayerInsight[];
}

export interface PlayerInsight {
  id: string;
  tone: "good" | "bad" | "info";
  /** English template with {placeholders}; translated on the client. */
  title: string;
  detail: string;
  vars: Record<string, string | number>;
}

export interface AppStatus {
  /** live = Riot key set; demo = labelled demo data; offline = production server still waiting for a key. */
  mode: "live" | "demo" | "offline";
  /** Riot rejected the configured key (expired development key). */
  keyRejected?: boolean;
  ddragonVersion: string;
  database: boolean;
  aggregateDataset: { patch: string; matches: number } | null;
}

export type ScoutTagTone = "good" | "bad" | "neutral" | "info";

export interface ScoutTag {
  label: string;
  tone: ScoutTagTone;
}

/** Porofessor-style scouting card for one player in a live game. */
export interface ScoutPlayer {
  puuid: string;
  riotId: string;
  teamId: 100 | 200;
  championId: number;
  summonerLevel: number;
  profileIconId: number;
  spells: [number, number];
  keystone: number | null;
  subStyle: number | null;
  mastery: { level: number; points: number } | null;
  /** Performance on the champion they are playing, from the analysed matches. */
  champion: { games: number; wins: number; kills: number; deaths: number; assists: number } | null;
  ranked: RankedEntry | null;
  ladderRank: number | null;
  /** Game counts in the windows come from Match-V5 id lists; wins from analysed matches. */
  last12h: { games: number; wins: number | null };
  last30d: { games: number; wins: number | null; analysed: number };
  mainRole: Role | null;
  tags: ScoutTag[];
  analysed: number;
}

export interface DesktopReleaseInfo {
  configured: boolean;
  release: { tag: string; name: string; publishedAt: string; fileName: string; url: string; size: number } | null;
}

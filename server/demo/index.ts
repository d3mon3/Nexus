/**
 * Demo dataset. Used whenever RIOT_API_KEY is missing (and for datasets that need
 * aggregation when no aggregate has been built). Everything is deterministic and the
 * UI always labels it as demo data.
 */
import { FALLBACK_CHAMPIONS, ITEMS, queueName } from "@/lib/static-data";
import type {
  ChampionBuild,
  ChampionInfo,
  ChampionStat,
  Division,
  LeaderboardEntry,
  LiveGame,
  LiveParticipant,
  MasteryEntry,
  MatchDetail,
  MatchSummary,
  ParticipantSummary,
  PlayerProfile,
  ProPlayer,
  RankedEntry,
  Role,
  TeamObjectives,
  Tier,
  TierGrade,
} from "@/lib/types";
import { ROLES } from "@/lib/types";
import { archetypeOf, ROLE_SPELLS, skillSequence, TEMPLATES } from "./archetypes";
import { hashString, rng, type Rng } from "./random";

export const DEMO_PLAYER = { gameName: "d3monek", tagLine: "EUW", platform: "euw1" } as const;

const champs = FALLBACK_CHAMPIONS;
const champById = new Map(champs.map((c) => [c.id, c]));
const byRole = (role: Role) => champs.filter((c) => c.roles.includes(role));
const champ = (key: string) => champs.find((c) => c.key === key)!;

/* ------------------------------------------------------------- identities */

const toB64 = (s: string) =>
  typeof Buffer !== "undefined"
    ? Buffer.from(s, "utf8").toString("base64url")
    : btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) =>
  typeof Buffer !== "undefined"
    ? Buffer.from(s, "base64url").toString("utf8")
    : decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function demoPuuid(gameName: string, tagLine: string): string {
  return `demo-${toB64(`${gameName}#${tagLine}`)}`;
}

export function decodeDemoPuuid(puuid: string): { gameName: string; tagLine: string } | null {
  if (!puuid.startsWith("demo-")) return null;
  try {
    const [gameName, tagLine] = fromB64(puuid.slice(5)).split("#");
    return gameName && tagLine ? { gameName, tagLine } : null;
  } catch {
    return null;
  }
}

const isFeatured = (gameName: string) => gameName.toLowerCase() === DEMO_PLAYER.gameName;

const NAME_A = ["Shadow", "Void", "Night", "Storm", "Iron", "Crimson", "Silent", "Neon", "Lunar", "Ashen", "Frost", "Wild", "Hollow", "Ember", "Rune", "Pale", "Echo", "Nova", "Ghost", "Rift"];
const NAME_B = ["blade", "fox", "walker", "king", "wolf", "drift", "mage", "reaper", "sage", "fang", "hex", "spark", "veil", "ward", "strike", "bloom", "crow", "pulse", "thorn", "zero"];
const TEAMMATES = ["MidKing", "shadow", "Kyuubi", "Nexas", "Ragnar", "Klex", "Azuu", "Tylen", "Verox", "Miro", "Selene", "Orbit", "Kaito", "Vexa", "Lumen", "Rook", "Sable", "Yuki", "Dante", "Nyx", "Pixel", "Arden", "Kuro", "Mavi"];
const TAGS = ["EUW", "EUW1", "0001", "GG", "777", "VOID", "NXS", "KR1", "2077", "FOX"];

export function demoName(r: Rng): { gameName: string; tagLine: string } {
  const gameName = r.chance(0.5) ? r.pick(TEAMMATES) + (r.chance(0.4) ? r.int(1, 99) : "") : `${r.pick(NAME_A)}${r.pick(NAME_B)}`;
  return { gameName, tagLine: r.pick(TAGS) };
}

/* --------------------------------------------------------------- profile */

const TIER_LADDER: Tier[] = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const DIVS: Division[] = ["IV", "III", "II", "I"];

function randomRank(r: Rng, bias = 0): RankedEntry {
  const t = Math.min(9, Math.max(0, Math.round(r.normal(4.2 + bias, 1.9))));
  const tier = TIER_LADDER[t];
  const apex = t >= 7;
  const games = r.int(40, 420);
  const wr = r.float(0.46, 0.57);
  const wins = Math.round(games * wr);
  return {
    queue: "RANKED_SOLO_5x5",
    tier,
    division: apex ? null : r.pick(DIVS),
    lp: apex ? r.int(0, 300 + (t - 7) * 600) : r.int(0, 99),
    wins,
    losses: games - wins,
    hotStreak: r.chance(0.15),
  };
}

interface PoolEntry {
  id: number;
  weight: number;
}

function championPool(gameName: string, tagLine: string): { role: Role; secondary: Role; pool: PoolEntry[] } {
  if (isFeatured(gameName)) {
    return {
      role: "MIDDLE",
      secondary: "TOP",
      pool: [
        { id: 157, weight: 246 },
        { id: 238, weight: 182 },
        { id: 777, weight: 134 },
        { id: 84, weight: 98 },
        { id: 55, weight: 76 },
        { id: 103, weight: 30 },
        { id: 92, weight: 24 },
        { id: 266, weight: 18 },
        { id: 517, weight: 16 },
        { id: 245, weight: 14 },
        { id: 91, weight: 10 },
        { id: 64, weight: 8 },
      ],
    };
  }
  const r = rng(`pool:${gameName}#${tagLine}`);
  const role = r.pick(ROLES);
  const secondary = r.pick(ROLES.filter((x) => x !== role));
  const main = r.shuffle(byRole(role)).slice(0, 5);
  const off = r.shuffle(byRole(secondary)).slice(0, 3);
  const pool = [...main, ...off].map((c, i) => ({ id: c.id, weight: Math.round(140 / (i + 1)) + r.int(0, 20) }));
  return { role, secondary, pool };
}

export function demoProfile(gameName: string, tagLine: string, platform: string): PlayerProfile {
  const puuid = demoPuuid(gameName, tagLine);
  if (isFeatured(gameName)) {
    return {
      account: { puuid, gameName: DEMO_PLAYER.gameName, tagLine: tagLine.toUpperCase(), platform, profileIconId: 6631, summonerLevel: 358 },
      ranked: [
        { queue: "RANKED_SOLO_5x5", tier: "DIAMOND", division: "II", lp: 1, wins: 289, losses: 248, hotStreak: false },
        { queue: "RANKED_FLEX_SR", tier: "PLATINUM", division: "I", lp: 54, wins: 38, losses: 31 },
      ],
      mastery: [
        { championId: 157, championLevel: 48, championPoints: 1_204_331, lastPlayTime: Date.now() - 2 * 3600e3 },
        { championId: 238, championLevel: 37, championPoints: 920_114, lastPlayTime: Date.now() - 5 * 3600e3 },
        { championId: 777, championLevel: 29, championPoints: 681_002, lastPlayTime: Date.now() - 8 * 3600e3 },
        { championId: 84, championLevel: 24, championPoints: 540_880, lastPlayTime: Date.now() - 26 * 3600e3 },
        { championId: 55, championLevel: 20, championPoints: 430_512, lastPlayTime: Date.now() - 50 * 3600e3 },
        { championId: 103, championLevel: 11, championPoints: 214_090, lastPlayTime: Date.now() - 9 * 86400e3 },
        { championId: 92, championLevel: 9, championPoints: 168_440, lastPlayTime: Date.now() - 12 * 86400e3 },
        { championId: 266, championLevel: 7, championPoints: 120_311, lastPlayTime: Date.now() - 20 * 86400e3 },
        ...[517, 245, 91, 64, 7, 4, 105, 134, 142, 112, 39, 24, 122, 86, 240, 141, 121, 202, 222, 412, 117, 99].map((championId, i) => ({
          championId,
          championLevel: Math.max(3, 7 - Math.floor(i / 4)),
          championPoints: Math.round(110_000 * 0.88 ** i),
          lastPlayTime: Date.now() - (22 + i * 3) * 86400e3,
        })),
      ],
      ladder: { position: 21_452, topPercent: 0.8, scope: "EUW" },
      peak: { tier: "MASTER", division: null, lp: 312, season: "Season 2025" },
      motto: "Same game, different mindset.",
      mainChampionId: 157,
    };
  }
  const r = rng(`profile:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`);
  const solo = randomRank(r);
  const flex = r.chance(0.7) ? { ...randomRank(r, -0.5), queue: "RANKED_FLEX_SR" as const } : null;
  const { pool } = championPool(gameName, tagLine);
  const mastery: MasteryEntry[] = pool
    .map((p, i) => ({
      championId: p.id,
      championLevel: Math.max(5, Math.round(30 / (i + 1)) + r.int(0, 6)),
      championPoints: Math.round((900_000 / (i + 1)) * r.float(0.4, 1.1)),
      lastPlayTime: Date.now() - r.int(1, 400) * 3600e3,
    }))
    .sort((a, b) => b.championPoints - a.championPoints);
  return {
    account: { puuid, gameName, tagLine, platform, profileIconId: r.int(4800, 6200), summonerLevel: r.int(60, 640) },
    ranked: flex ? [solo, flex] : [solo],
    mastery,
    ladder: { position: r.int(2_000, 900_000), topPercent: Number(r.float(0.5, 60).toFixed(1)), scope: platform.toUpperCase() },
    peak: { ...solo, division: solo.division, season: "Season 2025" },
    mainChampionId: mastery[0]?.championId ?? null,
  };
}

/* --------------------------------------------------------------- matches */

const HISTORY_SIZE = 200;
const HOUR = 3600e3;

function anchorTime(): number {
  // Stable within an hour so "2 hours ago" doesn't jump while browsing.
  return Math.floor(Date.now() / HOUR) * HOUR;
}

/** Curated top of the history for the featured demo profile (matches the design reference). */
const FEATURED: { champ: number; k: number; d: number; a: number; cs: number; gold: number; win: boolean; min: number; lp: number; ago: number }[] = [
  { champ: 157, k: 12, d: 4, a: 8, cs: 215, gold: 18_200, win: true, min: 26, lp: 24, ago: 2 },
  { champ: 238, k: 6, d: 8, a: 5, cs: 167, gold: 12_900, win: false, min: 29, lp: -22, ago: 5 },
  { champ: 777, k: 15, d: 6, a: 9, cs: 241, gold: 19_700, win: true, min: 31, lp: 26, ago: 8 },
  { champ: 84, k: 9, d: 3, a: 6, cs: 203, gold: 15_100, win: true, min: 28, lp: 21, ago: 24 },
  { champ: 55, k: 3, d: 7, a: 4, cs: 146, gold: 10_900, win: false, min: 27, lp: -19, ago: 48 },
];
const FEATURED_RESULTS = "WLWWLWWLWLWWLWLLWWLW"; // 12W 8L over the last 20

const FEATURED_ROLES: [Role, number][] = [
  ["MIDDLE", 0.44],
  ["TOP", 0.27],
  ["JUNGLE", 0.15],
  ["BOTTOM", 0.09],
  ["UTILITY", 0.05],
];

function pickRole(r: Rng, weights: [Role, number][]): Role {
  let x = r.next();
  for (const [role, w] of weights) {
    x -= w;
    if (x <= 0) return role;
  }
  return weights[0][0];
}

function pickWeighted(r: Rng, pool: PoolEntry[]): number {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let x = r.next() * total;
  for (const p of pool) {
    x -= p.weight;
    if (x <= 0) return p.id;
  }
  return pool[0].id;
}

function itemsFor(championKey: string, role: Role, minutes: number, r: Rng): { items: number[]; trinket: number } {
  const t = TEMPLATES[archetypeOf(championKey, role)];
  const full = minutes >= 30 ? 5 : minutes >= 24 ? 4 : minutes >= 19 ? 3 : minutes >= 14 ? 2 : 1;
  const path = r.chance(0.6) ? t.core : t.alt;
  const built = path.slice(0, full);
  const items = [t.boots[r.int(0, t.boots.length - 1)], ...built];
  if (items.length < 6) items.push(r.pick([1036, 2055, 1082, 3026, 3814]));
  while (items.length < 6) items.push(0);
  const trinket = role === "UTILITY" || role === "JUNGLE" ? 3364 : r.chance(0.8) ? 3340 : 3363;
  return { items: r.shuffle(items.slice(0, 6)).sort((a, b) => (a === 0 ? 1 : 0) - (b === 0 ? 1 : 0)), trinket };
}

function runesFor(championKey: string, role: Role, r: Rng) {
  const t = TEMPLATES[archetypeOf(championKey, role)];
  const page = r.chance(0.75) ? t.runes[0] : t.runes[1] ?? t.runes[0];
  return { primaryRune: page.perks[0], secondaryStyle: page.subStyle };
}

function makeParticipant(
  r: Rng,
  args: { puuid: string; riotId: string; championId: number; teamId: 100 | 200; role: Role; win: boolean; minutes: number; fixed?: (typeof FEATURED)[number] },
): ParticipantSummary {
  const c = champById.get(args.championId)!;
  const carry = args.role !== "UTILITY";
  const f = args.fixed;
  const kills = f?.k ?? Math.max(0, Math.round(r.normal(carry ? (args.win ? 8 : 4.5) : 2, 3)));
  const deaths = f?.d ?? Math.max(0, Math.round(r.normal(args.win ? 3.8 : 6.5, 2)));
  const assists = f?.a ?? Math.max(0, Math.round(r.normal(args.role === "UTILITY" ? 13 : args.win ? 8 : 5, 3)));
  const csPerMin = args.role === "UTILITY" ? r.float(0.6, 1.8) : args.role === "JUNGLE" ? r.float(5.2, 7) : r.float(6.2, 8.9);
  const cs = f?.cs ?? Math.round(csPerMin * args.minutes);
  const gold = f?.gold ?? Math.round((args.win ? 430 : 360) * args.minutes * r.float(0.85, 1.15) * (carry ? 1 : 0.7));
  const dmgPerMin = carry ? r.float(560, 1200) : r.float(250, 520);
  const spells = r.pick(ROLE_SPELLS[args.role]);
  const runes = runesFor(c.key, args.role, r);
  return {
    puuid: args.puuid,
    riotId: args.riotId,
    championId: c.id,
    championName: c.key,
    teamId: args.teamId,
    role: args.role,
    kills,
    deaths,
    assists,
    cs,
    gold,
    damageToChampions: Math.round(dmgPerMin * args.minutes * (f ? (f.k + f.a) / 14 : 1)),
    damageTaken: Math.round(r.float(500, 1100) * args.minutes),
    visionScore: Math.round((args.role === "UTILITY" ? r.float(1.8, 3.2) : args.role === "JUNGLE" ? r.float(1, 1.7) : r.float(0.6, 1.2)) * args.minutes),
    wardsPlaced: Math.round((args.role === "UTILITY" ? r.float(1.1, 1.8) : r.float(0.3, 0.6)) * args.minutes),
    champLevel: Math.min(18, Math.round(args.minutes / 1.9 + (args.win ? 1 : 0))),
    items: itemsFor(c.key, args.role, args.minutes, r),
    spells: [spells[0], spells[1]],
    primaryRune: runes.primaryRune,
    secondaryStyle: runes.secondaryStyle,
    win: args.win,
  };
}

function encodeMatchId(platform: string, puuid: string, index: number) {
  return `DEMO_${platform.toUpperCase()}_${index}_${puuid.slice(5)}`;
}

function decodeMatchId(matchId: string): { platform: string; puuid: string; index: number } | null {
  const m = /^DEMO_([A-Z0-9]+)_(\d+)_(.+)$/.exec(matchId);
  if (!m) return null;
  return { platform: m[1].toLowerCase(), index: Number(m[2]), puuid: `demo-${m[3]}` };
}

function matchQueue(r: Rng, index: number, featured: boolean): number {
  if (featured && index < 20) return 420;
  const x = r.next();
  return x < 0.62 ? 420 : x < 0.78 ? 440 : x < 0.9 ? 400 : 450;
}

export function demoMatchDetail(matchId: string): MatchDetail | null {
  const decoded = decodeMatchId(matchId);
  if (!decoded) return null;
  const identity = decodeDemoPuuid(decoded.puuid);
  if (!identity) return null;
  const { index, puuid } = decoded;
  const featured = isFeatured(identity.gameName);
  const r = rng(`match:${matchId}`);
  const fixed = featured ? FEATURED[index] : undefined;

  const { role: mainRole, secondary, pool } = championPool(identity.gameName, identity.tagLine);
  const myRole: Role = fixed ? "MIDDLE" : featured ? pickRole(r, FEATURED_ROLES) : r.chance(0.78) ? mainRole : secondary;
  const rolePool = pool.filter((p) => champById.get(p.id)?.roles.includes(myRole));
  const myChamp = fixed?.champ ?? (rolePool.length ? pickWeighted(r, rolePool) : r.pick(byRole(myRole)).id);
  const win = fixed ? fixed.win : featured && index < 20 ? FEATURED_RESULTS[index] === "W" : r.chance(0.53);
  const minutes = fixed?.min ?? r.int(19, 38);
  const durationSec = minutes * 60 + r.int(0, 59);
  const queueId = matchQueue(r, index, featured);

  // Time: walk backwards from the anchor with plausible gaps.
  const gapR = rng(`gaps:${puuid}`);
  let ago = 0;
  for (let i = 0; i <= index; i++) ago += i < FEATURED.length && featured ? 0 : gapR.float(1.5, 14) * HOUR;
  const gameCreation = fixed ? anchorTime() - fixed.ago * HOUR - durationSec * 1000 : anchorTime() - ago - (featured ? 48 * HOUR : 0) - durationSec * 1000;

  const used = new Set<number>([myChamp]);
  const participants: ParticipantSummary[] = [];
  const nameR = rng(`names:${matchId}`);
  for (const teamId of [100, 200] as const) {
    for (const role of ROLES) {
      const isMe = teamId === 100 && role === myRole;
      let championId = myChamp;
      if (!isMe) {
        const options = byRole(role).filter((c) => !used.has(c.id));
        championId = r.pick(options).id;
        used.add(championId);
      }
      const name = isMe ? identity : demoName(nameR);
      participants.push(
        makeParticipant(r, {
          puuid: isMe ? puuid : demoPuuid(name.gameName, name.tagLine),
          riotId: `${name.gameName}#${name.tagLine}`,
          championId,
          teamId,
          role,
          win: teamId === 100 ? win : !win,
          minutes,
          fixed: isMe ? fixed : undefined,
        }),
      );
    }
  }
  const me = participants.find((p) => p.puuid === puuid)!;

  const objectives: TeamObjectives[] = ([100, 200] as const).map((teamId) => {
    const won = teamId === 100 ? win : !win;
    return {
      teamId,
      win: won,
      kills: participants.filter((p) => p.teamId === teamId).reduce((s, p) => s + p.kills, 0),
      baron: won ? r.int(0, 2) : r.int(0, 1),
      dragon: won ? r.int(2, 4) : r.int(0, 2),
      herald: r.int(0, 1),
      grubs: r.int(0, 6),
      tower: won ? r.int(7, 11) : r.int(1, 6),
      inhibitor: won ? r.int(1, 3) : r.int(0, 1),
    };
  });

  let lpChange: number | null = null;
  if (queueId === 420) lpChange = fixed?.lp ?? (win ? r.int(18, 27) : -r.int(16, 24));

  return {
    matchId,
    queueId,
    queueName: queueName(queueId),
    gameCreation,
    durationSec: fixed ? minutes * 60 + 12 : durationSec,
    patch: "demo",
    me,
    lpChange,
    teams: ([100, 200] as const).map((teamId) => ({
      teamId,
      championIds: participants.filter((p) => p.teamId === teamId).map((p) => p.championId),
      riotIds: participants.filter((p) => p.teamId === teamId).map((p) => p.riotId),
    })),
    participants,
    objectives,
  };
}

export function demoMatchIds(puuid: string, platform: string): string[] {
  return Array.from({ length: HISTORY_SIZE }, (_, i) => encodeMatchId(platform, puuid, i));
}

export function demoMatchSummaries(puuid: string, platform: string, opts: { start: number; count: number; queueIds?: number[] | null; championId?: number | null; result?: "win" | "loss" | null }): { matches: MatchSummary[]; total: number } {
  const all = demoMatchIds(puuid, platform)
    .map((id) => demoMatchDetail(id)!)
    .filter((m) => (!opts.queueIds || opts.queueIds.includes(m.queueId)) && (!opts.championId || m.me.championId === opts.championId) && (!opts.result || (opts.result === "win") === m.me.win));
  return { matches: all.slice(opts.start, opts.start + opts.count).map(toSummary), total: all.length };
}

export function toSummary(m: MatchDetail): MatchSummary {
  const { participants: _p, objectives: _o, ...summary } = m;
  void _p;
  void _o;
  return summary;
}

/* ------------------------------------------------------------- live game */

export function demoLiveGame(puuid: string): LiveGame | null {
  const identity = decodeDemoPuuid(puuid);
  if (!identity) return null;
  const featured = isFeatured(identity.gameName);
  const hourSeed = Math.floor(Date.now() / HOUR);
  const r = rng(`live:${puuid}:${hourSeed}`);
  if (!featured && !r.chance(0.35)) return null;

  // Featured profile is always "in game" for 12:36 at the start of the hour, advancing in real time.
  const elapsedInHour = (Date.now() - hourSeed * HOUR) / 1000;
  const gameLengthSec = Math.round(featured ? 756 + (elapsedInHour % 1500) : r.int(120, 1700));
  const { role: myRole, pool } = championPool(identity.gameName, identity.tagLine);
  const myChamp = featured ? 157 : pickWeighted(r, pool);
  const used = new Set([myChamp]);
  const participants: LiveParticipant[] = [];
  const minutes = gameLengthSec / 60;

  for (const teamId of [100, 200] as const) {
    for (const role of ROLES) {
      const isMe = teamId === 100 && role === myRole;
      const name = isMe ? identity : demoName(r);
      // Other players usually play something from their own (demo) champion pool.
      const theirPool = championPool(name.gameName, name.tagLine).pool.filter((p) => !used.has(p.id) && champById.get(p.id)!.roles.includes(role));
      const championId = isMe ? myChamp : theirPool.length && r.chance(0.95) ? pickWeighted(r, theirPool) : r.pick(byRole(role).filter((c) => !used.has(c.id))).id;
      used.add(championId);
      const key = champById.get(championId)!.key;
      const spells = r.pick(ROLE_SPELLS[role]);
      const page = TEMPLATES[archetypeOf(key, role)].runes[0];
      participants.push({
        puuid: isMe ? puuid : demoPuuid(name.gameName, name.tagLine),
        riotId: `${name.gameName}#${name.tagLine}`,
        championId,
        teamId,
        spells: [spells[0], spells[1]],
        perks: { primaryStyle: page.primaryStyle, subStyle: page.subStyle, keystone: page.perks[0] },
        ranked: demoProfile(name.gameName, name.tagLine, "euw1").ranked.find((e) => e.queue === "RANKED_SOLO_5x5") ?? null,
        // In demo we simulate what the desktop app reads from the local Live Client Data API.
        live: {
          kills: isMe && featured ? 12 : Math.max(0, Math.round(r.normal(minutes / 4, 2))),
          deaths: isMe && featured ? 1 : Math.max(0, Math.round(r.normal(minutes / 6, 1.5))),
          assists: isMe && featured ? 4 : Math.max(0, Math.round(r.normal(minutes / 4, 2))),
          cs: isMe && featured ? 216 : Math.round((role === "UTILITY" ? 1.2 : role === "JUNGLE" ? 5.8 : 7.4) * minutes),
          level: Math.min(18, Math.round(minutes / 1.7) + 1),
          items: itemsFor(key, role, minutes, r).items,
          gold: isMe ? Math.round(500 + minutes * 430) : null,
        },
      });
    }
  }
  return {
    gameId: hashString(`${puuid}:${hourSeed}`),
    queueId: 420,
    queueName: queueName(420),
    mapName: "Summoner's Rift",
    gameStartTime: Date.now() - gameLengthSec * 1000,
    gameLengthSec,
    participants,
    bans: Array.from({ length: 10 }, (_, i) => ({ championId: r.pick(champs).id, teamId: (i < 5 ? 100 : 200) as 100 | 200 })),
    unavailable: ["Gold for other players", "Objective timers"],
  };
}

/* ----------------------------------------------------------- leaderboard */

const LADDER_SIZE = 4000;

export function demoLeaderboard(platform: string): LeaderboardEntry[] {
  const r = rng(`ladder:${platform}`);
  let lp = r.int(1750, 2150);
  return Array.from({ length: LADDER_SIZE }, (_, i) => {
    lp = Math.max(0, lp - r.float(0.2, i < 300 ? 3.4 : 0.7));
    const tier: Tier = i < 300 ? "CHALLENGER" : i < 1000 ? "GRANDMASTER" : "MASTER";
    const games = r.int(180, 900);
    const wr = r.float(0.52, 0.66) - i / LADDER_SIZE / 20;
    const name = demoName(r);
    const role = r.pick(ROLES);
    return {
      rank: i + 1,
      puuid: demoPuuid(name.gameName, name.tagLine),
      riotId: `${name.gameName}#${name.tagLine}`,
      tier,
      lp: Math.round(lp),
      wins: Math.round(games * wr),
      losses: games - Math.round(games * wr),
      profileIconId: r.int(4800, 6200),
      topChampionIds: r.shuffle(byRole(role)).slice(0, 3).map((c) => c.id),
    };
  });
}

/* ------------------------------------------------- champion stats & builds */

const GRADE_CUTS: [number, TierGrade][] = [
  [0.05, "S+"],
  [0.17, "S"],
  [0.42, "A"],
  [0.7, "B"],
  [0.9, "C"],
  [1, "D"],
];

const FEATURED_POPULARITY = [157, 238, 777, 84, 55, 103, 64, 92, 266, 122, 24, 234, 141, 517, 245];
const POPULAR = new Set([157, 238, 777, 84, 55, 103, 64, 92, 266, 222, 81, 145, 412, 117, 234, 141, 517, 245, 91, 122, 24, 875, 497, 99, 202]);

export function demoChampionStats(opts: { patch: string; role?: Role | null; rank?: string | null; region?: string | null }): ChampionStat[] {
  const rows: ChampionStat[] = [];
  const flavor = `${opts.patch}:${opts.rank ?? "all"}:${opts.region ?? "all"}`;
  for (const c of champs) {
    for (const role of c.roles) {
      if (opts.role && role !== opts.role) continue;
      const r = rng(`stat:${c.id}:${role}:${flavor}`);
      const base = rng(`statbase:${c.id}:${role}`);
      const main = c.roles[0] === role;
      let winRate = 0.5 + base.normal(0, 0.016) + r.normal(0, 0.006);
      let pickRate = (POPULAR.has(c.id) ? base.float(0.07, 0.16) : base.float(0.006, 0.06)) * (main ? 1 : 0.35) * r.float(0.9, 1.1);
      const banRate = (POPULAR.has(c.id) ? base.float(0.06, 0.32) : base.float(0.002, 0.06)) * r.float(0.85, 1.15);
      // Featured order mirrors the NEXUS design reference (Yasuo, Zed, Yone, Akali, Katarina …).
      const featuredRank = FEATURED_POPULARITY.indexOf(c.id);
      if (featuredRank >= 0 && main) pickRate = 0.2 - featuredRank * 0.006;
      if (c.id === 157 && role === "MIDDLE") winRate = 0.54;
      const games = Math.round(pickRate * 260_000);
      rows.push({ championId: c.id, role, tier: "B", winRate, pickRate, banRate, games, kda: Number((2.1 + (winRate - 0.47) * 18 + r.float(-0.2, 0.3)).toFixed(2)) });
    }
  }
  return gradeStats(rows);
}

/** Assigns S+…D per role from a composite score (win rate, popularity, presence). */
export function gradeStats(rows: ChampionStat[]): ChampionStat[] {
  const byRoleRows = new Map<Role, ChampionStat[]>();
  for (const row of rows) {
    const list = byRoleRows.get(row.role) ?? [];
    list.push(row);
    byRoleRows.set(row.role, list);
  }
  for (const list of byRoleRows.values()) {
    const scored = list
      .map((row) => ({ row, score: (row.winRate - 0.5) * 100 * 1.6 + Math.sqrt(row.pickRate) * 18 + row.banRate * 6 - (row.games < 1500 ? 3 : 0) }))
      .sort((a, b) => b.score - a.score);
    scored.forEach(({ row }, i) => {
      const q = (i + 1) / scored.length;
      row.tier = GRADE_CUTS.find(([cut]) => q <= cut)![1];
    });
  }
  return rows;
}

export function demoChampionBuild(championId: number, role: Role | null, patch: string): ChampionBuild | null {
  const c = champById.get(championId);
  if (!c) return null;
  const useRole = role && c.roles.includes(role) ? role : c.roles[0];
  const stats = demoChampionStats({ patch, role: useRole }).find((s) => s.championId === championId)!;
  const r = rng(`build:${championId}:${useRole}:${patch}`);
  const t = TEMPLATES[archetypeOf(c.key, useRole)];
  const wr = stats.winRate;
  const g = stats.games;
  const path = (items: number[], share: number, delta: number) => ({ items, games: Math.round(g * share), pickRate: share, winRate: wr + delta });
  const opponents = r.shuffle(byRole(useRole).filter((o) => o.id !== championId)).slice(0, 10);
  const skillPriority = t.skill;
  return {
    championId,
    role: useRole,
    patch,
    summary: stats,
    starting: t.starting.map((items, i) => path(items, i === 0 ? r.float(0.6, 0.85) : r.float(0.1, 0.3), r.float(-0.01, 0.01))),
    popular: path([t.boots[0], ...t.core], r.float(0.18, 0.34), r.float(-0.006, 0.006)),
    highestWinRate: path([t.boots[0], ...t.alt], r.float(0.04, 0.09), r.float(0.015, 0.035)),
    boots: t.boots.map((id, i) => path([id], i === 0 ? r.float(0.55, 0.8) : r.float(0.05, 0.2), r.float(-0.01, 0.015))),
    situational: t.situational.filter((id) => ITEMS[id]).map((itemId) => ({ itemId, winRate: wr + r.float(-0.02, 0.03), pickRate: r.float(0.05, 0.4) })),
    runes: t.runes.map((page, i) => ({ ...page, games: Math.round(g * (i === 0 ? r.float(0.55, 0.8) : r.float(0.1, 0.3))), winRate: wr + r.float(-0.01, 0.015) })),
    spells: ROLE_SPELLS[useRole].map((ids, i) => ({ ids, games: Math.round(g * (i === 0 ? 0.82 : 0.14)), winRate: wr + r.float(-0.01, 0.01) })),
    skillOrder: { priority: skillPriority, sequence: skillSequence(skillPriority), winRate: wr + 0.004 },
    counters: opponents.slice(0, 5).map((o) => ({ opponentId: o.id, games: r.int(400, 4000), winRate: r.float(0.43, 0.48) })),
    favorable: opponents.slice(5).map((o) => ({ opponentId: o.id, games: r.int(400, 4000), winRate: r.float(0.52, 0.57) })),
  };
}

export function demoPatches(currentDdragonVersion: string): string[] {
  const [major, minor] = currentDdragonVersion.split(".").map(Number);
  return [0, 1, 2, 3].map((d) => `${major}.${Math.max(1, minor - d)}`);
}

/* ----------------------------------------------------------- pro players */

export function demoProPlayers(): ProPlayer[] {
  const roster: [string, string, string, string, Role, string, string[]][] = [
    ["Kaizen", "Lukas Brenner", "Void Wolves", "EMEA Masters (demo)", "MIDDLE", "DE", ["Yasuo", "Ahri", "Sylas"]],
    ["Ravenna", "Marta Kowalczyk", "Void Wolves", "EMEA Masters (demo)", "BOTTOM", "PL", ["Kaisa", "Jinx", "Ezreal"]],
    ["Tetsu", "Haruto Mori", "Void Wolves", "EMEA Masters (demo)", "TOP", "JP", ["Aatrox", "Jax", "Renekton"]],
    ["Grimbark", "Oskar Lind", "Void Wolves", "EMEA Masters (demo)", "JUNGLE", "SE", ["LeeSin", "Viego", "Kayn"]],
    ["Lumi", "Elena Rossi", "Void Wolves", "EMEA Masters (demo)", "UTILITY", "IT", ["Thresh", "Rakan", "Nautilus"]],
    ["Seraph", "Mateo Álvarez", "Arcane Union", "EMEA Masters (demo)", "MIDDLE", "ES", ["Orianna", "Syndra", "Azir"]],
    ["Hollow", "Jonas Vermeer", "Arcane Union", "EMEA Masters (demo)", "JUNGLE", "NL", ["Sejuani", "Vi", "XinZhao"]],
    ["Brakk", "Tomáš Novák", "Arcane Union", "EMEA Masters (demo)", "TOP", "CZ", ["KSante", "Ornn", "Gnar"]],
    ["Quill", "Adrien Morel", "Arcane Union", "EMEA Masters (demo)", "BOTTOM", "FR", ["Zeri", "Aphelios", "Varus"]],
    ["Mistral", "Noah Keller", "Arcane Union", "EMEA Masters (demo)", "UTILITY", "CH", ["Nami", "Lulu", "Milio"]],
    ["Jinsoo", "Park Jin-soo", "Neon Tide", "Pacific Open (demo)", "MIDDLE", "KR", ["Zed", "Akali", "LeBlanc"]],
    ["Hayate", "Sato Ren", "Neon Tide", "Pacific Open (demo)", "JUNGLE", "JP", ["Nidalee", "Elise", "Graves"]],
    ["Orion", "Daniel Hart", "Starfall", "Americas Cup (demo)", "BOTTOM", "US", ["Draven", "Lucian", "Kalista"]],
    ["Vesper", "Camila Souza", "Starfall", "Americas Cup (demo)", "TOP", "BR", ["Riven", "Fiora", "Camille"]],
    ["Corvid", "Liam Walsh", "Starfall", "Americas Cup (demo)", "UTILITY", "CA", ["Pyke", "Bard", "Blitzcrank"]],
  ];
  return roster.map(([handle, realName, team, league, role, country, keys]) => ({
    handle,
    realName,
    team,
    league,
    role,
    country,
    riotId: `${handle}#PRO`,
    platform: league.startsWith("Pacific") ? "kr" : league.startsWith("Americas") ? "na1" : "euw1",
    signatureChampionIds: keys.map((k) => (k === "LeBlanc" ? 7 : champ(k)?.id ?? 157)),
  }));
}

export function demoChampionList(): ChampionInfo[] {
  return champs;
}

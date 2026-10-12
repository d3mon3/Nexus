/**
 * Builds the aggregated champion dataset behind the Tier List, Champions and Builds pages.
 *
 *   npm run aggregate -- --platform euw1 --players 60 --matches 15
 *
 * Requires a Riot key (RIOT_API_KEY or the one saved from /admin) and DATABASE_URL. It walks the apex ladder, pulls recent ranked
 * solo matches (+ timelines for item and skill order), and stores per champion/role
 * counters. Re-runs are idempotent: already-counted matches are skipped. With a
 * development key (100 requests / 2 min) expect roughly 40 matches per minute.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { resolveRegion } from "../lib/regions";
import { ITEMS } from "../lib/static-data";
import type { Role } from "../lib/types";
import { env } from "../server/env";
import * as riot from "../server/riot/endpoints";
import { patchFromVersion } from "../server/riot/mappers";
import type { RiotMatch, RiotTimeline } from "../server/riot/schemas";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const BOOTS = new Set([3006, 3009, 3020, 3047, 3111, 3158, 3117]);
const STARTERS = new Set([1054, 1055, 1056, 1082, 1083, 2003, 2031, 3865, 1101, 1102, 1103]);
const CONSUMABLE = new Set([2003, 2031, 2055, 3340, 3363, 3364]);
const ROLES = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

type Counter = Record<string, { games: number; wins: number }>;
interface Bucket {
  games: number;
  wins: number;
  bans: number;
  kills: number;
  deaths: number;
  assists: number;
  builds: { core: Counter; starting: Counter; boots: Counter; items: Counter; runes: Counter; spells: Counter; skills: Counter; matchups: Counter };
}

const bump = (c: Counter, key: string, win: boolean) => {
  const e = (c[key] ??= { games: 0, wins: 0 });
  e.games++;
  if (win) e.wins++;
};

function emptyBucket(): Bucket {
  return { games: 0, wins: 0, bans: 0, kills: 0, deaths: 0, assists: 0, builds: { core: {}, starting: {}, boots: {}, items: {}, runes: {}, spells: {}, skills: {}, matchups: {} } };
}

/** Item purchase order and skill level-up order per participant, from the timeline. */
function timelineOrders(tl: RiotTimeline | null) {
  const items = new Map<number, number[]>();
  const skills = new Map<number, number[]>();
  for (const f of tl?.info.frames ?? [])
    for (const e of f.events) {
      if (!e.participantId) continue;
      if (e.type === "ITEM_PURCHASED" && e.itemId) (items.get(e.participantId) ?? items.set(e.participantId, []).get(e.participantId)!).push(e.itemId);
      if (e.type === "ITEM_UNDO" && e.itemId) items.get(e.participantId)?.pop();
      if (e.type === "SKILL_LEVEL_UP" && e.skillSlot) (skills.get(e.participantId) ?? skills.set(e.participantId, []).get(e.participantId)!).push(e.skillSlot);
    }
  return { items, skills };
}

function skillPriority(levels: number[]): string | null {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const maxedAt: Record<number, number> = {};
  levels.forEach((slot, i) => {
    if (slot > 3) return;
    counts[slot]++;
    if (counts[slot] === 5) maxedAt[slot] = i;
  });
  const order = [1, 2, 3].sort((a, b) => (maxedAt[a] ?? 99 + (5 - counts[a])) - (maxedAt[b] ?? 99 + (5 - counts[b])));
  return levels.length >= 9 ? order.map((s) => "QWE"[s - 1]).join("-") : null;
}

async function main() {
  const platform = arg("platform", process.env.NEXUS_DEFAULT_PLATFORM ?? "euw1");
  const region = resolveRegion(platform);
  if (!region) throw new Error(`Unknown platform ${platform}`);
  if (!env.riotApiKey || !process.env.DATABASE_URL) throw new Error("A Riot API key (RIOT_API_KEY or /admin) and DATABASE_URL are required.");
  const playerCount = Number(arg("players", "50"));
  const perPlayer = Number(arg("matches", "15"));
  const db = new PrismaClient();

  const ladders = await Promise.all((["challenger", "grandmaster", "master"] as const).map((t) => riot.apexLeague(region.platform, t)));
  const puuids = ladders.flatMap((l) => l.entries).sort((a, b) => b.leaguePoints - a.leaguePoints).slice(0, playerCount).map((e) => e.puuid);
  console.log(`Scanning ${puuids.length} apex players on ${region.label}…`);

  const buckets = new Map<string, Bucket>(); // `${patch}|${championId}|${role}`
  const matchCount = new Map<string, number>();
  const bansByPatch = new Map<string, number>();
  let added = 0;

  for (const [pi, puuid] of puuids.entries()) {
    const ids = await riot.matchIds(region, puuid, { count: perPlayer, queue: 420 }).catch(() => [] as string[]);
    for (const id of ids) {
      if (await db.aggregatedMatch.findUnique({ where: { matchId: id } })) continue;
      let m: RiotMatch;
      try {
        m = await riot.match(region, id);
      } catch {
        continue;
      }
      if (m.info.queueId !== 420 || m.info.gameDuration < 600) continue;
      const tl = await riot.matchTimeline(region, id).catch(() => null);
      const patch = patchFromVersion(m.info.gameVersion);
      const orders = timelineOrders(tl);
      const pidOf = new Map((tl?.info.participants ?? []).map((p) => [p.puuid, p.participantId]));

      for (const team of m.info.teams)
        for (const b of team.bans)
          if (b.championId > 0) {
            const key = `${patch}|${b.championId}|BAN`;
            (buckets.get(key) ?? buckets.set(key, emptyBucket()).get(key)!).bans++;
            bansByPatch.set(patch, (bansByPatch.get(patch) ?? 0) + 1);
          }

      for (const p of m.info.participants) {
        if (!ROLES.has(p.teamPosition)) continue;
        const role = p.teamPosition as Role;
        const key = `${patch}|${p.championId}|${role}`;
        const b = buckets.get(key) ?? buckets.set(key, emptyBucket()).get(key)!;
        b.games++;
        if (p.win) b.wins++;
        b.kills += p.kills;
        b.deaths += p.deaths;
        b.assists += p.assists;

        const pid = pidOf.get(p.puuid);
        const bought = (pid ? orders.items.get(pid) : undefined) ?? [];
        const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i) => i > 0 && !CONSUMABLE.has(i));
        const order = bought.length ? bought.filter((i, idx) => finalItems.includes(i) && bought.indexOf(i) === idx) : finalItems;
        const boots = order.find((i) => BOOTS.has(i));
        const core = order.filter((i) => !BOOTS.has(i) && !STARTERS.has(i) && ITEMS[i]).slice(0, 5);
        if (core.length >= 3) bump(b.builds.core, [boots ?? 0, ...core].filter(Boolean).join("-"), p.win);
        if (boots) bump(b.builds.boots, String(boots), p.win);
        for (const it of finalItems) if (!BOOTS.has(it)) bump(b.builds.items, String(it), p.win);
        const start = bought.slice(0, 4).filter((i) => STARTERS.has(i) || i === 1036);
        if (start.length) bump(b.builds.starting, start.join("-"), p.win);

        const styles = p.perks?.styles ?? [];
        if (styles.length >= 2) {
          const perks = [...styles[0].selections, ...styles[1].selections].map((s) => s.perk);
          const sp = p.perks?.statPerks;
          const shards = sp?.offense && sp?.flex && sp?.defense ? [sp.offense, sp.flex, sp.defense].join("-") : "";
          bump(b.builds.runes, `${styles[0].style}-${styles[1].style}|${perks.join("-")}|${shards}`, p.win);
        }
        bump(b.builds.spells, [p.summoner1Id, p.summoner2Id].sort((x, y) => x - y).join("-"), p.win);
        const prio = pid ? skillPriority(orders.skills.get(pid) ?? []) : null;
        if (prio) bump(b.builds.skills, prio, p.win);
        const opponent = m.info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition);
        if (opponent) bump(b.builds.matchups, String(opponent.championId), p.win);
      }
      matchCount.set(patch, (matchCount.get(patch) ?? 0) + 1);
      await db.aggregatedMatch.create({ data: { matchId: id, patch } });
      added++;
    }
    console.log(`  ${pi + 1}/${puuids.length} players · ${added} new matches`);
  }

  // Persist: merge counters into existing rows.
  for (const [key, b] of buckets) {
    const [patch, championIdStr, role] = key.split("|");
    if (role === "BAN") continue;
    const championId = Number(championIdStr);
    const bans = buckets.get(`${patch}|${championId}|BAN`)?.bans ?? 0;
    const where = { patch_platform_rankBand_championId_role: { patch, platform: region.platform, rankBand: "master", championId, role } };
    const existing = await db.championAggregate.findUnique({ where });
    const merged = existing ? mergeBuilds(existing.builds as Bucket["builds"], b.builds) : b.builds;
    const data = {
      games: (existing?.games ?? 0) + b.games,
      wins: (existing?.wins ?? 0) + b.wins,
      bans: (existing?.bans ?? 0) + bans,
      kills: (existing?.kills ?? 0) + b.kills,
      deaths: (existing?.deaths ?? 0) + b.deaths,
      assists: (existing?.assists ?? 0) + b.assists,
      builds: merged as unknown as Prisma.InputJsonValue,
    };
    await db.championAggregate.upsert({ where, create: { patch, platform: region.platform, rankBand: "master", championId, role, ...data }, update: data });
  }
  for (const [patch, matches] of matchCount) await db.aggregateRun.create({ data: { patch, platform: region.platform, rankBand: "master", matches, totalBans: bansByPatch.get(patch) ?? 0 } });
  console.log(`Done — ${added} matches added.`);
  await db.$disconnect();
}

function mergeBuilds(a: Bucket["builds"], b: Bucket["builds"]): Bucket["builds"] {
  const out = structuredClone(a);
  for (const k of Object.keys(b) as (keyof Bucket["builds"])[]) {
    out[k] ??= {};
    for (const [key, v] of Object.entries(b[k])) {
      const e = (out[k][key] ??= { games: 0, wins: 0 });
      e.games += v.games;
      e.wins += v.wins;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

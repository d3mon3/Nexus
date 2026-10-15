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
import { GAME_MODES } from "../lib/modes";
import { resolveRegion } from "../lib/regions";
import { ITEMS } from "../lib/static-data";
import type { Role } from "../lib/types";
import { env } from "../server/env";
import { getItemCatalog } from "../server/ddragon";
import { buildStyle, type ItemKind } from "../lib/item-kinds";
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

/** Item classes from Data Dragon (set in main). Empty → fall back to the static lists below. */
let KINDS: Record<number, ItemKind> = {};
let TAGS: Record<number, string[]> = {};
const isBoots = (i: number) => (KINDS[i] ? KINDS[i] === "boots" : BOOTS.has(i));
const isCore = (i: number) => (KINDS[i] ? KINDS[i] === "core" : !BOOTS.has(i) && !STARTERS.has(i) && Boolean(ITEMS[i]));
const isConsumable = (i: number) => (KINDS[i] ? KINDS[i] === "consumable" : CONSUMABLE.has(i));
interface Bucket {
  games: number;
  wins: number;
  bans: number;
  kills: number;
  deaths: number;
  assists: number;
  builds: { core: Counter; starting: Counter; boots: Counter; items: Counter; runes: Counter; spells: Counter; skills: Counter; matchups: Counter; augments: Counter };
}

const bump = (c: Counter, key: string, win: boolean) => {
  const e = (c[key] ??= { games: 0, wins: 0 });
  e.games++;
  if (win) e.wins++;
};

function emptyBucket(): Bucket {
  return { games: 0, wins: 0, bans: 0, kills: 0, deaths: 0, assists: 0, builds: { core: {}, starting: {}, boots: {}, items: {}, runes: {}, spells: {}, skills: {}, matchups: {}, augments: {} } };
}

/** Item purchase order and skill level-up order per participant, from the timeline. */
function timelineOrders(tl: RiotTimeline | null) {
  const items = new Map<number, number[]>();
  const starts = new Map<number, number[]>();
  const skills = new Map<number, number[]>();
  for (const f of tl?.info.frames ?? [])
    for (const e of f.events) {
      if (!e.participantId) continue;
      if (e.type === "ITEM_PURCHASED" && e.itemId) {
        (items.get(e.participantId) ?? items.set(e.participantId, []).get(e.participantId)!).push(e.itemId);
        // Starting items: everything bought in the first minute (before leaving the fountain).
        if (e.timestamp <= 60_000) (starts.get(e.participantId) ?? starts.set(e.participantId, []).get(e.participantId)!).push(e.itemId);
      }
      if (e.type === "ITEM_UNDO" && e.itemId) {
        items.get(e.participantId)?.pop();
        if (e.timestamp <= 60_000) starts.get(e.participantId)?.pop();
      }
      if (e.type === "SKILL_LEVEL_UP" && e.skillSlot) (skills.get(e.participantId) ?? skills.set(e.participantId, []).get(e.participantId)!).push(e.skillSlot);
    }
  return { items, starts, skills };
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

type Ctx = {
  buckets: Map<string, Bucket>; // `${patch}|${championId}|${role}`  (role "ANY" outside Summoner's Rift)
  matchCount: Map<string, number>;
  bansByPatch: Map<string, number>;
};
const newCtx = (): Ctx => ({ buckets: new Map(), matchCount: new Map(), bansByPatch: new Map() });

/** Adds one match to the counters. Summoner's Rift keeps lanes and matchups; other modes don't. */
function countMatch(ctx: Ctx, m: RiotMatch, tl: RiotTimeline | null, sr: boolean) {
  const patch = patchFromVersion(m.info.gameVersion);
  const orders = timelineOrders(tl);
  const pidOf = new Map((tl?.info.participants ?? []).map((p) => [p.puuid, p.participantId]));
  const { buckets } = ctx;

  for (const team of m.info.teams)
    for (const b of team.bans)
      if (b.championId > 0) {
        const key = `${patch}|${b.championId}|BAN`;
        (buckets.get(key) ?? buckets.set(key, emptyBucket()).get(key)!).bans++;
        ctx.bansByPatch.set(patch, (ctx.bansByPatch.get(patch) ?? 0) + 1);
      }

  for (const p of m.info.participants) {
    if (sr && !ROLES.has(p.teamPosition)) continue;
    const role = sr ? (p.teamPosition as Role) : "ANY";

    const pid = pidOf.get(p.puuid);
    const bought = (pid ? orders.items.get(pid) : undefined) ?? [];
    const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i) => i > 0 && !isConsumable(i));
    // Purchase order of the items still held at the end (components that were built into something are gone).
    const order = bought.length ? bought.filter((i, idx) => finalItems.includes(i) && bought.indexOf(i) === idx) : finalItems;
    for (const i of finalItems) if (!order.includes(i)) order.push(i);
    const boots = order.find(isBoots);
    const core = order.filter(isCore).slice(0, 6);
    const start = ((pid ? orders.starts.get(pid) : undefined) ?? []).filter((i) => !isCore(i));
    const styles = p.perks?.styles ?? [];
    const prio = pid ? skillPriority(orders.skills.get(pid) ?? []) : null;
    // Augments (Arena / ARAM Mayhem). In Arena a top-4 finish counts as a win.
    const augments = [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6].filter((a): a is number => Boolean(a && a > 0));
    const augmentWin = p.placement ? p.placement <= 4 : p.win;
    const opponent = sr ? m.info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition) : undefined;

    const record = (b: Bucket) => {
      b.games++;
      if (p.win) b.wins++;
      b.kills += p.kills;
      b.deaths += p.deaths;
      b.assists += p.assists;
      if (core.length >= (sr ? 2 : 1)) bump(b.builds.core, core.join("-"), p.win);
      if (boots) bump(b.builds.boots, String(boots), p.win);
      for (const it of finalItems) if (isCore(it)) bump(b.builds.items, String(it), p.win);
      if (start.length) bump(b.builds.starting, [...start].sort((x, y) => x - y).slice(0, 4).join("-"), p.win);
      if (styles.length >= 2 && styles[0].selections.length >= 4) {
        const perks = [...styles[0].selections, ...styles[1].selections].map((s) => s.perk);
        const sp = p.perks?.statPerks;
        const shards = sp?.offense && sp?.flex && sp?.defense ? [sp.offense, sp.flex, sp.defense].join("-") : "";
        bump(b.builds.runes, `${styles[0].style}-${styles[1].style}|${perks.join("-")}|${shards}`, p.win);
      }
      bump(b.builds.spells, [p.summoner1Id, p.summoner2Id].sort((x, y) => x - y).join("-"), p.win);
      if (prio) bump(b.builds.skills, prio, p.win);
      if (opponent) bump(b.builds.matchups, String(opponent.championId), p.win);
      for (const a of augments) bump(b.builds.augments, String(a), augmentWin);
    };

    const key = `${patch}|${p.championId}|${role}`;
    record(buckets.get(key) ?? buckets.set(key, emptyBucket()).get(key)!);
    // Build variant (AP / AD / on-hit / tank …) stored as its own row "ROLE~style".
    const style = Object.keys(TAGS).length ? buildStyle(core, (id) => TAGS[id]) : null;
    if (style) {
      const vkey = `${patch}|${p.championId}|${role}~${style}`;
      record(buckets.get(vkey) ?? buckets.set(vkey, emptyBucket()).get(vkey)!);
    }
  }
  ctx.matchCount.set(patch, (ctx.matchCount.get(patch) ?? 0) + 1);
  return patch;
}

async function persist(db: PrismaClient, ctx: Ctx, platform: string, rankBand: string) {
  for (const [key, b] of ctx.buckets) {
    const [patch, championIdStr, role] = key.split("|");
    if (role === "BAN") continue;
    const championId = Number(championIdStr);
    const bans = ctx.buckets.get(`${patch}|${championId}|BAN`)?.bans ?? 0;
    const where = { patch_platform_rankBand_championId_role: { patch, platform, rankBand, championId, role } };
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
    await db.championAggregate.upsert({ where, create: { patch, platform, rankBand, championId, role, ...data }, update: data });
  }
  for (const [patch, matches] of ctx.matchCount) await db.aggregateRun.create({ data: { patch, platform, rankBand, matches, totalBans: ctx.bansByPatch.get(patch) ?? 0 } });
}

async function main() {
  const platform = arg("platform", process.env.NEXUS_DEFAULT_PLATFORM ?? "euw1");
  const region = resolveRegion(platform);
  if (!region) throw new Error(`Unknown platform ${platform}`);
  if (!env.riotApiKey || !process.env.DATABASE_URL) throw new Error("A Riot API key (RIOT_API_KEY or /admin) and DATABASE_URL are required.");
  const playerCount = Number(arg("players", "50"));
  const perPlayer = Number(arg("matches", "15"));
  const modeTarget = Number(arg("mode-matches", "60"));
  const modes = arg("modes", "sr,aram,aram-mayhem,arena,urf").split(",").map((m) => m.trim()).filter(Boolean);
  const db = new PrismaClient();
  const catalog = await getItemCatalog().catch(() => ({ kinds: {}, tags: {} }));
  KINDS = catalog.kinds;
  TAGS = catalog.tags;
  console.log(`[items] ${Object.keys(KINDS).length} items classified from Data Dragon`);

  const ladders = await Promise.all((["challenger", "grandmaster", "master"] as const).map((t) => riot.apexLeague(region.platform, t)));
  // A fresh random sample every run, so repeated runs cover more players instead of the same top 40.
  const ladder = ladders
    .flatMap((l) => l.entries)
    .map((e) => ({ puuid: e.puuid, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((e) => e.puuid);

  const already = async (id: string) => Boolean(await db.aggregatedMatch.findUnique({ where: { matchId: id } }));

  /* Summoner's Rift ranked: players from every rank (Iron … Challenger), each rank stored as its own band. */
  if (modes.includes("sr")) {
    const bands: { band: string; tier: string | null }[] = [
      ...["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"].map((tier) => ({ band: tier.toLowerCase(), tier })),
      { band: "master", tier: null },
    ];
    const perBand = Math.max(3, Math.ceil(playerCount / bands.length));
    const divisions = ["I", "II", "III", "IV"];
    for (const { band, tier } of bands) {
      let puuids: string[];
      if (tier) {
        const division = divisions[Math.floor(Math.random() * divisions.length)];
        const page = 1 + Math.floor(Math.random() * 3);
        const entries = await riot.leagueEntriesByTier(region.platform, tier, division, page).catch(() => []);
        puuids = entries
          .map((e) => e.puuid)
          .filter((x): x is string => Boolean(x))
          .map((x) => ({ x, r: Math.random() }))
          .sort((a, b) => a.r - b.r)
          .map((e) => e.x)
          .slice(0, perBand);
      } else puuids = ladder.slice(0, perBand);
      const ctx = newCtx();
      let added = 0;
      console.log(`[sr:${band}] scanning ${puuids.length} players on ${region.label}…`);
      for (const puuid of puuids) {
        const ids = await riot.matchIds(region, puuid, { count: perPlayer, queue: 420 }).catch(() => [] as string[]);
        for (const id of ids) {
          if (await already(id)) continue;
          const m = await riot.match(region, id).catch(() => null);
          if (!m || m.info.queueId !== 420 || m.info.gameDuration < 600) continue;
          const tl = await riot.matchTimeline(region, id).catch(() => null);
          const patch = countMatch(ctx, m, tl, true);
          await db.aggregatedMatch.create({ data: { matchId: id, patch } });
          added++;
        }
      }
      if (ctx.matchCount.size) await persist(db, ctx, region.platform, band);
      console.log(`  ${band}: ${added} new matches`);
    }
  }

  /* Other modes: start from ladder players and follow the people met in each match
     (whoever plays ARAM tends to play it again), until enough matches are collected. */
  for (const modeId of modes.filter((m) => m !== "sr")) {
    const mode = GAME_MODES.find((m) => m.id === modeId);
    if (!mode) continue;
    const ctx = newCtx();
    const queue = [...ladder.slice(0, 25)];
    const seen = new Set<string>();
    let added = 0;
    let lookups = 0;
    console.log(`[${mode.id}] collecting up to ${modeTarget} matches…`);
    while (queue.length && added < modeTarget && lookups < modeTarget * 3) {
      const puuid = queue.shift()!;
      if (seen.has(puuid)) continue;
      seen.add(puuid);
      for (const q of mode.queues) {
        lookups++;
        const ids = await riot.matchIds(region, puuid, { count: 10, queue: q }).catch(() => [] as string[]);
        for (const id of ids) {
          if (added >= modeTarget) break;
          if (await already(id)) continue;
          const m = await riot.match(region, id).catch(() => null);
          if (!m || !mode.queues.includes(m.info.queueId) || m.info.gameDuration < 300) continue;
          const tl = await riot.matchTimeline(region, id).catch(() => null);
          const patch = countMatch(ctx, m, tl, false);
          await db.aggregatedMatch.create({ data: { matchId: id, patch } });
          added++;
          for (const p of m.info.participants) if (!seen.has(p.puuid)) queue.push(p.puuid);
        }
        if (ids.length) break; // found the active queue for this mode
      }
    }
    console.log(`  ${added} new ${mode.label} matches`);
    if (added) await persist(db, ctx, region.platform, mode.id);
  }

  console.log("Done.");
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

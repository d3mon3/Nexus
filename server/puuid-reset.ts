import "server-only";
import { clearMemoryCache } from "./cache";
import { getDb } from "./db";
import { env } from "./env";

/**
 * Riot encrypts PUUIDs per API project: a dev key and a personal/production key see the
 * same player under different PUUIDs. After switching projects every stored PUUID is
 * "foreign" and Riot answers 400 (Exception decrypting). This module detects that and
 * drops player data keyed by the old PUUIDs; champion statistics are kept.
 */

let lastCheck = 0;

async function samplePuuid(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const snap = await db.rankSnapshot.findFirst({ orderBy: { capturedAt: "desc" }, select: { puuid: true } }).catch(() => null);
  if (snap?.puuid) return snap.puuid;
  const acc = await db.cacheEntry.findFirst({ where: { key: { startsWith: "acc:" } }, select: { value: true } }).catch(() => null);
  const v = acc?.value as { puuid?: string } | undefined;
  return v?.puuid ?? null;
}

/** true when Riot can't decrypt this PUUID with the given key (= it belongs to another project). */
export async function isForeignPuuid(puuid: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`, {
      headers: { "X-Riot-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    return res.status === 400;
  } catch {
    return false;
  }
}

export async function purgePlayerData(): Promise<void> {
  clearMemoryCache();
  const db = await getDb();
  if (!db) return;
  await db.cacheEntry.deleteMany({}).catch(() => undefined);
  await db.matchLpChange.deleteMany({}).catch(() => undefined);
  await db.rankSnapshot.deleteMany({}).catch(() => undefined);
  await db.ladderSnapshot.deleteMany({}).catch(() => undefined);
  console.warn("[nexus] Riot API project changed — cleared player data stored under old PUUIDs.");
}

/** Called after a new key is saved: purges stale data when the key belongs to another project. */
export async function resetIfProjectChanged(key: string): Promise<boolean> {
  const puuid = await samplePuuid();
  if (!puuid || !(await isForeignPuuid(puuid, key))) return false;
  await purgePlayerData();
  return true;
}

/**
 * Self-healing for a 400 on a PUUID endpoint: if the PUUID is foreign to the current key,
 * purge and tell the caller to retry. Checked at most once a minute.
 */
export async function healForeignPuuid(puuid: string): Promise<boolean> {
  const key = env.riotApiKey;
  if (!key || Date.now() - lastCheck < 60_000) return false;
  lastCheck = Date.now();
  if (!(await isForeignPuuid(puuid, key))) return false;
  await purgePlayerData();
  return true;
}

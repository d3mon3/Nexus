import "server-only";
import { getDb } from "./db";

/**
 * Two-level cache: an in-process LRU for hot data, plus an optional Postgres table
 * (Prisma `CacheEntry`) so restarts of the desktop app or server don't burn rate limit.
 */

interface Entry {
  value: unknown;
  expires: number;
}

class LruCache {
  private map = new Map<string, Entry>();
  constructor(private max = 2000) {}

  get<T>(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh recency
    this.map.delete(key);
    this.map.set(key, e);
    return e.value as T;
  }

  set(key: string, value: unknown, ttlSec: number) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + ttlSec * 1000 });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear() {
    this.map.clear();
  }

  delete(prefix: string) {
    for (const key of this.map.keys()) if (key.startsWith(prefix)) this.map.delete(key);
  }
}

const memory = new LruCache();
const inflight = new Map<string, Promise<unknown>>();

export const TTL = {
  account: 60 * 60 * 24,
  summoner: 60 * 10,
  league: 60 * 3,
  mastery: 60 * 30,
  matchIds: 60 * 2,
  match: 60 * 60 * 24 * 30, // finished matches never change
  spectator: 20,
  leaderboard: 60 * 10,
  ddragon: 60 * 60 * 6,
} as const;

export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>, opts: { persist?: boolean } = {}): Promise<T> {
  const hit = memory.get<T>(key);
  if (hit !== undefined) return hit;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const task = (async () => {
    const db = opts.persist ? await getDb() : null;
    if (db) {
      const row = await db.cacheEntry.findUnique({ where: { key } }).catch(() => null);
      if (row && row.expiresAt.getTime() > Date.now()) {
        const value = row.value as T;
        memory.set(key, value, Math.max(1, (row.expiresAt.getTime() - Date.now()) / 1000));
        return value;
      }
    }
    const value = await load();
    memory.set(key, value, ttlSec);
    if (db) {
      const expiresAt = new Date(Date.now() + ttlSec * 1000);
      await db.cacheEntry
        .upsert({
          where: { key },
          create: { key, value: value as object, expiresAt },
          update: { value: value as object, expiresAt },
        })
        .catch(() => undefined);
    }
    return value;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/** Drop cached entries (used by the "refresh" buttons). */
export async function invalidate(prefix: string) {
  memory.delete(prefix);
  const db = await getDb();
  if (db) await db.cacheEntry.deleteMany({ where: { key: { startsWith: prefix } } }).catch(() => undefined);
}

/** Empties the in-process cache (used when the Riot API project changes). */
export function clearMemoryCache() {
  memory.clear();
}

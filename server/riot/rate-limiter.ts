/**
 * Sliding-window rate limiter that mirrors Riot's limits. Riot enforces app limits
 * per routing host (euw1, europe …) with several windows at once, e.g. "20:1,100:120"
 * for a development key. Limits are learned from the X-App-Rate-Limit /
 * X-Method-Rate-Limit response headers, starting from the dev-key defaults.
 */

export interface Window {
  limit: number;
  seconds: number;
}

export function parseLimitHeader(value: string | null | undefined): Window[] | null {
  if (!value) return null;
  const windows = value
    .split(",")
    .map((part) => part.trim().split(":").map(Number))
    .filter(([limit, seconds]) => Number.isFinite(limit) && Number.isFinite(seconds) && limit > 0 && seconds > 0)
    .map(([limit, seconds]) => ({ limit, seconds }));
  return windows.length ? windows : null;
}

/**
 * Fraction of the key's limit this process may use (RIOT_RATE_SHARE, e.g. 0.6 for the
 * background aggregator so the website keeps the rest).
 */
const SHARE = (() => {
  const v = Number(typeof process !== "undefined" ? process.env?.RIOT_RATE_SHARE : NaN);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1;
})();

const DEV_KEY_LIMITS: Window[] = [
  { limit: 20, seconds: 1 },
  { limit: 100, seconds: 120 },
];

type Clock = { now(): number; sleep(ms: number): Promise<void> };
const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

class Bucket {
  private stamps: number[] = [];
  blockedUntil = 0;
  constructor(public windows: Window[]) {}

  /** Milliseconds to wait before another request fits in every window. */
  waitTime(now: number): number {
    if (this.blockedUntil > now) return this.blockedUntil - now;
    const longest = Math.max(...this.windows.map((w) => w.seconds)) * 1000;
    this.stamps = this.stamps.filter((t) => now - t < longest);
    let wait = 0;
    for (const w of this.windows) {
      const span = w.seconds * 1000;
      const inWindow = this.stamps.filter((t) => now - t < span);
      // Keep a 5% safety margin so clock skew doesn't trip a 429.
      const cap = Math.max(1, Math.floor(w.limit * 0.95 * SHARE));
      if (inWindow.length >= cap) {
        const oldest = inWindow[inWindow.length - cap];
        wait = Math.max(wait, span - (now - oldest) + 10);
      }
    }
    return wait;
  }

  record(now: number) {
    this.stamps.push(now);
  }
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private queues = new Map<string, Promise<void>>();

  constructor(
    private defaults: Window[] = DEV_KEY_LIMITS,
    private clock: Clock = realClock,
  ) {}

  private bucket(key: string): Bucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = new Bucket(this.defaults);
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Resolves once a request to `key` may be sent. Calls for the same key are serialized. */
  acquire(key: string): Promise<void> {
    const prev = this.queues.get(key) ?? Promise.resolve();
    const next = prev.then(async () => {
      const b = this.bucket(key);
      for (;;) {
        const wait = b.waitTime(this.clock.now());
        if (wait <= 0) break;
        await this.clock.sleep(wait);
      }
      b.record(this.clock.now());
    });
    this.queues.set(key, next.catch(() => undefined));
    return next;
  }

  /** Update limits from response headers. */
  learn(key: string, header: string | null) {
    const windows = parseLimitHeader(header);
    if (windows) this.bucket(key).windows = windows;
  }

  /** Pause a key after a 429. */
  block(key: string, retryAfterSec: number) {
    const b = this.bucket(key);
    b.blockedUntil = Math.max(b.blockedUntil, this.clock.now() + retryAfterSec * 1000);
  }
}

export const riotLimiter = new RateLimiter();

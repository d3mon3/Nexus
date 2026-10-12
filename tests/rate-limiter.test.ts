import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLimitHeader, RateLimiter } from "../server/riot/rate-limiter";

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms), get time() { return t; } };
}

test("parses Riot rate limit headers", () => {
  assert.deepEqual(parseLimitHeader("20:1,100:120"), [{ limit: 20, seconds: 1 }, { limit: 100, seconds: 120 }]);
  assert.equal(parseLimitHeader(""), null);
  assert.equal(parseLimitHeader("x:y"), null);
});

test("never exceeds any window", async () => {
  const clock = fakeClock();
  const limiter = new RateLimiter([{ limit: 10, seconds: 1 }, { limit: 30, seconds: 10 }], clock);
  const stamps: number[] = [];
  for (let i = 0; i < 60; i++) {
    await limiter.acquire("euw1.api.riotgames.com");
    stamps.push(clock.time);
  }
  for (const [limit, span] of [[10, 1000], [30, 10000]]) {
    for (const t of stamps) {
      const inWindow = stamps.filter((s) => s >= t && s < t + span).length;
      assert.ok(inWindow <= limit, `window ${span}ms had ${inWindow} > ${limit}`);
    }
  }
  // 60 requests at 30/10s needs at least ~10s of waiting
  assert.ok(clock.time >= 10_000, `took ${clock.time}`);
});

test("hosts are limited independently and 429 blocks", async () => {
  const clock = fakeClock();
  const limiter = new RateLimiter([{ limit: 2, seconds: 1 }], clock);
  await limiter.acquire("a");
  await limiter.acquire("b");
  assert.equal(clock.time, 0);
  limiter.block("a", 5);
  await limiter.acquire("a");
  assert.ok(clock.time >= 5000);
});

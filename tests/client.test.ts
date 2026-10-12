import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { riotRequest, RiotApiError } from "../server/riot/client";
import { RateLimiter } from "../server/riot/rate-limiter";

const schema = z.object({ ok: z.boolean() });
const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(responses: (Response | Error)[]) {
  const calls: { url: string; key: string | null }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, key: new Headers(init?.headers).get("X-Riot-Token") });
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  let t = 0;
  const clock = { now: () => t, sleep: async (ms: number) => void (t += ms) };
  const limiter = new RateLimiter([{ limit: 100, seconds: 1 }], clock);
  return { calls, opts: { apiKey: "RGAPI-test", fetchImpl, limiter, sleep: clock.sleep } };
}

test("sends key in header and validates", async () => {
  const { calls, opts } = setup([res(200, { ok: true })]);
  const data = await riotRequest("https://euw1.api.riotgames.com/x", schema, opts);
  assert.deepEqual(data, { ok: true });
  assert.equal(calls[0].key, "RGAPI-test");
  assert.ok(!calls[0].url.includes("RGAPI"));
});

test("retries 429 and 5xx then succeeds", async () => {
  const { calls, opts } = setup([res(429, {}, { "retry-after": "1" }), res(503, {}), res(200, { ok: true })]);
  assert.deepEqual(await riotRequest("https://europe.api.riotgames.com/x", schema, opts), { ok: true });
  assert.equal(calls.length, 3);
});

test("404 allowed returns null; otherwise throws", async () => {
  const a = setup([res(404, {})]);
  assert.equal(await riotRequest("https://euw1.api.riotgames.com/x", schema, { ...a.opts, allowNotFound: true }), null);
  const b = setup([res(404, {})]);
  await assert.rejects(riotRequest("https://euw1.api.riotgames.com/x", schema, b.opts), (e: RiotApiError) => e.status === 404);
});

test("bad shape becomes 502, network errors retry", async () => {
  const a = setup([res(200, { nope: 1 })]);
  await assert.rejects(riotRequest("https://euw1.api.riotgames.com/x", schema, a.opts), (e: RiotApiError) => e.status === 502);
  const b = setup([new Error("ECONNRESET"), res(200, { ok: true })]);
  assert.deepEqual(await riotRequest("https://euw1.api.riotgames.com/x", schema, b.opts), { ok: true });
});

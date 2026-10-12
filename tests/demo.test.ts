import assert from "node:assert/strict";
import { test } from "node:test";
import { demoChampionBuild, demoChampionStats, demoLeaderboard, demoLiveGame, demoMatchDetail, demoMatchSummaries, demoProfile, demoPuuid, decodeDemoPuuid } from "../server/demo";
import { skillSequence } from "../server/demo/archetypes";
import { computePlayerStats } from "../server/services/stats";
import { TIER_GRADES } from "../lib/types";

const puuid = demoPuuid("d3monek", "EUW");

test("demo puuid round-trips", () => {
  assert.deepEqual(decodeDemoPuuid(puuid), { gameName: "d3monek", tagLine: "EUW" });
  assert.deepEqual(decodeDemoPuuid(demoPuuid("Zażółć gęś", "PL1")), { gameName: "Zażółć gęś", tagLine: "PL1" });
});

test("featured profile matches the design reference", () => {
  const p = demoProfile("d3monek", "EUW", "euw1");
  assert.equal(p.account.summonerLevel, 358);
  assert.deepEqual(p.ranked[0], { queue: "RANKED_SOLO_5x5", tier: "DIAMOND", division: "II", lp: 1, wins: 289, losses: 248, hotStreak: false });
  const { matches } = demoMatchSummaries(puuid, "euw1", { start: 0, count: 5 });
  assert.deepEqual(matches.map((m) => [m.me.kills, m.me.deaths, m.me.assists, m.me.win, m.lpChange]), [
    [12, 4, 8, true, 24], [6, 8, 5, false, -22], [15, 6, 9, true, 26], [9, 3, 6, true, 21], [3, 7, 4, false, -19],
  ]);
  const last20 = demoMatchSummaries(puuid, "euw1", { start: 0, count: 20 }).matches;
  assert.equal(last20.filter((m) => m.me.win).length, 12);
  // chronological order: newest first
  for (let i = 1; i < last20.length; i++) assert.ok(last20[i - 1].gameCreation > last20[i].gameCreation);
});

test("match details are deterministic and consistent with summaries", () => {
  const { matches } = demoMatchSummaries(puuid, "euw1", { start: 30, count: 10, queueIds: [420] });
  for (const s of matches) {
    const d1 = demoMatchDetail(s.matchId)!;
    const d2 = demoMatchDetail(s.matchId)!;
    assert.deepEqual(d1, d2);
    assert.equal(d1.participants.length, 10);
    assert.equal(new Set(d1.participants.map((p) => p.championId)).size, 10);
    assert.deepEqual(d1.me, s.me);
    assert.equal(s.queueId, 420);
  }
});

test("filters work", () => {
  const wins = demoMatchSummaries(puuid, "euw1", { start: 0, count: 50, result: "win" });
  assert.ok(wins.matches.every((m) => m.me.win));
  const yasuo = demoMatchSummaries(puuid, "euw1", { start: 0, count: 50, championId: 157 });
  assert.ok(yasuo.matches.length > 0 && yasuo.matches.every((m) => m.me.championId === 157));
});

test("stats are computed from matches", () => {
  const ids = demoMatchSummaries(puuid, "euw1", { start: 0, count: 20 }).matches.map((m) => demoMatchDetail(m.matchId)!);
  const s = computePlayerStats(ids, puuid);
  assert.equal(s.games, 20);
  assert.equal(s.wins, 12);
  assert.equal(s.timeline.length, 20);
  assert.equal(s.radar.length, 6);
  assert.ok(s.radar.every((r) => r.value >= 0 && r.value <= 100));
  assert.equal(s.timeline.at(-1)!.cumulativeLp, ids.reduce((sum, m) => sum + (m.lpChange ?? 0), 0));
});

test("live game, ladder, champion stats and builds", () => {
  const live = demoLiveGame(puuid)!;
  assert.equal(live.participants.length, 10);
  assert.equal(live.participants.filter((p) => p.teamId === 100).length, 5);
  const ladder = demoLeaderboard("euw1");
  assert.ok(ladder.every((e, i) => i === 0 || ladder[i - 1].lp >= e.lp));
  const stats = demoChampionStats({ patch: "15.20", role: "MIDDLE" });
  assert.ok(stats.length > 20);
  for (const g of TIER_GRADES) assert.ok(stats.some((s) => s.tier === g), `grade ${g} missing`);
  const b = demoChampionBuild(157, "MIDDLE", "15.20")!;
  assert.equal(b.popular.items.length, 6);
  assert.equal(b.skillOrder.sequence.length, 18);
  assert.deepEqual(skillSequence(["Q", "E", "W"]).filter((x) => x === "R").length, 3);
});

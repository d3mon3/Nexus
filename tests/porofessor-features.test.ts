import assert from "node:assert/strict";
import { test } from "node:test";
import { itemAlerts } from "../lib/enemy-items";
import { ratePlayers } from "../lib/performance";
import { compWarnings } from "../lib/team-comp";
import type { ChampionInfo, ParticipantSummary } from "../lib/types";

const champ = (tags: string[], info?: ChampionInfo["info"]): ChampionInfo => ({ id: Math.random(), key: "x", name: "x", title: "", roles: [], tags, info });

test("team comp: all-AD team without a tank gets both warnings", () => {
  const ad = [champ(["Marksman"], { attack: 9, defense: 2, magic: 1 }), champ(["Assassin"], { attack: 8, defense: 3, magic: 1 }), champ(["Fighter"], { attack: 8, defense: 4, magic: 1 }), champ(["Marksman"], { attack: 8, defense: 3, magic: 2 })];
  const ids = compWarnings(ad, []).map((w) => w.id);
  assert.ok(ids.includes("all-ad"));
  assert.ok(ids.includes("no-frontline"));
  const mixed = [...ad.slice(0, 3), champ(["Mage"], { attack: 2, defense: 3, magic: 9 }), champ(["Tank"], { attack: 4, defense: 9, magic: 4 })];
  assert.deepEqual(compWarnings(mixed, []).map((w) => w.id), []);
});

test("enemy item alerts: Zhonya alerts at once, armor only when stacked", () => {
  const a = itemAlerts([{ championName: "Ahri", items: [3157, 0, 0, 0, 0, 0] }, { championName: "Malphite", items: [3075, 3143, 0, 0, 0, 0] }]);
  const ids = a.map((x) => x.rule.id);
  assert.ok(ids.includes("stasis"));
  assert.ok(ids.includes("antiheal")); // Thornmail
  assert.ok(!ids.includes("armor"));
  const b = itemAlerts([{ championName: "Malphite", items: [3075, 3143, 3110, 0, 0, 0] }]);
  assert.ok(b.some((x) => x.rule.id === "armor"));
});

test("ratings: one MVP on the winners, one ACE on the losers, 0–10 scores", () => {
  const p = (puuid: string, teamId: 100 | 200, win: boolean, k: number, d: number, a: number): ParticipantSummary => ({
    puuid, riotId: `${puuid}#X`, championId: 1, championName: "A", teamId, role: "MIDDLE", kills: k, deaths: d, assists: a, cs: 200, gold: 12000, damageToChampions: 20000 + k * 1000,
    damageTaken: 15000, visionScore: 20, wardsPlaced: 8, champLevel: 16, items: [0, 0, 0, 0, 0, 0, 0] as never, spells: [4, 14], primaryRune: 0, secondaryStyle: 0, win,
  });
  const players = [p("a", 100, true, 12, 1, 8), p("b", 100, true, 2, 5, 4), p("c", 200, false, 6, 4, 2), p("d", 200, false, 1, 9, 1)];
  const r = ratePlayers(players, 1800);
  assert.equal(r.find((x) => x.badge === "MVP")?.puuid, "a");
  assert.equal(r.find((x) => x.badge === "ACE")?.puuid, "c");
  assert.ok(r.every((x) => x.score >= 0 && x.score <= 10));
});

test("augment tiers: small samples are shrunk, best first", async () => {
  const { augmentTiers } = await import("../lib/augment-tiers");
  const list = augmentTiers({ "1": { games: 200, wins: 130 }, "2": { games: 6, wins: 6 }, "3": { games: 300, wins: 120 }, "4": { games: 2, wins: 2 } }, 400);
  assert.equal(list[0].id, 1);
  assert.ok(!list.some((a) => a.id === 4)); // below the minimum
  assert.equal(list[list.length - 1].id, 3);
});

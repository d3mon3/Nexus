import assert from "node:assert/strict";
import { test } from "node:test";
import { getLang, setLang, t } from "../lib/i18n-core";
import { modeForQueue, modeInfo } from "../lib/modes";
import { toItemSet, toRunePage } from "../lib/client-import";
import { computeInsights } from "../server/services/insights";
import type { ChampionBuild, MatchDetail, ParticipantSummary } from "../lib/types";

test("game modes come from the queue id, with gameMode as fallback", () => {
  assert.equal(modeForQueue(420), "sr");
  assert.equal(modeForQueue(450), "aram");
  assert.equal(modeForQueue(2400), "aram-mayhem");
  assert.equal(modeForQueue(1700), "arena");
  assert.equal(modeForQueue(9999, "KIWI"), "aram-mayhem");
  assert.equal(modeForQueue(null, null), "sr");
  assert.equal(modeInfo("aram").itemSetMap, "HA");
});

test("t() translates to Polish, interpolates, handles plurals and passes non-strings through", () => {
  const prev = getLang();
  setLang("pl");
  assert.equal(t("Victory"), "Zwycięstwo");
  assert.equal(t("Level {0}", [7]), "Poziom 7");
  assert.equal(t("{0} games", [1]), "1 gra");
  assert.equal(t("{0} games", [3]), "3 gry");
  assert.equal(t("{0} games", [12]), "12 gier");
  assert.equal(t("{0} games", [22]), "22 gry");
  assert.equal(t("Computed from the last 20 matches."), "Wyliczone z ostatnich 20 meczów.");
  assert.equal(t("OTP Yasuo"), "OTP Yasuo");
  assert.equal(t("Some unknown text"), "Some unknown text");
  assert.equal(t(42), 42);
  setLang("en");
  assert.equal(t("Victory"), "Victory");
  assert.equal(t("Level {0}", [7]), "Level 7");
  setLang(prev);
});

const build = {
  championId: 157,
  role: "MIDDLE",
  patch: "25.20",
  summary: { championId: 157, role: "MIDDLE", tier: "S", winRate: 0.52, pickRate: 0.1, banRate: 0.2, games: 100, kda: 2.5 },
  starting: [],
  popular: { items: [3006, 6673, 3031], games: 10, winRate: 0.5, pickRate: 0.5 },
  highestWinRate: { items: [3006, 6673, 3031], games: 10, winRate: 0.5, pickRate: 0.5 },
  boots: [],
  situational: [],
  runes: [{ primaryStyle: 8000, subStyle: 8400, perks: [8010, 9111, 9104, 8299, 8444, 8242], shards: [5008, 5008, 5011], games: 10, winRate: 0.5 }],
  spells: [{ ids: [4, 14], games: 10, winRate: 0.5 }],
  skillOrder: { priority: ["Q", "E", "W"], sequence: [], winRate: 0.5 },
  counters: [],
  favorable: [],
} as unknown as ChampionBuild;

test("ARAM item sets target Howling Abyss and name the mode", () => {
  const set = toItemSet(build, "Yasuo", "uid", "aram");
  assert.equal(set.map, "HA");
  assert.deepEqual(set.associatedMaps, [12]);
  assert.match(set.title, /ARAM/);
  assert.match(toRunePage(build, "Yasuo", "aram")!.name, /ARAM/);
  assert.equal(toItemSet(build, "Yasuo", "uid").map, "SR");
});

function p(over: Partial<ParticipantSummary>): ParticipantSummary {
  return {
    puuid: "x", riotId: "x#1", championId: 157, championName: "Yasuo", teamId: 100, role: "MIDDLE", kills: 5, deaths: 5, assists: 5, cs: 180, gold: 11000,
    damageToChampions: 20000, damageTaken: 20000, visionScore: 20, wardsPlaced: 8, champLevel: 15, items: { items: [], trinket: 0 }, spells: [4, 14], primaryRune: 8010, secondaryStyle: 8400, win: false,
    ...over,
  };
}

test("insights compare the player with lane opponents", () => {
  const matches: MatchDetail[] = Array.from({ length: 8 }, (_, i) => {
    const me = p({ puuid: "me", cs: 150, deaths: 8, win: i % 3 === 0 });
    const opp = p({ puuid: `o${i}`, teamId: 200, cs: 230, deaths: 4, championId: 103, championName: "Ahri" });
    return {
      matchId: `M${i}`, queueId: 420, queueName: "Ranked Solo/Duo", gameCreation: Date.UTC(2026, 9, 1 + i, 18), durationSec: 30 * 60, patch: "25.20", me, lpChange: null,
      teams: [], participants: [me, opp], objectives: [],
    } as MatchDetail;
  });
  const ins = computeInsights(matches, "me", "UTC");
  const ids = ins.map((i) => i.id);
  assert.ok(ids.includes("cs-low"), ids.join(","));
  assert.ok(ids.includes("deaths-high"));
  assert.equal(ins[0].tone, "bad");
  assert.equal(computeInsights(matches.slice(0, 3), "me").length, 0);
});

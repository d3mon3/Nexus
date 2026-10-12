import assert from "node:assert/strict";
import { test } from "node:test";
import { roleFromAssigned, toItemSet, toRunePage, toSpells } from "../lib/client-import";
import { demoChampionBuild, demoMatchDetail, demoMatchSummaries, demoPuuid } from "../server/demo";
import { computeScout } from "../server/services/scout-compute";

const build = demoChampionBuild(157, "MIDDLE", "15.20")!;

test("rune page has 9 perks and a NEXUS name", () => {
  const page = toRunePage(build, "Yasuo")!;
  assert.equal(page.selectedPerkIds.length, 9);
  assert.equal(page.primaryStyleId, build.runes[0].primaryStyle);
  assert.ok(page.name.startsWith("NEXUS Yasuo"));
  assert.ok(page.name.length <= 32);
  assert.equal(toRunePage({ ...build, runes: [{ ...build.runes[0], shards: [] }] }, "Yasuo")!.selectedPerkIds.slice(6).length, 3);
});

test("flash goes on the chosen key", () => {
  const b = { ...build, spells: [{ ids: [4, 14] as [number, number], games: 1, winRate: 0.5 }] };
  assert.deepEqual(toSpells(b, "D"), { spell1Id: 4, spell2Id: 14 });
  assert.deepEqual(toSpells(b, "F"), { spell1Id: 14, spell2Id: 4 });
  const noFlash = { ...build, spells: [{ ids: [6, 11] as [number, number], games: 1, winRate: 0.5 }] };
  assert.deepEqual(toSpells(noFlash, "F"), { spell1Id: 6, spell2Id: 11 });
});

test("item set is well formed", () => {
  const set = toItemSet(build, "Yasuo", "uid-1");
  assert.deepEqual(set.associatedChampions, [157]);
  assert.ok(set.blocks.length >= 3);
  assert.ok(set.blocks.every((b) => b.items.length > 0 && b.items.every((i) => /^\d+$/.test(i.id))));
});

test("champ select position mapping", () => {
  assert.equal(roleFromAssigned("utility"), "UTILITY");
  assert.equal(roleFromAssigned("middle"), "MIDDLE");
  assert.equal(roleFromAssigned(""), null);
});

test("scouting card is computed from matches", () => {
  const puuid = demoPuuid("d3monek", "EUW");
  const all = demoMatchSummaries(puuid, "euw1", { start: 0, count: 200 }).matches;
  const matches = all.slice(0, 20).map((m) => demoMatchDetail(m.matchId)!);
  const now = Date.now();
  const s = computeScout(
    {
      puuid, riotId: "d3monek#EUW", teamId: 100, championId: 157, championName: "Yasuo", spells: [4, 14], keystone: 8008, subStyle: 8400,
      summonerLevel: 358, profileIconId: 1, ranked: null, ladderRank: null, mastery: { level: 48, points: 1_204_331 },
      matches, games12h: 3, games30d: 40, now,
    },
    (id) => String(id),
  );
  assert.equal(s.analysed, 20);
  assert.ok(s.champion && s.champion.games > 0);
  assert.equal(s.mainRole, "MIDDLE");
  assert.ok(s.tags.some((t) => t.label === "Millionaire: Yasuo"));
  assert.ok(s.last30d.games >= s.last30d.analysed);
  // first time on a champion with no games and no mastery
  const first = computeScout({ puuid, riotId: "x#y", teamId: 200, championId: 99, championName: "Lux", spells: [4, 7], keystone: null, subStyle: null, summonerLevel: 1, profileIconId: 1, ranked: null, ladderRank: null, mastery: null, matches, games12h: 0, games30d: 0, now }, String);
  assert.ok(first.tags.some((t) => t.label === "First time Lux" && t.tone === "bad"));
  assert.equal(first.champion, null);
});

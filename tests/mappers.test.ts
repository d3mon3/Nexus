import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLeagueEntries, mapMatch, patchFromVersion } from "../server/riot/mappers";
import { matchSchema } from "../server/riot/schemas";

const participant = (i: number) => ({
  puuid: `p${i}`, riotIdGameName: `Player${i}`, riotIdTagline: "EUW", championId: 100 + i, championName: `Champ${i}`,
  teamId: i < 5 ? 100 : 200, teamPosition: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][i % 5], kills: i, deaths: 2, assists: 3,
  totalMinionsKilled: 150, neutralMinionsKilled: 10, goldEarned: 12000, totalDamageDealtToChampions: 20000, totalDamageTaken: 18000,
  visionScore: 20, wardsPlaced: 8, champLevel: 16, item0: 3031, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 3340,
  summoner1Id: 4, summoner2Id: 14, perks: { styles: [{ style: 8000, selections: [{ perk: 8010 }] }, { style: 8400, selections: [] }] }, win: i < 5,
  someNewField: "ignored",
});

test("maps a Match-V5 payload", () => {
  const raw = matchSchema.parse({
    metadata: { matchId: "EUW1_1", participants: Array.from({ length: 10 }, (_, i) => `p${i}`) },
    info: {
      gameCreation: 1, gameDuration: 1800, gameVersion: "15.20.712.1234", queueId: 420,
      participants: Array.from({ length: 10 }, (_, i) => participant(i)),
      teams: [
        { teamId: 100, win: true, bans: [], objectives: { dragon: { kills: 3, first: true }, tower: { kills: 9 } } },
        { teamId: 200, win: false, bans: [], objectives: {} },
      ],
    },
  });
  const m = mapMatch(raw, "p2");
  assert.equal(m.me.riotId, "Player2#EUW");
  assert.equal(m.me.cs, 160);
  assert.equal(m.me.primaryRune, 8010);
  assert.equal(m.me.secondaryStyle, 8400);
  assert.equal(m.patch, "15.20");
  assert.equal(m.objectives[0].dragon, 3);
  assert.equal(m.objectives[1].tower, 0);
  assert.equal(m.queueName, "Ranked Solo/Duo");
  assert.equal(patchFromVersion("16.3.1"), "16.3");
});

test("maps league entries, solo first, ignores other queues", () => {
  const out = mapLeagueEntries([
    { queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 10, wins: 1, losses: 1 },
    { queueType: "CHERRY", tier: "NONE", rank: "", leaguePoints: 0, wins: 0, losses: 0 },
    { queueType: "RANKED_SOLO_5x5", tier: "MASTER", rank: "I", leaguePoints: 120, wins: 5, losses: 3 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].queue, "RANKED_SOLO_5x5");
  assert.equal(out[1].division, "I");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLiveClient } from "../electron/lcu";
import { isGameProcess } from "../electron/foreground";

const player = (name: string, tag: string, champ: string) => ({
  riotIdGameName: name,
  riotIdTagLine: tag,
  championName: champ,
  team: "ORDER" as const,
  level: 7,
  items: [],
  scores: { kills: 3, deaths: 1, assists: 4, creepScore: 60 },
});

test("live client finds the local player even when id formats differ", () => {
  const snap = mapLiveClient({
    activePlayer: { riotIdGameName: "K0ndz1k", riotIdTagLine: "EUNE", currentGold: 812.4 },
    allPlayers: [player("Someone", "EUW", "Sett"), player("k0ndz1k", "eune", "Ahri")],
    gameData: { gameMode: "CLASSIC", gameTime: 300 },
  });
  const me = snap.players.find((p) => p.isMe);
  assert.equal(me?.championName, "Ahri");
  assert.equal(snap.players.filter((p) => p.isMe).length, 1);
});

test("unknown active player marks nobody (no fallback to the first player)", () => {
  const snap = mapLiveClient({ allPlayers: [player("Someone", "EUW", "Sett")], gameData: { gameMode: "CLASSIC", gameTime: 1 } });
  assert.equal(snap.players.some((p) => p.isMe), false);
});

test("only the League game process counts as the game", () => {
  assert.ok(isGameProcess("League of Legends"));
  assert.ok(!isGameProcess("Discord"));
  assert.ok(!isGameProcess("LeagueClientUx"));
});

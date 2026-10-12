import assert from "node:assert/strict";
import { test } from "node:test";
import { lockfileCandidates, mapLiveClient, parseLockfile, parseProcessArgs } from "../electron/lcu";
import { parseLobby } from "../components/views/multi-search-parse";

test("parses the League client lockfile", () => {
  assert.deepEqual(parseLockfile("LeagueClient:12345:54321:s3cr3t:https"), { port: 54321, password: "s3cr3t", protocol: "https" });
  assert.equal(parseLockfile("garbage"), null);
});

test("parses client process arguments", () => {
  const cmd = `"C:/Riot Games/League of Legends/LeagueClientUx.exe" "--riotclient-auth-token=x" "--app-port=61234" "--remoting-auth-token=AbC-123_x"`;
  assert.deepEqual(parseProcessArgs(cmd), { port: 61234, password: "AbC-123_x", protocol: "https" });
  assert.ok(lockfileCandidates("win32").every((p) => p.endsWith("lockfile")));
});

test("maps live client data", () => {
  const snap = mapLiveClient({
    activePlayer: { riotId: "d3monek#EUW", currentGold: 1234.7 },
    allPlayers: [{ riotId: "d3monek#EUW", championName: "Yasuo", team: "ORDER", level: 11, items: [{ itemID: 3031, slot: 1 }, { itemID: 3340, slot: 6 }], scores: { kills: 5, deaths: 1, assists: 3, creepScore: 140 } }],
    events: { Events: [{ EventName: "DragonKill", EventTime: 400 }] },
    gameData: { gameMode: "CLASSIC", gameTime: 812.4 },
  });
  assert.equal(snap.activeGold, 1234);
  assert.deepEqual(snap.players[0].items, [0, 3031, 0, 0, 0, 0]);
  assert.equal(snap.events[0].name, "DragonKill");
});

test("parses lobby text for multi search", () => {
  const ids = parseLobby("d3monek #EUW joined the lobby\nHide on bush#KR1 joined the lobby\nd3monek#EUW\nnot an id\nRavenna#PRO, Kaizen#PRO");
  assert.deepEqual(ids.map((i) => `${i.gameName}#${i.tagLine}`), ["d3monek#EUW", "Hide on bush#KR1", "Ravenna#PRO", "Kaizen#PRO"]);
});

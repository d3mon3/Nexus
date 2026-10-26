import assert from "node:assert/strict";
import { test } from "node:test";
import { gameThreats, itemStyleFor, situationalFor } from "../lib/situational";
import type { ChampionInfo } from "../lib/types";

const champ = (id: number, key: string, tags: string[], info?: ChampionInfo["info"]): ChampionInfo => ({ id, key, name: key, title: "", roles: [], tags, info });

const soraka = champ(16, "Soraka", ["Support", "Mage"], { attack: 2, defense: 5, magic: 7 });
const malphite = champ(54, "Malphite", ["Tank", "Fighter"], { attack: 5, defense: 9, magic: 7 });
const ornn = champ(516, "Ornn", ["Tank", "Fighter"], { attack: 5, defense: 9, magic: 3 });
const syndra = champ(134, "Syndra", ["Mage", "Support"], { attack: 2, defense: 3, magic: 9 });
const lux = champ(99, "Lux", ["Mage", "Support"], { attack: 2, defense: 4, magic: 9 });
const ahri = champ(103, "Ahri", ["Mage", "Assassin"], { attack: 3, defense: 4, magic: 8 });
const jinx = champ(222, "Jinx", ["Marksman"], { attack: 9, defense: 2, magic: 4 });
const zed = champ(238, "Zed", ["Assassin"], { attack: 9, defense: 2, magic: 1 });

test("item style follows the champion class", () => {
  assert.equal(itemStyleFor(jinx), "adc");
  assert.equal(itemStyleFor(syndra), "ap");
  assert.equal(itemStyleFor(malphite), "tank");
  assert.equal(itemStyleFor(zed), "ad");
  assert.equal(itemStyleFor(ahri), "ap");
});

test("threats come from the enemy comp, with items for every style", () => {
  const threats = gameThreats([soraka, malphite, ornn, syndra, lux].map((champion) => ({ champion })));
  const ids = threats.map((x) => x.rule.id);
  assert.ok(ids.includes("heal"));
  assert.ok(ids.includes("tanks"));
  assert.ok(ids.includes("ap"));
  for (const style of ["ad", "adc", "ap", "tank"] as const) {
    const heal = situationalFor(threats, style).find((x) => x.rule.id === "heal");
    assert.ok(heal && heal.items.length > 0, `anti-heal for ${style}`);
  }
  assert.ok(situationalFor(threats, "ap").find((x) => x.rule.id === "tanks")!.items.includes(3135));
});

test("enemy items add armor stacking", () => {
  const threats = gameThreats([{ champion: jinx, items: [3075, 3143] }, { champion: zed, items: [3047] }]);
  assert.ok(threats.some((x) => x.rule.id === "armor"));
});

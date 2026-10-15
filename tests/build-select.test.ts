import assert from "node:assert/strict";
import { test } from "node:test";
import { bestWinRatePath, popularPath, runePages } from "../server/services/build-select";

test("popular path is decided item by item, ignoring boots and later items", () => {
  const core = {
    "3006-6672-3031-3094-3036-3072": { games: 3, wins: 2 },
    "3006-6672-3031-3036-3094": { games: 2, wins: 1 },
    "3047-6672-3031-3072": { games: 2, wins: 1 },
    "3006-6672-3094-3031": { games: 1, wins: 1 },
    "3006-3153-3085-3124": { games: 2, wins: 2 },
  };
  const p = popularPath(core, 10);
  assert.equal(p.items.length, 3);
  assert.equal(p.items[0], 6672);
  assert.equal(p.items[1], 3031);
  assert.ok(p.games >= 3);
  const best = bestWinRatePath(core, 10, p);
  assert.ok(best.items.length === 3);
});

test("rune page takes the most common rune per row within the top keystone", () => {
  const runes = {
    "8000-8100|8005-9111-9104-8014-8139-8135|5005-5008-5011": { games: 4, wins: 2 },
    "8000-8100|8005-8009-9104-8299-8139-8135|5005-5008-5011": { games: 3, wins: 2 },
    "8000-8300|8005-9111-9105-8014-8345-8347|5005-5008-5001": { games: 2, wins: 1 },
    "8100-8000|8112-8139-8138-8135-9111-8014|5008-5008-5001": { games: 1, wins: 1 },
  };
  const [page, second] = runePages(runes);
  assert.equal(page.primaryStyle, 8000);
  assert.deepEqual(page.perks.slice(0, 4), [8005, 9111, 9104, 8014]);
  assert.equal(page.subStyle, 8100);
  assert.deepEqual([...page.perks.slice(4)].sort(), [8135, 8139]);
  assert.deepEqual(page.shards, [5005, 5008, 5011]);
  assert.equal(page.games, 9);
  assert.equal(second.perks[0], 8112);
});

test("item classes: finished items, boots, starters and components", async () => {
  const { classifyAll } = await import("../lib/item-kinds");
  const k = classifyAll({
    "1036": { gold: { total: 350 }, into: ["3031"] },
    "1055": { gold: { total: 450 } },
    "3031": { gold: { total: 3450 }, into: ["7017"] },
    "7017": { gold: { total: 3450, purchasable: false }, from: ["3031"] },
    "3004": { gold: { total: 2900 }, into: ["3042"], from: ["3070"] },
    "3042": { gold: { total: 2900, purchasable: false } },
    "3006": { gold: { total: 1100 }, tags: ["Boots"], from: ["1001"] },
    "1001": { gold: { total: 300 }, tags: ["Boots"], into: ["3006"] },
    "2003": { gold: { total: 50 }, tags: ["Consumable"], consumed: true },
    "3133": { gold: { total: 1100 }, into: ["3071"], from: ["1036"] },
    "3071": { gold: { total: 3000 } },
  });
  assert.equal(k[1036], "starter");
  assert.equal(k[1055], "starter");
  assert.equal(k[3031], "core");
  assert.equal(k[3004], "core");
  assert.equal(k[3006], "boots");
  assert.equal(k[1001], "component");
  assert.equal(k[2003], "consumable");
  assert.equal(k[3133], "component");
});

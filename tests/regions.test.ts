import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRiotId, profileHref, resolveRegion } from "../lib/regions";

test("routing distinguishes platform and regional hosts", () => {
  assert.equal(resolveRegion("EUW")?.platform, "euw1");
  assert.equal(resolveRegion("euw1")?.matchRoute, "europe");
  assert.equal(resolveRegion("na")?.platform, "na1");
  assert.equal(resolveRegion("kr")?.matchRoute, "asia");
  assert.equal(resolveRegion("oce")?.matchRoute, "sea");
  assert.equal(resolveRegion("oce")?.accountRoute, "americas");
  assert.equal(resolveRegion("vn2")?.accountRoute, "asia");
  assert.equal(resolveRegion("nope"), undefined);
});

test("riot id parsing handles # and url dashes", () => {
  assert.deepEqual(parseRiotId("d3monek#EUW"), { gameName: "d3monek", tagLine: "EUW" });
  assert.deepEqual(parseRiotId("Hide on bush-KR1"), { gameName: "Hide on bush", tagLine: "KR1" });
  assert.deepEqual(parseRiotId(encodeURIComponent("Some-Name-EUW")), { gameName: "Some-Name", tagLine: "EUW" });
  assert.equal(parseRiotId("ab#EUW"), null);
  assert.equal(parseRiotId("noTag"), null);
  assert.equal(profileHref("euw1", "d3monek", "EUW"), "/profile/euw/d3monek-EUW");
});

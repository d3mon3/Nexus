import assert from "node:assert/strict";
import { test } from "node:test";
import { maskKey, normalizeServerUrl, RIOT_KEY_RE } from "../server/admin-utils";

test("accepts only well-formed Riot keys", () => {
  assert.ok(RIOT_KEY_RE.test("RGAPI-12345678-abcd-ef01-2345-6789abcdef01"));
  assert.ok(!RIOT_KEY_RE.test("RGAPI-123"));
  assert.ok(!RIOT_KEY_RE.test("hello RGAPI-12345678-abcd-ef01-2345-6789abcdef01"));
});

test("masks keys so the full key is never echoed back", () => {
  const m = maskKey("RGAPI-12345678-abcd-ef01-2345-6789abcdef01")!;
  assert.equal(m, "RGAPI-1234…ef01");
  assert.equal(maskKey(null), null);
});

test("desktop server address must be https (http only for localhost)", () => {
  assert.equal(normalizeServerUrl("https://1-2-3-4.sslip.io/"), "https://1-2-3-4.sslip.io");
  assert.equal(normalizeServerUrl("http://1-2-3-4.sslip.io"), null);
  assert.equal(normalizeServerUrl("http://localhost:3000/x"), "http://localhost:3000");
  assert.equal(normalizeServerUrl("not a url"), null);
  assert.equal(normalizeServerUrl(""), null);
});

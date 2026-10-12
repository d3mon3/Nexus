import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { riotRequest, RiotApiError } from "./riot/client";
import { ServiceError } from "./services/player";

/**
 * /admin protection: one shared password from ADMIN_PASSWORD, compared in constant time,
 * with a lockout after repeated failures (per client address and globally).
 */
const failures = new Map<string, { count: number; first: number; until: number }>();
let globalFailures: number[] = [];
const WINDOW = 15 * 60_000;

function clientAddress(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function requireAdmin(req: Request) {
  const expected = env.adminPassword;
  if (!expected) throw new ServiceError(403, "Panel admina jest wyłączony: ustaw ADMIN_PASSWORD na serwerze.");
  const ip = clientAddress(req);
  const now = Date.now();
  globalFailures = globalFailures.filter((t) => now - t < WINDOW);
  const f = failures.get(ip);
  if ((f && f.until > now) || globalFailures.length >= 30) throw new ServiceError(429, "Za dużo błędnych haseł. Spróbuj za 15 minut.");

  const given = req.headers.get("x-admin-password") ?? "";
  if (!timingSafeEqual(digest(given), digest(expected))) {
    const fresh = !f || now - f.first > WINDOW;
    const count = (fresh ? 0 : f.count) + 1;
    failures.set(ip, { count, first: fresh ? now : f.first, until: count >= 5 ? now + WINDOW : 0 });
    globalFailures.push(now);
    throw new ServiceError(401, "Złe hasło administratora.");
  }
  failures.delete(ip);
}

export { maskKey, RIOT_KEY_RE } from "./admin-utils";

/** Calls a cheap endpoint (LoL status) to check that Riot accepts the key. */
export async function testKey(key: string, platform = env.defaultPlatform): Promise<{ ok: boolean; message: string }> {
  try {
    await riotRequest(`https://${platform}.api.riotgames.com/lol/status/v4/platform-data`, z.object({ id: z.string() }).passthrough(), { apiKey: key, maxRetries: 1 });
    return { ok: true, message: "Riot zaakceptował klucz." };
  } catch (err) {
    if (err instanceof RiotApiError && (err.status === 401 || err.status === 403))
      return { ok: false, message: "Riot odrzucił ten klucz (zły albo wygasł). Wygeneruj nowy na developer.riotgames.com." };
    return { ok: false, message: err instanceof Error ? err.message : "Nie udało się połączyć z Riot." };
  }
}

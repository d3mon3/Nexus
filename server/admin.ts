import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";
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

/**
 * Checks the key against two ordinary endpoints (the Challenger ladder and an Account-V1 lookup).
 * 200 or 404 means Riot accepted the key; 401/403 on both means it was rejected.
 */
export async function testKey(key: string, platform = env.defaultPlatform): Promise<{ ok: boolean; message: string }> {
  const regional = ["na1", "br1", "la1", "la2"].includes(platform) ? "americas" : ["kr", "jp1"].includes(platform) ? "asia" : "europe";
  const urls = [
    `https://${platform}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`,
    `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/NEXUS/KEYCHECK`,
  ];
  const codes: number[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "X-Riot-Token": key.trim() }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
      codes.push(res.status);
      if (res.ok || res.status === 404) return { ok: true, message: "Riot zaakceptował klucz." };
    } catch {
      codes.push(0);
    }
  }
  if (codes.every((c) => c === 0)) return { ok: false, message: "Serwer nie może połączyć się z Riot (sieć). Spróbuj za chwilę." };
  if (codes.some((c) => c === 429)) return { ok: true, message: "Riot zaakceptował klucz (limit zapytań chwilowo wyczerpany)." };
  if (codes.every((c) => c === 401 || c === 403))
    return { ok: false, message: `Riot odrzucił ten klucz (kod ${codes.join("/")}). Świeżo wygenerowany klucz czasem działa dopiero po 1–2 minutach — spróbuj ponownie, a jeśli dalej nie działa, wygeneruj nowy.` };
  return { ok: false, message: `Riot odpowiedział nietypowo (kod ${codes.join("/")}). Spróbuj ponownie za chwilę.` };
}

/** Pure helpers for /admin (no server-only import so they can be unit tested). */
export const RIOT_KEY_RE = /^RGAPI-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function maskKey(key: string | null) {
  return key ? `${key.slice(0, 10)}…${key.slice(-4)}` : null;
}

/** Normalises a desktop server address: https only (plain http allowed for localhost). */
export function normalizeServerUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

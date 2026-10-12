import { parseRiotId } from "@/lib/regions";

/** Extracts Riot IDs from pasted lobby/champ-select chat or one-per-line lists. */
export function parseLobby(text: string): { gameName: string; tagLine: string }[] {
  const out: { gameName: string; tagLine: string }[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n|,/)) {
    const line = raw.replace(/\s+(joined the lobby|left the lobby|dołączył.*|hat die Lobby.*)$/i, "").trim();
    const m = /([^\s#][^#]{1,15}?)\s*#\s*([A-Za-z0-9]{2,5})\b/.exec(line);
    if (!m) continue;
    const id = parseRiotId(`${m[1].trim()}#${m[2]}`);
    if (!id) continue;
    const key = `${id.gameName}#${id.tagLine}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out.slice(0, 10);
}

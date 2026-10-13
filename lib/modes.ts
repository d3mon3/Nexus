/**
 * Game modes with their own builds. "sr" covers Summoner's Rift (ranked, normals, swiftplay,
 * clash) and keeps per-role data; every other mode has one build per champion.
 * Aggregated rows for a mode are stored with rankBand = mode id (role "ANY").
 */
export type GameModeId = "sr" | "aram" | "aram-mayhem" | "arena" | "urf";

export interface GameModeInfo {
  id: GameModeId;
  label: string;
  /** Queue ids collected by the aggregator / matched in champ select. */
  queues: number[];
  /** Client gameMode values, used when the queue id is unknown (new rotating queues). */
  gameModes: string[];
  /** Item-set map for the League client. */
  itemSetMap: "SR" | "HA" | "any";
  roles: boolean;
}

export const GAME_MODES: GameModeInfo[] = [
  { id: "sr", label: "Ranked & Normal", queues: [420, 440, 400, 430, 480, 490, 700], gameModes: ["CLASSIC", "SWIFTPLAY"], itemSetMap: "SR", roles: true },
  { id: "aram", label: "ARAM", queues: [450, 100], gameModes: ["ARAM"], itemSetMap: "HA", roles: false },
  { id: "aram-mayhem", label: "ARAM Chaos", queues: [2400], gameModes: ["KIWI"], itemSetMap: "HA", roles: false },
  { id: "arena", label: "Arena", queues: [1700, 1710], gameModes: ["CHERRY"], itemSetMap: "any", roles: false },
  { id: "urf", label: "URF", queues: [900, 1900, 1010], gameModes: ["URF", "ARURF"], itemSetMap: "SR", roles: false },
];

export const MODE_IDS = GAME_MODES.map((m) => m.id);
export const NON_SR_MODES = GAME_MODES.filter((m) => m.id !== "sr").map((m) => m.id as string);

export function modeInfo(id: string | null | undefined): GameModeInfo {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

export function isGameModeId(v: unknown): v is GameModeId {
  return typeof v === "string" && (MODE_IDS as string[]).includes(v);
}

/** Mode for a queue id (falls back to the client's gameMode string). */
export function modeForQueue(queueId: number | null | undefined, gameMode?: string | null): GameModeId {
  const byQueue = GAME_MODES.find((m) => queueId != null && m.queues.includes(queueId));
  if (byQueue) return byQueue.id;
  const gm = (gameMode ?? "").toUpperCase();
  return GAME_MODES.find((m) => m.gameModes.includes(gm))?.id ?? "sr";
}

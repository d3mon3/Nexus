import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Envelope, ProPlayer } from "@/lib/types";
import { demoProPlayers } from "../demo";
import { env } from "../env";

/**
 * Riot has no pro-player API. NEXUS reads a roster you maintain in data/pro-players.json
 * (same shape as ProPlayer). Without that file a fictional demo roster is shown.
 */
const rosterSchema = z.array(
  z.object({
    handle: z.string(),
    realName: z.string().default(""),
    team: z.string(),
    league: z.string(),
    role: z.enum(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]),
    country: z.string().default(""),
    riotId: z.string().nullable().default(null),
    platform: z.string().default("euw1"),
    signatureChampionIds: z.array(z.number()).default([]),
  }),
);

export async function getProPlayers(): Promise<Envelope<ProPlayer[]>> {
  const files = [process.env.NEXUS_DATA_DIR && path.join(process.env.NEXUS_DATA_DIR, "pro-players.json"), path.join(process.cwd(), "data", "pro-players.json")].filter(Boolean) as string[];
  try {
    const raw = await Promise.any(files.map((f) => readFile(f, "utf8")));
    return { data: rosterSchema.parse(JSON.parse(raw)), source: "aggregate", fetchedAt: new Date().toISOString(), note: "Roster from data/pro-players.json." };
  } catch {
    if (env.demoDisabled) return { data: [], source: "aggregate", fetchedAt: new Date().toISOString(), note: "No pro roster configured on this server yet (pro-players.json)." };
    return {
      data: demoProPlayers(),
      source: "demo",
      fetchedAt: new Date().toISOString(),
      note: "Fictional demo roster. Add data/pro-players.json to track real players.",
    };
  }
}

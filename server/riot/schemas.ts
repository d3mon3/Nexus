import { z } from "zod";

/** Zod schemas for the subset of Riot API responses NEXUS consumes. Unknown fields pass through. */

export const accountSchema = z.object({
  puuid: z.string(),
  gameName: z.string().optional().default(""),
  tagLine: z.string().optional().default(""),
});

export const summonerSchema = z.object({
  puuid: z.string(),
  profileIconId: z.number(),
  summonerLevel: z.number(),
});

export const leagueEntrySchema = z.object({
  queueType: z.string(),
  tier: z.string(),
  rank: z.string().optional().nullable(),
  leaguePoints: z.number(),
  wins: z.number(),
  losses: z.number(),
  hotStreak: z.boolean().optional(),
  puuid: z.string().optional(),
});
export const leagueEntriesSchema = z.array(leagueEntrySchema);

export const leagueListSchema = z.object({
  tier: z.string(),
  queue: z.string().optional(),
  entries: z.array(
    z.object({
      puuid: z.string(),
      leaguePoints: z.number(),
      wins: z.number(),
      losses: z.number(),
      rank: z.string().optional(),
    }),
  ),
});

export const masterySchema = z.array(
  z.object({
    championId: z.number(),
    championLevel: z.number(),
    championPoints: z.number(),
    lastPlayTime: z.number(),
  }),
);

export const matchIdsSchema = z.array(z.string());

const perkStyleSchema = z.object({
  style: z.number(),
  selections: z.array(z.object({ perk: z.number() })).default([]),
});

export const participantSchema = z.object({
  puuid: z.string(),
  riotIdGameName: z.string().optional().default(""),
  riotIdTagline: z.string().optional().default(""),
  summonerName: z.string().optional().default(""),
  championId: z.number(),
  championName: z.string(),
  teamId: z.number(),
  teamPosition: z.string().optional().default(""),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  totalMinionsKilled: z.number().default(0),
  neutralMinionsKilled: z.number().default(0),
  goldEarned: z.number().default(0),
  totalDamageDealtToChampions: z.number().default(0),
  totalDamageTaken: z.number().default(0),
  visionScore: z.number().default(0),
  wardsPlaced: z.number().default(0),
  champLevel: z.number().default(1),
  item0: z.number().default(0),
  item1: z.number().default(0),
  item2: z.number().default(0),
  item3: z.number().default(0),
  item4: z.number().default(0),
  item5: z.number().default(0),
  item6: z.number().default(0),
  summoner1Id: z.number().default(4),
  summoner2Id: z.number().default(14),
  perks: z
    .object({
      styles: z.array(perkStyleSchema).default([]),
      statPerks: z.object({ offense: z.number(), flex: z.number(), defense: z.number() }).partial().optional(),
    })
    .optional(),
  win: z.boolean(),
  // Arena / ARAM Mayhem augments (0 = none) and Arena placement.
  playerAugment1: z.number().optional(),
  playerAugment2: z.number().optional(),
  playerAugment3: z.number().optional(),
  playerAugment4: z.number().optional(),
  playerAugment5: z.number().optional(),
  playerAugment6: z.number().optional(),
  placement: z.number().optional(),
});

const objective = z.object({ kills: z.number().default(0) }).optional();

export const matchSchema = z.object({
  metadata: z.object({ matchId: z.string(), participants: z.array(z.string()) }),
  info: z.object({
    gameCreation: z.number(),
    gameDuration: z.number(),
    gameEndTimestamp: z.number().optional(),
    gameVersion: z.string().default(""),
    queueId: z.number(),
    participants: z.array(participantSchema),
    teams: z.array(
      z.object({
        teamId: z.number(),
        win: z.boolean(),
        bans: z.array(z.object({ championId: z.number() })).default([]),
        objectives: z
          .object({
            baron: objective,
            champion: objective,
            dragon: objective,
            horde: objective,
            inhibitor: objective,
            riftHerald: objective,
            tower: objective,
          })
          .partial()
          .default({}),
      }),
    ),
  }),
});
export type RiotMatch = z.infer<typeof matchSchema>;
export type RiotParticipant = z.infer<typeof participantSchema>;

export const timelineSchema = z.object({
  info: z.object({
    frames: z.array(
      z.object({
        timestamp: z.number(),
        events: z.array(
          z
            .object({
              type: z.string(),
              participantId: z.number().optional(),
              itemId: z.number().optional(),
              skillSlot: z.number().optional(),
              timestamp: z.number(),
            })
            .passthrough(),
        ),
      }),
    ),
    participants: z.array(z.object({ participantId: z.number(), puuid: z.string() })).optional(),
  }),
});
export type RiotTimeline = z.infer<typeof timelineSchema>;

export const spectatorSchema = z.object({
  gameId: z.number(),
  gameStartTime: z.number(),
  gameLength: z.number(),
  gameQueueConfigId: z.number().optional().default(0),
  mapId: z.number().optional(),
  participants: z.array(
    z.object({
      puuid: z.string().nullable().optional(),
      riotId: z.string().optional().default(""),
      teamId: z.number(),
      championId: z.number(),
      spell1Id: z.number(),
      spell2Id: z.number(),
      perks: z
        .object({ perkIds: z.array(z.number()), perkStyle: z.number(), perkSubStyle: z.number() })
        .optional()
        .nullable(),
    }),
  ),
  bannedChampions: z.array(z.object({ championId: z.number(), teamId: z.number() })).default([]),
});
export type RiotSpectatorGame = z.infer<typeof spectatorSchema>;

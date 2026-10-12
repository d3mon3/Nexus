import "server-only";
import type { PrismaClient } from "@prisma/client";
import { env } from "./env";

/**
 * Prisma is optional: without DATABASE_URL NEXUS runs on the in-memory cache.
 * The client is created lazily and reused across hot reloads in development.
 */
const globalForPrisma = globalThis as unknown as { __nexusPrisma?: PrismaClient | null };

let warned = false;

export async function getDb(): Promise<PrismaClient | null> {
  if (!env.databaseUrl) return null;
  if (globalForPrisma.__nexusPrisma !== undefined) return globalForPrisma.__nexusPrisma;
  try {
    const { PrismaClient } = await import("@prisma/client");
    globalForPrisma.__nexusPrisma = new PrismaClient();
  } catch (err) {
    if (!warned) console.warn("[nexus] Prisma client unavailable, continuing without database:", err);
    warned = true;
    globalForPrisma.__nexusPrisma = null;
  }
  return globalForPrisma.__nexusPrisma;
}

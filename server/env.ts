import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Server-only environment access. The Riot key never leaves the server: route handlers use
 * it to call Riot, nothing here is importable from client components ("server-only").
 *
 * The key comes from RIOT_API_KEY, or from a file written by the /admin page
 * (NEXUS_DATA_DIR/riot-key.txt) so it can be rotated from a phone without SSH.
 */
const dataDir = () => process.env.NEXUS_DATA_DIR?.trim() || path.join(process.cwd(), ".nexus-data");
export const keyFile = () => path.join(dataDir(), "riot-key.txt");

let fileKey: { value: string | null; readAt: number; updatedAt: number | null } = { value: null, readAt: 0, updatedAt: null };

function readFileKey(): string | null {
  if (Date.now() - fileKey.readAt < 10_000) return fileKey.value;
  try {
    const stat = fs.statSync(keyFile());
    const value = fs.readFileSync(keyFile(), "utf8").trim() || null;
    fileKey = { value, readAt: Date.now(), updatedAt: stat.mtimeMs };
  } catch {
    fileKey = { value: null, readAt: Date.now(), updatedAt: null };
  }
  return fileKey.value;
}

export function saveKey(key: string) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(keyFile(), key.trim() + "\n", { mode: 0o600 });
  fileKey = { value: key.trim(), readAt: Date.now(), updatedAt: Date.now() };
}

export function keyUpdatedAt(): number | null {
  readFileKey();
  return fileKey.updatedAt;
}

export const env = {
  get riotApiKey(): string | null {
    // A key saved from /admin wins over the environment, so rotation needs no restart.
    return readFileKey() ?? (process.env.RIOT_API_KEY?.trim() || null);
  },
  get databaseUrl(): string | null {
    return process.env.DATABASE_URL?.trim() || null;
  },
  get defaultPlatform(): string {
    return process.env.NEXUS_DEFAULT_PLATFORM?.trim() || "euw1";
  },
  /** Production servers set NEXUS_DISABLE_DEMO=1: never show generated data. */
  get demoDisabled(): boolean {
    return /^(1|true|yes)$/i.test(process.env.NEXUS_DISABLE_DEMO?.trim() ?? "");
  },
  get adminPassword(): string | null {
    return process.env.ADMIN_PASSWORD?.trim() || null;
  },
};

let rejectedKey: string | null = null;
/** Called when Riot answers 401/403 for the current key (e.g. a 24h development key expired). */
export function markKeyRejected(key: string) {
  rejectedKey = key;
}
export function keyRejected(): boolean {
  const k = env.riotApiKey;
  return k !== null && k === rejectedKey;
}

export function isLiveMode(): boolean {
  return env.riotApiKey !== null;
}

/** Throws a clear "not configured" error instead of serving demo data on production servers. */
export function assertDemoAllowed() {
  if (env.demoDisabled) {
    const err = new Error("The NEXUS server has no Riot API key yet. The admin can add it at /admin.") as Error & { status: number };
    err.status = 503;
    throw err;
  }
}

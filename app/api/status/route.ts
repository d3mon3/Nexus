import { getStaticBundle } from "@/server/ddragon";
import { getDb } from "@/server/db";
import { env, isLiveMode, keyRejected } from "@/server/env";
import { handle } from "@/server/http";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async (): Promise<AppStatus> => {
    const [bundle, db] = await Promise.all([getStaticBundle(), getDb()]);
    let aggregateDataset: AppStatus["aggregateDataset"] = null;
    if (db) {
      const run = await db.aggregateRun.findFirst({ orderBy: { finishedAt: "desc" } }).catch(() => null);
      if (run) aggregateDataset = { patch: run.patch, matches: run.matches };
    }
    return { mode: isLiveMode() ? "live" : env.demoDisabled ? "offline" : "demo", keyRejected: keyRejected(), ddragonVersion: bundle.version, database: Boolean(db), aggregateDataset };
  });
}

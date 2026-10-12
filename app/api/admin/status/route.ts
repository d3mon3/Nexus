import { maskKey, requireAdmin, testKey } from "@/server/admin";
import { getDb } from "@/server/db";
import { env, keyRejected, keyUpdatedAt } from "@/server/env";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const key = env.riotApiKey;
    const check = key && new URL(req.url).searchParams.get("test") === "1" ? await testKey(key) : null;
    const db = await getDb();
    const runs = db ? await db.aggregateRun.findMany({ orderBy: { finishedAt: "desc" }, take: 5 }).catch(() => []) : [];
    const updated = keyUpdatedAt();
    return {
      key: { set: Boolean(key), masked: maskKey(key), updatedAt: updated ? new Date(updated).toISOString() : null, rejected: keyRejected(), check },
      demoDisabled: env.demoDisabled,
      database: Boolean(db),
      aggregate: runs.map((r) => ({ patch: r.patch, platform: r.platform, rankBand: r.rankBand, matches: r.matches, finishedAt: r.finishedAt })),
    };
  });
}

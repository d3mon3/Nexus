import "server-only";
import { NextResponse } from "next/server";
import { z, type ZodTypeAny } from "zod";
import { ServiceError } from "./services/player";

/** Parses query params with a zod schema; turns failures into 400s. */
export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ServiceError(400, `Invalid "${issue?.path.join(".") || "query"}": ${issue?.message ?? "bad request"}`);
  }
  return parsed.data;
}

export async function handle(fn: () => Promise<unknown>, cacheSeconds = 0) {
  try {
    const body = await fn();
    return NextResponse.json(body, {
      headers: cacheSeconds ? { "Cache-Control": `private, max-age=${cacheSeconds}` } : { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const raw = (err as { status?: unknown } | null)?.status;
    const status = err instanceof ServiceError ? err.status : typeof raw === "number" && raw >= 400 && raw < 600 ? raw : 500;
    const message = err instanceof Error ? err.message : "Unexpected error";
    if (status >= 500) console.error("[nexus api]", err);
    return NextResponse.json({ error: message }, { status });
  }
}

export const regionParam = z.string().min(2).max(6);
export const puuidParam = z.string().min(10).max(120);
export const intParam = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).catch(fallback);
export const roleParam = z.enum(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]).optional().catch(undefined);

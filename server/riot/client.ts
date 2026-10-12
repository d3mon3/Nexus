import type { ZodType } from "zod";
import { riotLimiter, type RateLimiter } from "./rate-limiter";

export class RiotApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public url?: string,
  ) {
    super(message);
    this.name = "RiotApiError";
  }
  get notFound() {
    return this.status === 404;
  }
}

export interface RiotFetchOptions {
  apiKey: string;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Low-level Riot request: rate limiting per routing host, retry with exponential
 * backoff for 429/5xx/network errors, and schema validation of the response.
 * Returns `null` for 404 when `allowNotFound` is set (e.g. "not in game").
 */
export async function riotRequest<T>(
  url: string,
  schema: ZodType<T>,
  opts: RiotFetchOptions & { allowNotFound?: boolean },
): Promise<T | null> {
  const host = new URL(url).host;
  const limiter = opts.limiter ?? riotLimiter;
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const maxRetries = opts.maxRetries ?? 3;

  for (let attempt = 0; ; attempt++) {
    await limiter.acquire(host);
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { "X-Riot-Token": opts.apiKey, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      if (attempt >= maxRetries) throw new RiotApiError(0, `Network error contacting Riot: ${String(err)}`, url);
      await sleep(backoff(attempt));
      continue;
    }

    limiter.learn(host, res.headers.get("x-app-rate-limit"));

    if (res.ok) {
      const json = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new RiotApiError(502, `Unexpected Riot response shape: ${parsed.error.issues[0]?.message ?? "invalid"}`, url);
      }
      return parsed.data;
    }

    if (res.status === 404 && opts.allowNotFound) return null;

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "1");
      limiter.block(host, Number.isFinite(retryAfter) ? retryAfter : 1);
      if (attempt >= maxRetries) throw new RiotApiError(429, "Riot API rate limit reached — try again shortly.", url);
      continue; // the limiter will wait out the block
    }

    if (res.status >= 500 && attempt < maxRetries) {
      await sleep(backoff(attempt));
      continue;
    }

    throw new RiotApiError(res.status, describeStatus(res.status), url);
  }
}

export function backoff(attempt: number): number {
  const base = 400 * 2 ** attempt;
  return base + Math.floor(Math.random() * 200);
}

function describeStatus(status: number): string {
  switch (status) {
    case 400:
      return "Bad request to Riot API.";
    case 401:
    case 403:
      return "Riot API key is missing, expired or not allowed for this endpoint.";
    case 404:
      return "Not found.";
    default:
      return `Riot API error (${status}).`;
  }
}

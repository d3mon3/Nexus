import "server-only";
import { z } from "zod";
import { pickInstaller, REPO_RE } from "../release-utils";

/**
 * The desktop installer is built by GitHub Actions and attached to a GitHub Release.
 * NEXUS_RELEASE_REPO (owner/repo, set by deploy/install.sh) tells the server where to look,
 * so the download page always offers the newest build.
 */
export interface DesktopRelease {
  repo: string;
  tag: string;
  name: string;
  publishedAt: string;
  fileName: string;
  url: string;
  size: number;
  pageUrl: string;
}


export function releaseRepo(): string | null {
  const repo = process.env.NEXUS_RELEASE_REPO?.trim() ?? "";
  return REPO_RE.test(repo) ? repo : null;
}

const releaseSchema = z.object({
  tag_name: z.string(),
  name: z.string().nullable(),
  published_at: z.string().nullable(),
  html_url: z.string(),
  assets: z.array(z.object({ name: z.string(), size: z.number(), browser_download_url: z.string() })),
});

let cache: { at: number; value: DesktopRelease | null } | null = null;
const TTL_MS = 5 * 60_000;

export async function getDesktopRelease(): Promise<DesktopRelease | null> {
  const repo = releaseRepo();
  if (!repo) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "nexus-server" },
      cache: "no-store",
    });
    if (!res.ok) {
      // 404 = no release yet. Keep a stale value on GitHub hiccups/rate limits.
      if (res.status === 404) cache = { at: Date.now(), value: null };
      return res.status === 404 ? null : (cache?.value ?? null);
    }
    const r = releaseSchema.parse(await res.json());
    const exe = pickInstaller(r.assets);
    const value: DesktopRelease | null = exe
      ? { repo, tag: r.tag_name, name: r.name || r.tag_name, publishedAt: r.published_at ?? "", fileName: exe.name, url: exe.browser_download_url, size: exe.size, pageUrl: r.html_url }
      : null;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return cache?.value ?? null;
  }
}

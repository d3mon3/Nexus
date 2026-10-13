import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
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
    if (value) void ensureCachedInstaller(value).catch(() => undefined); // warm the local copy
    return value;
  } catch {
    return cache?.value ?? null;
  }
}

/* ------------------------------------------------------------------ local copy
 * The server keeps its own copy of the newest installer and serves it from its own
 * address, so people downloading NEXUS never get sent to GitHub. */

const releasesDir = () => path.join(process.env.NEXUS_DATA_DIR?.trim() || path.join(process.cwd(), ".nexus-data"), "releases");
const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");
const localPath = (r: DesktopRelease) => path.join(releasesDir(), `${safe(r.tag)}--${safe(r.fileName)}`);

const inflight = new Map<string, Promise<string>>();

export function ensureCachedInstaller(r: DesktopRelease): Promise<string> {
  const target = localPath(r);
  try {
    if (fs.statSync(target).size === r.size) return Promise.resolve(target);
  } catch {
    /* not downloaded yet */
  }
  const running = inflight.get(target);
  if (running) return running;
  const job = (async () => {
    fs.mkdirSync(releasesDir(), { recursive: true });
    const res = await fetch(r.url, { headers: { "User-Agent": "nexus-server" }, redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`GitHub download failed (${res.status})`);
    const tmp = `${target}.part`;
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(tmp);
      Readable.fromWeb(res.body as never).on("error", reject).pipe(out).on("finish", resolve).on("error", reject);
    });
    if (fs.statSync(tmp).size !== r.size) {
      fs.rmSync(tmp, { force: true });
      throw new Error("Incomplete installer download");
    }
    fs.renameSync(tmp, target);
    // Keep only the newest installer on disk.
    for (const f of fs.readdirSync(releasesDir())) if (path.join(releasesDir(), f) !== target) fs.rmSync(path.join(releasesDir(), f), { force: true });
    return target;
  })().finally(() => inflight.delete(target));
  inflight.set(target, job);
  return job;
}

/** Streams the installer from the server's own disk (downloading it from GitHub first if needed). */
export async function installerResponse(r: DesktopRelease): Promise<Response> {
  const file = await ensureCachedInstaller(r);
  const size = fs.statSync(file).size;
  const stream = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/vnd.microsoft.portable-executable",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${safe(r.fileName)}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Pure helpers for the download page (unit tested). */
export const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Picks the Windows installer from a release (ignores blockmaps and other files). */
export function pickInstaller<T extends { name: string }>(assets: T[]): T | null {
  return assets.find((a) => /\.exe$/i.test(a.name) && !/blockmap/i.test(a.name)) ?? null;
}

/** owner/repo from a GitHub clone URL (https or ssh), or null. */
export function repoFromGitUrl(url: string): string | null {
  const m = /github\.com[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

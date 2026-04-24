/**
 * Shared version utilities — used by FooterVersionBadge and VmAgentDetails.
 */

export const GITHUB_REPO     = "gregluffy/HomeLabInfo";
export const GITHUB_REPO_URL = "https://github.com/gregluffy/HomeLabInfo";
export const RELEASES_API    = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const CACHE_KEY       = "homelabinfo-latest-release";
export const CACHE_TTL_MS    = 6 * 60 * 60 * 1000; // 6 hours

export interface CachedRelease {
  tagName:    string;
  releaseUrl: string;
  fetchedAt:  number;
}

/** Returns true if version string `a` is strictly greater than `b`. Supports N.N.N.N format. */
export function semverGt(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

/**
 * Fetches (or returns from cache) the latest GitHub release tag.
 * Returns null if the request fails or no release exists yet.
 */
export async function fetchLatestRelease(): Promise<CachedRelease | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached: CachedRelease = JSON.parse(raw);
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
    }

    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const tagName:  string = data.tag_name ?? "";
    const htmlUrl:  string = data.html_url  ?? `${GITHUB_REPO_URL}/releases`;

    const toCache: CachedRelease = { tagName, releaseUrl: htmlUrl, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
    return toCache;
  } catch {
    return null;
  }
}

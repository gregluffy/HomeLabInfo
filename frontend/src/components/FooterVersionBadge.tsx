"use client";

import { useEffect, useState } from "react";
import { GitBranch, ExternalLink, ArrowUpCircle } from "lucide-react";

const GITHUB_REPO     = "gregluffy/HomeLabInfo";
const GITHUB_REPO_URL = "https://github.com/gregluffy/HomeLabInfo";
const RELEASES_API    = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CACHE_KEY       = "homelabinfo-latest-release";
const CACHE_TTL_MS    = 6 * 60 * 60 * 1000; // 6 hours

interface CachedRelease {
  tagName:    string;
  releaseUrl: string;
  fetchedAt:  number;
}

/** Returns true if version string `a` is greater than `b`. Supports N.N.N.N format. */
function semverGt(a: string, b: string): boolean {
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

export default function FooterVersionBadge({ currentVersion }: { currentVersion: string }) {
  const [latestTag,       setLatestTag]       = useState<string | null>(null);
  const [releaseUrl,      setReleaseUrl]      = useState(`${GITHUB_REPO_URL}/releases`);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    async function checkLatest() {
      try {
        // Serve from cache when still fresh
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: CachedRelease = JSON.parse(raw);
          if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            setLatestTag(cached.tagName);
            setReleaseUrl(cached.releaseUrl);
            setUpdateAvailable(semverGt(cached.tagName, currentVersion));
            return;
          }
        }

        const res = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) return; // No releases published yet — silently skip

        const data = await res.json();
        const tagName:  string = data.tag_name ?? "";
        const htmlUrl:  string = data.html_url ?? `${GITHUB_REPO_URL}/releases`;

        const toCache: CachedRelease = { tagName, releaseUrl: htmlUrl, fetchedAt: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));

        setLatestTag(tagName);
        setReleaseUrl(htmlUrl);
        setUpdateAvailable(semverGt(tagName, currentVersion));
      } catch {
        // Network unavailable or parse error — not critical, skip silently
      }
    }

    checkLatest();
  }, [currentVersion]);

  return (
    <div className="flex items-center gap-4">
      {/* GitHub link */}
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
        title="View on GitHub"
      >
        <GitBranch className="w-3 h-3" />
        <span>GitHub</span>
      </a>

      {/* Current version with pulse dot */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
        v{currentVersion}
      </div>

      {/* Update available badge — only shown when a newer GitHub Release exists */}
      {updateAvailable && latestTag && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Update available: ${latestTag} — click to view release notes`}
          className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400
                     px-2 py-0.5 rounded-full hover:bg-amber-500/25 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>{latestTag} available</span>
        </a>
      )}
    </div>
  );
}

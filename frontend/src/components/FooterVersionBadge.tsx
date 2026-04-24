"use client";

import { useEffect, useState } from "react";
import { GitBranch, ExternalLink } from "lucide-react";
import {
  GITHUB_REPO_URL,
  semverGt,
  fetchLatestRelease,
} from "../lib/versionUtils";

export default function FooterVersionBadge({ currentVersion }: { currentVersion: string }) {
  const [latestTag,       setLatestTag]       = useState<string | null>(null);
  const [releaseUrl,      setReleaseUrl]      = useState(`${GITHUB_REPO_URL}/releases`);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    async function checkLatest() {
      const release = await fetchLatestRelease();
      if (!release) return;
      setLatestTag(release.tagName);
      setReleaseUrl(release.releaseUrl);
      setUpdateAvailable(semverGt(release.tagName, currentVersion));
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

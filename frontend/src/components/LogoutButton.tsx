"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearToken, getToken, getUsername, getApiUrl } from "@/lib/apiFetch";

export default function LogoutButton() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const publicPaths = ["/login", "/setup"];
    if (publicPaths.includes(pathname)) return;

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/auth/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.authEnabled) {
            setAuthEnabled(true);
            setUsername(getUsername());
          }
        }
      } catch { }
    })();
  }, [pathname]);

  if (!authEnabled || !getToken()) return null;

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <div className="flex items-center gap-3">
      {username && (
        <span className="text-white/40 text-[10px] normal-case">{username}</span>
      )}
      <button
        onClick={handleLogout}
        className="text-white/40 hover:text-white/70 transition-colors text-[10px] uppercase tracking-wider"
      >
        Sign out
      </button>
    </div>
  );
}

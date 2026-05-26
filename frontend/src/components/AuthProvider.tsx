"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, getApiUrl, getUsername } from "@/lib/apiFetch";
import { AuthContext } from "@/lib/authContext";

interface AuthStatus {
  authEnabled: boolean;
  hasUsers: boolean;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/setup") {
      setReady(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${getApiUrl()}/auth/status`);
        if (!res.ok) { setReady(true); return; }

        const status: AuthStatus = await res.json();

        if (!status.authEnabled) {
          setReady(true);
          return;
        }

        setAuthEnabled(true);
        setUsername(getUsername());

        if (!status.hasUsers) {
          router.replace("/setup");
          return;
        }

        if (pathname === "/login") {
          if (getToken()) { router.replace("/"); return; }
          setReady(true);
          return;
        }

        const token = getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        setReady(true);
      } catch {
        setReady(true);
      }
    })();
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authEnabled, username }}>
      {children}
    </AuthContext.Provider>
  );
}

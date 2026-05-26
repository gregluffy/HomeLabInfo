"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken, clearToken, getApiUrl } from "@/lib/apiFetch";

interface AuthStatus {
  authEnabled: boolean;
  hasUsers: boolean;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const publicPaths = ["/login", "/setup"];
    if (publicPaths.includes(pathname)) {
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

        if (!status.hasUsers) {
          router.replace("/setup");
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

  return <>{children}</>;
}

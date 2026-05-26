"use client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { clearToken, getToken } from "@/lib/apiFetch";
import { useAuth } from "@/lib/authContext";

export default function LogoutButton() {
  const { authEnabled, username } = useAuth();
  const router = useRouter();

  if (!authEnabled || !getToken()) return null;

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 normal-case">
      {username && (
        <>
          <User className="w-3 h-3 text-white/40 shrink-0" />
          <span className="text-white/60 text-[11px] font-medium">{username}</span>
          <div className="w-px h-3 bg-white/10 shrink-0" />
        </>
      )}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1 text-white/50 hover:text-red-400 transition-colors text-[11px]"
        title="Sign out"
      >
        <LogOut className="w-3 h-3 shrink-0" />
        <span>Sign out</span>
      </button>
    </div>
  );
}

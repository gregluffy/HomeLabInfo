"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl, setToken, setUsername } from "@/lib/apiFetch";

export default function SetupPage() {
  const [username, setUsernameState] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed.");
        return;
      }
      setToken(data.token);
      setUsername(data.username);
      router.replace("/");
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-neutral-950 text-white">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute w-[800px] h-[800px] bg-purple-600 rounded-full blur-[150px] -top-40 -left-20" />
        <div className="absolute w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] top-20 right-[-15%]" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.svg" alt="HomeLab Logo" className="w-14 h-14 drop-shadow-[0_0_15px_rgba(96,165,250,0.6)] mb-4" />
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="text-neutral-500 text-sm mt-1 text-center">
            Set up a username and password to protect your dashboard.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-md"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Username</label>
            <input
              required
              autoFocus
              minLength={3}
              type="text"
              value={username}
              onChange={(e) => setUsernameState(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="your-username"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">
              Password <span className="text-neutral-600">(min. 8 characters)</span>
            </label>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5">Confirm Password</label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

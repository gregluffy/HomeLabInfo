import NetworkTopologyGraph from "@/components/NetworkTopologyGraph";
import Link from "next/link";
import { Home } from "lucide-react";

export default function TopologyPage() {
  return (
    <div className="h-full bg-neutral-950 text-white font-sans flex flex-col overflow-hidden">
      <header className="px-6 py-6 border-b border-white/10 bg-black/50 backdrop-blur-md relative z-10 w-full shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-neutral-400 hover:text-white group" title="Back to Dashboard">
            <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">
              Network Topology
            </h1>
            <p className="text-neutral-400 text-xs">
              Interactive node-map of your infrastructure and connected containers.
            </p>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full bg-black/20 relative">
         <NetworkTopologyGraph />
      </main>
    </div>
  );
}

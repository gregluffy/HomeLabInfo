import NetworkTopologyGraph from "@/components/NetworkTopologyGraph";

export default function TopologyPage() {
  return (
    <div className="h-full bg-neutral-950 text-white font-sans flex flex-col overflow-hidden">
      <header className="px-6 py-6 border-b border-white/10 bg-black/50 backdrop-blur-md relative z-10 w-full shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">
              Network Topology
            </h1>
            <p className="text-neutral-400 text-xs">
              Interactive node-map of your infrastructure and connected containers.
            </p>
          </div>
          <a href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-sm font-semibold border border-white/10">
            Back to Dashboard
          </a>
        </div>
      </header>
      
      <main className="flex-1 w-full bg-black/20 relative">
         <NetworkTopologyGraph />
      </main>
    </div>
  );
}

import NetworkSummaryCard from "../components/NetworkSummaryCard";
import AppsSummaryCard from "../components/AppsSummaryCard";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30">
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 flex justify-center pointer-events-none opacity-20">
        <div className="w-[1000px] h-[1000px] bg-purple-600 rounded-full blur-[150px] -top-64 -left-32 absolute"></div>
        <div className="w-[800px] h-[800px] bg-blue-600 rounded-full blur-[150px] top-32 right-[-20%] absolute"></div>
      </div>
      
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent mb-2">
            Homelab Dashboard
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl">
            A high-level overview of your network and container typography.
          </p>
        </header>

        {/* Dashboard Grid */}
        <div className="flex flex-col gap-8">
           <NetworkSummaryCard />
           <AppsSummaryCard />
        </div>
      </main>
    </div>
  );
}

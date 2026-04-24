"use client";
import NetworkSummaryCard from "../components/NetworkSummaryCard";
import AppsSummaryCard from "../components/AppsSummaryCard";
import Link from 'next/link';
import { Network, Settings } from 'lucide-react';
import { useState } from 'react';
import SettingsModal from "../components/SettingsModal";

export default function Dashboard() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-neutral-950 text-white font-sans selection:bg-purple-500/30">
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 flex justify-center pointer-events-none opacity-20">
        <div className="w-[1000px] h-[1000px] bg-purple-600 rounded-full blur-[150px] -top-64 -left-32 absolute"></div>
        <div className="w-[800px] h-[800px] bg-blue-600 rounded-full blur-[150px] top-32 right-[-20%] absolute"></div>
      </div>
      
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12 flex justify-between items-end flex-wrap gap-6">
          <div className="flex items-center gap-6">
            <img src="/logo.svg" alt="HomeLab Logo" className="w-16 h-16 drop-shadow-[0_0_15px_rgba(96,165,250,0.6)]" />
            <div>
              <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent mb-2">
                Homelab Dashboard
              </h1>
              <p className="text-neutral-400 text-lg max-w-xl">
                A high-level overview of your network and container topography.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 px-5 py-3 rounded-xl text-white font-semibold transition-all flex items-center gap-2"
            >
              <Settings className="w-5 h-5 text-neutral-400" /> Settings
            </button>
            <Link href="/topology" className="bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl text-white font-semibold transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2">
               <Network className="w-5 h-5"/> View Interactive Topology
            </Link>
          </div>
        </header>

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
        />

        {/* Dashboard Grid */}
        <div className="flex flex-col gap-8">
           <NetworkSummaryCard />
           <AppsSummaryCard />
        </div>
      </main>
    </div>
  );
}

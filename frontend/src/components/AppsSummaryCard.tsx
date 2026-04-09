export default function AppsSummaryCard() {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl flex flex-col h-[500px] relative overflow-hidden group">
      
      {/* Visual background treatment */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none"></div>
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <h2 className="text-2xl font-bold text-white/50">Applications (VM)</h2>
      </div>

      <div className="flex-1 relative border border-white/5 bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center">
        
        {/* Placeholder UI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 w-full opacity-20 pointer-events-none mb-8">
            <div className="h-16 bg-white/10 rounded-xl"></div>
            <div className="h-16 bg-white/10 rounded-xl"></div>
            <div className="h-16 bg-white/10 rounded-xl"></div>
            <div className="h-16 bg-white/10 rounded-xl"></div>
            <div className="h-16 hidden md:block bg-white/10 rounded-xl"></div>
            <div className="h-16 hidden md:block bg-white/10 rounded-xl"></div>
        </div>

        {/* Coming Soon Lock */}
        <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[2px]">
          <div className="p-4 bg-white/10 rounded-full mb-4 border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 tracking-wide">Coming Soon</h3>
          <p className="text-sm text-neutral-400 max-w-xs text-center">
            Agent-driven application monitoring for your Docker and VM environments is currently under development.
          </p>
        </div>
        
      </div>
    </div>
  );
}

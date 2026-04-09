interface NetworkDevice {
  id: number;
  ipAddress: string;
  hostName: string;
  macAddress: string;
  status: string;
  lastSeen: string;
}

export default function DeviceCard({ device, index }: { device: NetworkDevice, index: number }) {
  const isOnline = device.status === "Online";

  return (
    <div 
        className="group relative overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-white/20"
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/0 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
          </div>
        </div>
        <div className={`px-3 py-1 text-xs font-semibold rounded-full border ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} flex items-center gap-1.5`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
            {device.status}
        </div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-xl font-bold text-white mb-1 truncate" title={device.hostName}>
            {device.hostName}
        </h3>
        <p className="text-neutral-400 font-mono text-sm mb-6 flex items-center gap-2">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
           {device.ipAddress}
        </p>
        
        <div className="pt-4 border-t border-white/10 flex justify-between items-center mt-auto">
             <div className="text-xs text-neutral-500 font-mono bg-black/20 px-2 py-1 rounded">
                 {device.macAddress || 'No MAC visible'}
             </div>
        </div>
      </div>
    </div>
  );
}

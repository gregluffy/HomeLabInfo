"use client";

import { useEffect, useState } from "react";
import Link from 'next/link';

interface NetworkDevice {
  id: number;
  ipAddress: string;
  hostName: string;
  status: string;
}

export default function NetworkSummaryCard() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [baseIp, setBaseIp] = useState("192.168.2.");
  const [deepScan, setDeepScan] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${apiUrl}/scanner/devices`);
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error("Failed to fetch devices", err);
    }
  };

  // Load saved base IP from DB on mount
  useEffect(() => {
    fetchDevices();

    (async () => {
      try {
        const res = await fetch(`${apiUrl}/settings/BaseIpPrefix`);
        if (res.ok) {
          const data = await res.json();
          if (data.value) setBaseIp(data.value);
        }
      } catch {
        // Setting doesn't exist yet, use default
      }
    })();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      // Persist the base IP for next time
      await fetch(`${apiUrl}/settings/BaseIpPrefix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: baseIp })
      }).catch(() => {});

      const res = await fetch(`${apiUrl}/scanner/scan?baseIp=${baseIp}&doPortScan=${deepScan}`, { method: "POST" });
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error("Failed to scan", err);
    } finally {
      setIsScanning(false);
    }
  };

  const onlineCount = devices.filter(d => d.status === "Online").length;
  const offlineCount = devices.filter(d => d.status === "Offline").length;

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl flex flex-col h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/network" className="group flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">Network</h2>
              <svg className="w-5 h-5 text-neutral-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </Link>
          
          {(onlineCount > 0 || offlineCount > 0) && (
            <div className="flex gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    {onlineCount} Online
                </span>
                {offlineCount > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {offlineCount} Offline
                  </span>
                )}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 p-1 bg-black/40 rounded-xl items-center border border-white/5">
            <input 
              type="text" 
              value={baseIp} 
              onChange={(e) => setBaseIp(e.target.value)}
              className="bg-transparent px-3 py-1 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 w-28 font-mono text-xs rounded-lg"
              placeholder="192.168.1."
            />

            {/* Deep Scan Toggle */}
            <div className="relative group flex items-center gap-1.5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={deepScan}
                  onChange={(e) => setDeepScan(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
              <span className="text-[10px] font-semibold text-neutral-400 whitespace-nowrap select-none">Deep</span>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl text-xs text-neutral-300 leading-relaxed shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                <p className="font-bold text-white mb-1">🔍 Deep Scan</p>
                <p>Probes open ports (SSH, HTTP) to identify device OS and services.</p>
                <p className="mt-2 text-amber-400/90">⚠️ Disable if strict firewalls or IDS/IPS may flag port scanning.</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-neutral-900"></div>
              </div>
            </div>

            <button 
              onClick={handleScan}
              disabled={isScanning}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              {isScanning ? "Scanning..." : "Scan"}
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {devices.length === 0 && !isScanning ? (
           <div className="text-neutral-500 text-sm text-center mt-10">No devices found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {devices.map((device) => (
              <Link href="/network" key={device.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer group">
                <div className="overflow-hidden pr-2">
                  <p className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">{device.hostName}</p>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">{device.ipAddress}</p>
                </div>
                <div className="flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${device.status === 'Online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} title={device.status}></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

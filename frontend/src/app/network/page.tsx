"use client";

import { useEffect, useState } from "react";
import DeviceCard from "../../components/DeviceCard";
import Link from 'next/link';

interface NetworkDevice {
  id: number;
  ipAddress: string;
  hostName: string;
  macAddress: string;
  status: string;
  lastSeen: string;
}

export default function NetworkDetails() {
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

      const res = await fetch(`${apiUrl}/scanner/scan?baseIp=${baseIp}&doPortScan=${deepScan}`, {
        method: "POST"
      });
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error("Failed to scan", err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 z-0 flex justify-center pointer-events-none opacity-20">
        <div className="w-[1000px] h-[1000px] bg-purple-600 rounded-full blur-[150px] -top-64 -left-32 absolute"></div>
        <div className="w-[800px] h-[800px] bg-blue-600 rounded-full blur-[150px] top-32 right-[-20%] absolute"></div>
      </div>
      
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to Dashboard
        </Link>
        <header className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
          <div className="flex items-center gap-6">
            <img src="/logo.svg" alt="HomeLab Logo" className="w-16 h-16 drop-shadow-[0_0_15px_rgba(96,165,250,0.6)] hidden sm:block" />
            <div>
              <h1 className="text-5xl font-black tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent mb-2">
                Homelab Topology
              </h1>
              <p className="text-neutral-400 text-lg max-w-xl">
                Real-time monitoring and discovery of your network infrastructure.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 p-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl items-center shadow-2xl">
              <input 
                type="text" 
                value={baseIp} 
                onChange={(e) => setBaseIp(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-40 font-mono text-sm"
                placeholder="192.168.1."
              />

              {/* Deep Scan Toggle */}
              <div className="relative group flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deepScan}
                    onChange={(e) => setDeepScan(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <span className="text-xs font-semibold text-neutral-300 whitespace-nowrap select-none">Deep Scan</span>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-3 bg-neutral-900 border border-white/10 rounded-xl text-xs text-neutral-300 leading-relaxed shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                  <p className="font-bold text-white mb-1">🔍 Deep Scan</p>
                  <p>When enabled, the scanner probes open ports (SSH, HTTP) to identify device operating systems and running services.</p>
                  <p className="mt-2 text-amber-400/90">⚠️ Disable this if your network has strict firewalls or IDS/IPS that may flag port scanning activity.</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-neutral-900"></div>
                </div>
              </div>

              <button 
                onClick={handleScan}
                disabled={isScanning}
                className="relative overflow-hidden group bg-white text-black font-semibold px-8 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                {isScanning ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scanning...
                  </span>
                ) : "Run Scan"}
              </button>
          </div>
        </header>

        {devices.length === 0 && !isScanning ? (
          <div className="flex flex-col items-center justify-center p-24 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
            <h3 className="text-2xl font-bold mb-3 text-white">No devices found</h3>
            <p className="text-neutral-400">Run a scan to discover agents and devices on your network.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 ml:grid-cols-3 xl:grid-cols-4 gap-6">
            {devices.map((device, idx) => (
              <DeviceCard key={device.id} device={device} index={idx} />
            ))}
            
            {isScanning && (
              <div className="col-span-1 min-h-[200px] bg-white/5 border border-white/10 rounded-3xl animate-pulse backdrop-blur-md p-6 flex flex-col justify-between">
                <div>
                   <div className="w-24 h-6 bg-white/10 rounded-full mb-4"></div>
                   <div className="w-48 h-8 bg-white/10 rounded-md mb-2"></div>
                   <div className="w-32 h-5 bg-white/10 rounded-md"></div>
                </div>
                <div className="w-full h-10 bg-white/5 rounded-xl"></div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

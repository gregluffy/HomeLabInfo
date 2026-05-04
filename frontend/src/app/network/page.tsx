"use client";

import { useEffect, useState, useMemo } from "react";
import DeviceCard from "../../components/DeviceCard";
import Link from 'next/link';
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Download, Home } from 'lucide-react';

interface NetworkDevice {
  id: number;
  ipAddress: string;
  hostName: string;
  macAddress: string;
  status: string;
  lastSeen: string;
}

type SortField = 'ip' | 'hostname' | 'status' | 'lastSeen';
type SortDir = 'asc' | 'desc';

function compareIp(a: string, b: string): number {
  const toNum = (ip: string) => ip.split('.').map(Number);
  const [a1, a2, a3, a4] = toNum(a);
  const [b1, b2, b3, b4] = toNum(b);
  return a1 - b1 || a2 - b2 || a3 - b3 || a4 - b4;
}

export default function NetworkDetails() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [baseIp, setBaseIp] = useState("192.168.2.");
  const [deepScan, setDeepScan] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('ip');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  useEffect(() => {
    fetchDevices();
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/settings/BaseIpPrefix`);
        if (res.ok) {
          const data = await res.json();
          if (data.value) setBaseIp(data.value);
        }
      } catch { /* use default */ }
      
      try {
        const res = await fetch(`${apiUrl}/settings/LivePollingEnabled`);
        if (res.ok) {
          const data = await res.json();
          if (data.value) setIsPolling(data.value === 'true');
        }
      } catch { }

      try {
        const res = await fetch(`${apiUrl}/settings/DeepScanEnabled`);
        if (res.ok) {
          const data = await res.json();
          if (data.value) setDeepScan(data.value === 'true');
        }
      } catch { }
    })();
  }, []);

  const handlePollingToggle = (enabled: boolean) => {
    setIsPolling(enabled);
    fetch(`${apiUrl}/settings/LivePollingEnabled`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: enabled.toString() })
    }).catch(() => {});
  };

  const handleDeepScanToggle = (enabled: boolean) => {
    setDeepScan(enabled);
    fetch(`${apiUrl}/settings/DeepScanEnabled`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: enabled.toString() })
    }).catch(() => {});
  };

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      if (!isScanning) fetchDevices();
    }, 10000);
    return () => clearInterval(interval);
  }, [isScanning, isPolling]);

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      await fetch(`${apiUrl}/settings/BaseIpPrefix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: baseIp })
      }).catch(() => {});
      const res = await fetch(`${apiUrl}/scanner/scan?baseIp=${baseIp}&doPortScan=${deepScan}`, { method: "POST" });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error("Failed to scan", err);
      setScanError("Failed to connect to the scanner API. Please verify that the backend service is running.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(devices, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network_topology_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all network device records? This cannot be undone.")) return;
    try {
      await fetch(`${apiUrl}/scanner/devices/all`, { method: "DELETE" });
      setDevices([]);
    } catch (err) {
      console.error("Failed to clear devices", err);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'ip') cmp = compareIp(a.ipAddress, b.ipAddress);
      else if (sortField === 'hostname') cmp = (a.hostName || '').localeCompare(b.hostName || '');
      else if (sortField === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      else if (sortField === 'lastSeen') cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [devices, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-400" /> : <ArrowDown className="w-3 h-3 text-purple-400" />;
  };

  const sortButtons: { field: SortField; label: string }[] = [
    { field: 'ip', label: 'IP Address' },
    { field: 'hostname', label: 'Hostname' },
    { field: 'status', label: 'Status' },
    { field: 'lastSeen', label: 'Last Seen' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-neutral-950 text-white font-sans selection:bg-purple-500/30">
      <div className="fixed inset-0 z-0 flex justify-center pointer-events-none opacity-20">
        <div className="w-[1000px] h-[1000px] bg-purple-600 rounded-full blur-[150px] -top-64 -left-32 absolute"></div>
        <div className="w-[800px] h-[800px] bg-blue-600 rounded-full blur-[150px] top-32 right-[-20%] absolute"></div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-neutral-400 hover:text-white group" title="Back to Dashboard">
              <Home className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </Link>
            <img src="/logo.svg" alt="HomeLab Logo" className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-[0_0_15px_rgba(96,165,250,0.6)] hidden xs:block" />
            <div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent mb-1 sm:mb-2">
                Homelab Topology
              </h1>
              <p className="text-neutral-400 text-sm sm:text-lg max-w-xl">
                Real-time monitoring and discovery of your network infrastructure.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl items-center shadow-2xl w-full lg:w-auto">
            <input
              type="text"
              value={baseIp}
              onChange={(e) => setBaseIp(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-full sm:w-40 font-mono text-sm"
              placeholder="192.168.1."
            />
            <div className="flex items-center gap-4 flex-1 justify-between sm:justify-start">
              <div className="relative group flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={deepScan} onChange={(e) => handleDeepScanToggle(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <label className="text-xs font-semibold text-neutral-300 whitespace-nowrap select-none cursor-pointer" onClick={() => handleDeepScanToggle(!deepScan)}>Deep Scan</label>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 text-neutral-300 text-[10px] leading-snug rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 border border-white/10 text-center">
                  Perform a thorough port scan to discover more device details. This will take significantly longer.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10"></div>
                </div>
              </div>

              <div className="relative group flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isPolling} onChange={(e) => handlePollingToggle(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
                <label className="text-xs font-semibold text-neutral-300 whitespace-nowrap select-none cursor-pointer" onClick={() => handlePollingToggle(!isPolling)}>Live Polling</label>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-neutral-900 text-neutral-300 text-[10px] leading-snug rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 border border-white/10 text-center">
                  Enable auto-polling to see new devices in real-time if you trigger network scans from external applications (like n8n).
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10"></div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={isScanning}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-semibold p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                  title="Clear All Devices"
                >
                  <Trash2 className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                </button>
                <button
                  onClick={handleExportJson}
                  disabled={devices.length === 0}
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-semibold p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                  title="Export Topology to JSON"
                >
                  <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                </button>
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="relative overflow-hidden group bg-white text-black font-semibold px-6 sm:px-8 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 flex-1 sm:flex-none"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  {isScanning ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden sm:inline">Scanning...</span>
                      <span className="sm:hidden">...</span>
                    </span>
                  ) : "Run Scan"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {scanError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {scanError}
          </div>
        )}

        {/* Sort Bar */}
        {devices.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mr-1">Sort by</span>
            {sortButtons.map(({ field, label }) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border
                  ${sortField === field
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
              >
                {label}
                <SortIcon field={field} />
              </button>
            ))}
            <span className="ml-auto text-xs text-neutral-600 font-mono">
              {devices.length} device{devices.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {sortedDevices.length === 0 && !isScanning ? (
          <div className="flex flex-col items-center justify-center p-24 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
            <h3 className="text-2xl font-bold mb-3 text-white">No devices found</h3>
            <p className="text-neutral-400">Run a scan to discover agents and devices on your network.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedDevices.map((device, idx) => (
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

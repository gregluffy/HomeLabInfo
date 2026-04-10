"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Server, Activity, HardDrive, Cpu, Box, Plus, Trash2, Edit2, X } from "lucide-react";
import AddAgentModal from "./AddAgentModal";

export default function AppsSummaryCard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState<any>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(5000);

  const loadAgents = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`)
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error("Failed to fetch agents", err));
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this agent?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${id}`, { method: "DELETE" });
      loadAgents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl flex flex-col min-h-[500px] relative group">
      {/* We removed overflow-hidden to allow children portals if needed, but portal moves it out anyway */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none rounded-3xl mix-blend-overlay"></div>
      
      <div className="flex justify-between items-center mb-6 relative z-10 w-full flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white/90 flex items-center gap-2">
          <Server className="w-6 h-6 text-indigo-400" /> Virtual Machines
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="bg-black/30 border border-white/10 rounded-lg flex items-center px-3 py-1.5 h-full">
            <span className="text-xs text-neutral-400 mr-2 font-semibold">Live Refresh:</span>
            <select 
              className="bg-transparent text-sm text-white outline-none cursor-pointer"
              value={refreshInterval || 0}
              onChange={(e) => setRefreshInterval(Number(e.target.value) === 0 ? null : Number(e.target.value))}
            >
              <option value={0} className="bg-neutral-900">Off</option>
              <option value={5000} className="bg-neutral-900">5s</option>
              <option value={10000} className="bg-neutral-900">10s</option>
              <option value={30000} className="bg-neutral-900">30s</option>
            </select>
          </div>

          <button 
            onClick={() => { setAgentToEdit(null); setIsModalOpen(true); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/20">
            <Plus className="w-4 h-4" /> Add Agent
          </button>
        </div>
      </div>

      <div className="flex-1 relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full border border-white/5 bg-black/20 rounded-2xl p-8 flex flex-col items-center justify-center">
            <h3 className="text-xl font-bold text-white mb-2">No Agents Connected</h3>
            <p className="text-sm text-neutral-400 max-w-xs text-center mb-4">
              Register an agent in the backend to start monitoring your VMs.
            </p>
          </div>
        ) : (
          agents.map((agent) => (
             <VmAgentDetails 
               key={agent.id} 
               agent={agent} 
               refreshIntervalMs={refreshInterval}
               onEdit={() => { setAgentToEdit(agent); setIsModalOpen(true); }} 
               onDelete={() => handleDelete(agent.id)} 
             />
          ))
        )}
      </div>
      
      <AddAgentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdded={loadAgents} 
        agentToEdit={agentToEdit}
      />
    </div>
  );
}

function VmAgentDetails({ agent, onEdit, onDelete, refreshIntervalMs }: { agent: any; onEdit: () => void; onDelete: () => void; refreshIntervalMs: number | null }) {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<boolean>(false);
  const [showContainers, setShowContainers] = useState(false);

  useEffect(() => {
    const fetchStats = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agent.id}/stats`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Agent unreachable");
          }
          return res.json();
        })
        .then((data) => {
          setStats(data);
          setError(false);
        })
        .catch((err) => {
          setError(true);
        });
    };

    fetchStats(); // Fetch immediately on mount

    if (refreshIntervalMs) {
      const id = setInterval(fetchStats, refreshIntervalMs);
      return () => clearInterval(id);
    }
  }, [agent.id, refreshIntervalMs]);

  return (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/10 transition-colors flex flex-col group/card relative">
      <div className="absolute top-4 right-4 hidden group-hover/card:flex items-center gap-1.5 z-20 bg-neutral-900/80 backdrop-blur-sm p-1 rounded-lg border border-white/10 shadow-lg">
         <button onClick={onEdit} className="p-1.5 hover:bg-white/10 rounded-md text-neutral-400 hover:text-white transition-colors" title="Edit Agent">
           <Edit2 className="w-3.5 h-3.5" />
         </button>
         <button onClick={onDelete} className="p-1.5 hover:bg-red-500/20 rounded-md text-neutral-400 hover:text-red-400 transition-colors" title="Remove Agent">
           <Trash2 className="w-3.5 h-3.5" />
         </button>
      </div>

      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 pr-16 relative z-10 w-full">
        <span className="truncate">{agent.name}</span>
        <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0 ${stats ? 'bg-green-400 text-green-400' : error ? 'bg-red-600 text-red-600' : 'bg-yellow-400 text-yellow-400'}`}></div>
      </h3>
      
      {error ? (
        <div className="flex flex-col items-center justify-center flex-1 py-4 bg-black/20 rounded-xl border border-red-500/20 text-red-400/80 relative z-10">
          <Activity className="w-6 h-6 mb-2 opacity-50" />
          <span className="text-sm font-semibold">Unreachable</span>
          <span className="text-[10px] text-red-400/50 font-mono mt-1 px-4 text-center truncate w-full">{agent.endpointUrl}</span>
        </div>
      ) : stats ? (
        <div className="space-y-5 flex-1 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-start bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-neutral-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Cpu className="w-3 h-3"/> CPU</span>
              <span className="font-mono text-sm font-semibold text-white/90">{stats.host.cpuPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex flex-col items-start bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-neutral-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Activity className="w-3 h-3"/> RAM</span>
              <span className="font-mono text-sm font-semibold text-white/90">{(stats.host.memoryUsedMB/1024).toFixed(1)}G</span>
            </div>
            <div className="flex flex-col items-start bg-black/30 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-neutral-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><HardDrive className="w-3 h-3"/> Disk</span>
              <span className="font-mono text-sm font-semibold text-white/90">{stats.host.diskUsedGB.toFixed(1)}G</span>
            </div>
          </div>
          <div 
            onClick={() => setShowContainers(true)}
            className="mt-4 p-2 -mx-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group/clist"
            title="Click to view all containers"
          >
            <span className="text-xs text-indigo-300 font-bold uppercase mb-2 flex items-center justify-between tracking-wider">
               <span className="flex items-center gap-1"><Box className="w-3 h-3" /> Containers ({stats.containers?.length || 0})</span>
               <span className="opacity-0 group-hover/clist:opacity-100 transition-opacity text-[10px] text-indigo-400">View All &rarr;</span>
            </span>
            <div className="flex flex-wrap gap-1.5 text-white/80">
              {stats.containers?.slice(0, 7).map((c: any) => (
                <span key={c.id} title={c.name} className="text-xs px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md truncate max-w-[120px]">
                  {c.name}
                </span>
              ))}
              {stats.containers?.length > 7 && (
                 <span className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded-md">+{stats.containers.length - 7}</span>
              )}
            </div>
          </div>
          <ContainersModal 
            isOpen={showContainers} 
            onClose={() => setShowContainers(false)} 
            agentName={agent.name} 
            containers={stats.containers || []} 
          />
        </div>
      ) : (
        <div className="animate-pulse flex flex-col gap-3 flex-1 mt-2 relative z-10">
          <div className="h-16 bg-white/5 rounded-xl w-full"></div>
          <div className="h-8 bg-white/5 rounded-xl w-3/4 mt-4"></div>
        </div>
      )}
    </div>
  );
}

function ContainersModal({ isOpen, onClose, agentName, containers }: { isOpen: boolean, onClose: () => void, agentName: string, containers: any[] }) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-indigo-400" /> 
            Containers on {agentName}
          </h2>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto min-h-[300px]">
          {containers.length === 0 ? (
            <div className="text-center text-neutral-400 py-10">No containers found on this agent.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {containers.map(c => (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-white truncate pr-2 text-sm" title={c.name}>{c.name}</span>
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_currentColor] ${c.state === 'running' ? 'bg-green-400 text-green-400 animate-pulse' : 'bg-red-500 text-red-500'}`} title={c.state}></div>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono truncate mb-4" title={c.image}>{c.image}</div>
                  <div className="mt-auto flex gap-2">
                     <span className="text-[10px] px-2 py-1 rounded-md bg-black/40 border border-white/10 uppercase font-semibold text-neutral-300">{c.state}</span>
                     <span className="text-[10px] px-2 py-1 rounded-md bg-black/40 border border-white/10 text-neutral-400 truncate w-full" title={c.status}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

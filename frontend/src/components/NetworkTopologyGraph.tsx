"use client";

import { useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Router } from 'lucide-react';

// Custom Node types
function VmNode({ data }: { data: any }) {
  return (
    <div className="bg-neutral-900 border-[3px] border-indigo-500/80 p-5 rounded-2xl shadow-xl shadow-indigo-900/30 w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3" />
      <div className="flex items-center gap-3 border-b border-indigo-500/30 pb-3 mb-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <Server className="w-5 h-5 text-indigo-400" />
        </div>
        <h3 className="text-[15px] font-bold text-white truncate">{data.label}</h3>
      </div>
      <div className="flex justify-between items-center text-xs font-mono">
         <span className="text-neutral-500">TYPE</span>
         <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">VM AGENT</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3" />
    </div>
  );
}

function DeviceNode({ data }: { data: any }) {
  return (
    <div className="bg-neutral-900 border-[3px] border-emerald-500/80 p-5 rounded-2xl shadow-xl shadow-emerald-900/30 w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-emerald-500 !w-3 !h-3" />
      <div className="flex items-center gap-3 border-b border-emerald-500/30 pb-3 mb-3">
        <div className="p-2 bg-emerald-500/20 rounded-lg">
          <Router className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="text-[15px] font-bold text-white truncate">{data.label}</h3>
      </div>
      <div className="flex justify-between items-center text-xs font-mono">
         <span className="text-neutral-500">IP</span>
         <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">{data.ip}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = {
  vm: VmNode,
  device: DeviceNode,
};

export default function NetworkTopologyGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [devicesRes, agentsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/devices`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`)
        ]);
        
        const devices = await devicesRes.json();
        const agents = await agentsRes.json();
        
        const initialNodes: Node[] = [];
        const initialEdges: Edge[] = [];
        
        // Base Network Router Node
        initialNodes.push({
          id: 'router',
          type: 'device',
          position: { x: window.innerWidth / 2 - 100, y: 100 },
          data: { label: 'Main Router', ip: '192.168.1.1' }
        });

        // Add scanned devices
        devices.forEach((d: any, index: number) => {
          if (d.ipAddress === "192.168.1.1") return; // skip if same as main router
          const id = `dev-${d.id}`;
          initialNodes.push({
            id,
            type: 'device',
            position: { x: 100 + (index * 250), y: 350 },
            data: { label: d.hostName || d.macAddress || 'Unknown Device', ip: d.ipAddress }
          });
          initialEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true, style: { stroke: '#10b981', strokeWidth: 2 } });
        });

        // Add agents
        agents.forEach((a: any, index: number) => {
          const id = `agent-${a.id}`;
          initialNodes.push({
            id,
            type: 'vm',
            position: { x: 200 + (index * 250), y: 600 },
            data: { label: a.name }
          });
          initialEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } });
        });

        setNodes(initialNodes);
        setEdges(initialEdges);
      } catch (err) {
        console.error("Failed to load topology", err);
      }
    }
    
    fetchData();
  }, [setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        className="bg-neutral-950"
      >
        <Controls className="bg-black/80 border-white/10" />
        <MiniMap className="bg-black/50 border-white/5 rounded-xl overflow-hidden" maskColor="rgba(0,0,0,0.8)" nodeColor="#6366f1"/>
        <Background variant={BackgroundVariant.Dots} gap={32} size={2} color="#ffffff20" />
      </ReactFlow>
    </div>
  );
}

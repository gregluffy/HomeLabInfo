"use client";

import { useEffect, useCallback, useState, useRef } from 'react';
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
  Position,
  NodeMouseHandler,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Router, Download, X, Save, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';

// Custom Node types
function VmNode({ data }: { data: any }) {
  return (
    <div className="bg-neutral-900 border-[3px] border-indigo-500/80 p-5 rounded-2xl shadow-lg shadow-indigo-900/30 w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3" />
      <div className="flex items-center gap-3 border-b border-indigo-500/30 pb-3 mb-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0">
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
  const isOffline = data.status === 'Offline';
  
  return (
    <div className={`bg-neutral-900 border-[3px] p-5 rounded-2xl shadow-lg w-[220px] transition-all hover:scale-105 cursor-pointer 
      ${isOffline ? 'border-dashed border-rose-500/50 opacity-60 grayscale' : 'border-emerald-500/80 shadow-emerald-900/30'}`}>
      <Handle type="target" position={Position.Top} className={`!w-3 !h-3 ${isOffline ? '!bg-rose-500' : '!bg-emerald-500'}`} />
      <div className={`flex items-center gap-3 border-b pb-3 mb-3 ${isOffline ? 'border-rose-500/30' : 'border-emerald-500/30'}`}>
        <div className={`p-2 rounded-lg shrink-0 ${isOffline ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          <Router className="w-5 h-5" />
        </div>
        <h3 className="text-[15px] font-bold text-white truncate" title={data.label}>{data.label}</h3>
      </div>
      <div className="flex justify-between items-center text-xs font-mono">
         <span className="text-neutral-500">{isOffline ? 'OFFLINE' : 'IP'}</span>
         <span className={`${isOffline ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-300 bg-emerald-500/10'} font-bold px-2 py-0.5 rounded`}>
           {data.ip}
         </span>
      </div>
      <Handle type="source" position={Position.Bottom} className={`!w-3 !h-3 ${isOffline ? '!bg-rose-500' : '!bg-emerald-500'}`} />
    </div>
  );
}

const nodeTypes = {
  vm: VmNode,
  device: DeviceNode,
};

function InnerGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [editName, setEditName] = useState("");
  const flowRef = useRef<HTMLDivElement>(null);
  const { getNodes } = useReactFlow(); // Official XYFlow Context hooks

  const loadGraph = useCallback(async () => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];
    
    // Base Network Router Node (ALWAYS added)
    initialNodes.push({
      id: 'router',
      type: 'device',
      position: { x: window.innerWidth / 2 - 100, y: 100 },
      data: { label: 'Main Router', ip: '192.168.1.1', status: 'Online' }
    });

    try {
      const [devicesRes, agentsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices`).catch((e) => { console.error("Device fetch error", e); return null; }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`).catch((e) => { console.error("Agent fetch error", e); return null; })
      ]);
      
      let devices = [];
      let agents = [];
      
      if (devicesRes && devicesRes.ok) {
         try { devices = await devicesRes.json(); } catch(e) { console.error("Device JSON error", e); }
      }
      if (agentsRes && agentsRes.ok) {
         try { agents = await agentsRes.json(); } catch(e) { console.error("Agent JSON error", e); }
      }

      if (Array.isArray(devices)) {
        devices.forEach((d: any, index: number) => {
          if (d.ipAddress === "192.168.1.1") return; 
          const id = `dev-${d.id}`;
          initialNodes.push({
            id,
            type: 'device',
            position: { x: d.positionX ?? (100 + (index * 250)), y: d.positionY ?? 350 },
            data: { label: d.hostName || d.macAddress || 'Unknown Device', ip: d.ipAddress, status: d.status, rawDevice: d }
          });
          initialEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: d.status === 'Online', style: { stroke: d.status === 'Online' ? '#10b981' : '#f43f5e', strokeWidth: 2, opacity: d.status === 'Online' ? 1 : 0.4 } });
        });
      }

      if (Array.isArray(agents)) {
        agents.forEach((a: any, index: number) => {
          const id = `agent-${a.id}`;
          initialNodes.push({
            id,
            type: 'vm',
            position: { x: a.positionX ?? (200 + (index * 250)), y: a.positionY ?? 600 },
            data: { label: a.name, rawAgent: a }
          });
          initialEdges.push({ id: `e-router-${id}`, source: 'router', target: id, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } });
        });
      }
    } catch (err) {
      console.error("Failed to load topology", err);
    } finally {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Handle Drag Position Saving
  const onNodeDragStop = useCallback(async (event: any, node: Node) => {
    try {
      if (node.id.startsWith('dev-')) {
         const devId = node.id.replace('dev-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices/${devId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y })
         });
      } else if (node.id.startsWith('agent-')) {
         const agentId = node.id.replace('agent-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y })
         });
      }
    } catch(err) { console.error("Failed to save coordinates: ", err); }
  }, []);

  // Handle PNG Export
  const downloadGraph = () => {
    const nodesBounds = getNodesBounds(nodes);
    const padding = 200;
    const imageWidth = nodesBounds.width + padding * 2;
    const imageHeight = nodesBounds.height + padding * 2;

    const viewport = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2,
      0 // padding
    );

    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewportEl) return;

    toPng(viewportEl, {
      backgroundColor: '#0a0a0a',
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `homelab-topology-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    });
  }

  // Handle Modals 
  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.id === 'router') return; // Cannot edit main router
    setEditingNode(node);
    setEditName(node.data.label as string);
  }, []);

  const saveEdit = async () => {
    if (!editingNode) return;
    try {
       if (editingNode.id.startsWith('dev-')) {
         const devId = editingNode.id.replace('dev-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices/${devId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ hostName: editName })
         });
       } else if (editingNode.id.startsWith('agent-')) {
         const agentId = editingNode.id.replace('agent-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: editName })
         });
       }
       setEditingNode(null);
       loadGraph(); // Refresh to assert changes
    } catch(e) { console.error(e); }
  }

  const deleteNode = async () => {
    if (!editingNode) return;
    if (!confirm("Are you sure you want to completely remove this node from the database?")) return;
    try {
       if (editingNode.id.startsWith('dev-')) {
         const devId = editingNode.id.replace('dev-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices/${devId}`, { method: 'DELETE' });
       } else if (editingNode.id.startsWith('agent-')) {
         const agentId = editingNode.id.replace('agent-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentId}`, { method: 'DELETE' });
       }
       setEditingNode(null);
       loadGraph(); 
    } catch(e) { console.error(e); }
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '800px', display: 'flex', flexDirection: 'column' }} className="relative">
      {nodes.length > 0 ? (
        <ReactFlow
          ref={flowRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          minZoom={0.1}
          maxZoom={4}
          className="bg-neutral-950 flex-1 w-full relative z-0"
        >
          <Controls className="bg-black/80 border-white/10" style={{ zIndex: 10 }} />
          <MiniMap className="bg-black/50 border-white/5 rounded-xl overflow-hidden" maskColor="rgba(0,0,0,0.8)" nodeColor="#6366f1" style={{ zIndex: 10 }}/>
          <Background variant={BackgroundVariant.Dots} gap={32} size={2} color="#ffffff20" />
          
          <Panel position="top-right" className="!m-6">
            <button 
              onClick={downloadGraph}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Download className="w-4 h-4" /> Export as PNG
            </button>
          </Panel>
        </ReactFlow>
      ) : (
        <div className="flex-1 w-full flex items-center justify-center text-neutral-500 font-bold bg-neutral-900 border border-white/10 m-4 rounded-2xl">
           Building Topology Map... Please Wait
        </div>
      )}

      {/* Editor Modal */}
      {editingNode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-white">Edit Node</h3>
              <button onClick={() => setEditingNode(null)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <label className="text-sm font-semibold text-neutral-300 mb-2">Display Name</label>
            <input 
              type="text" 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 transition-colors w-full mb-6"
            />

            <div className="flex justify-between items-center pt-4 border-t border-white/5">
              <button 
                 onClick={deleteNode} 
                 className={`flex items-center gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-lg font-semibold transition-colors ${editingNode.data.status === 'Online' ? 'opacity-50 cursor-not-allowed' : ''}`}
                 disabled={editingNode.data.status === 'Online'} // Only offline devices should be deleted safely
                 title={editingNode.data.status === 'Online' ? "Cannot delete Online entities. They must be offline first." : ""}
              >
                 <Trash2 className="w-4 h-4" /> Delete
              </button>
              
              <button onClick={saveEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors">
                <Save className="w-4 h-4"/> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

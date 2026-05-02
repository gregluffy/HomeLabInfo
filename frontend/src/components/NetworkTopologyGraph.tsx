"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
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
  getViewportForBounds,
  Viewport
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Server, Router, Download, X, Save, Trash2, Box, Network } from 'lucide-react';
import { toPng } from 'html-to-image';

// Custom Node types
function MetricBar({ label, used, total, unit, decimals = 0 }: { label: string; used: number; total: number; unit: string; decimals?: number }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit}`;
  const barColor = pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-400' : 'bg-indigo-500';
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
        <span className="text-neutral-500">{label}</span>
        <span className="text-indigo-300/90">{fmt(used)}&nbsp;/&nbsp;{fmt(total)}&nbsp;<span className="text-neutral-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function VmNode({ data }: { data: any }) {
  const hasMetrics = data.memTotal != null && data.memTotal > 0;
  return (
    <div className="bg-neutral-900 border-[3px] border-indigo-500/80 p-5 rounded-2xl shadow-lg shadow-indigo-900/30 w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3" />
      <div className="flex items-center gap-3 border-b border-indigo-500/30 pb-3 mb-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0">
          <Server className="w-5 h-5 text-indigo-400" />
        </div>
        <h3 className="text-[15px] font-bold text-white truncate">{data.label}</h3>
      </div>
      <div className="flex justify-between items-center text-xs font-mono mb-3">
         <span className="text-neutral-500">TYPE</span>
         <span className="text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">VM AGENT</span>
      </div>
      {hasMetrics && (
        <div className="border-t border-indigo-500/20 pt-3 space-y-2">
          <MetricBar label="RAM" used={data.memUsed / 1024} total={data.memTotal / 1024} unit="GB" decimals={1} />
          <MetricBar label="DISK" used={data.diskUsed} total={data.diskTotal} unit="GB" decimals={1} />
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3" />
    </div>
  );
}

function DeviceNode({ data }: { data: any }) {
  const isOffline = data.status === 'Offline';
  
  return (
    <div className={`bg-neutral-900 border-[3px] p-5 rounded-2xl shadow-lg w-[220px] transition-all hover:ring-2 hover:ring-offset-2 hover:ring-offset-neutral-900 hover:ring-current cursor-pointer 
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

function ContainerNode({ data }: { data: any }) {
  const isRunning = data.state === 'running';

  return (
    <div className={`bg-neutral-900/90 border-2 p-4 rounded-xl shadow-md w-[190px] transition-all hover:ring-2 hover:ring-offset-2 hover:ring-offset-neutral-900 hover:ring-current cursor-pointer
      ${isRunning ? 'border-cyan-500/70 shadow-cyan-900/20' : 'border-neutral-600/50 opacity-60'}`}>
      <Handle type="target" position={Position.Top} className={`!w-2.5 !h-2.5 ${isRunning ? '!bg-cyan-500' : '!bg-neutral-500'}`} />
      <div className={`flex items-center gap-2.5 border-b pb-2.5 mb-2.5 ${isRunning ? 'border-cyan-500/20' : 'border-neutral-700/30'}`}>
        <div className={`p-1.5 rounded-md shrink-0 ${isRunning ? 'bg-cyan-500/15 text-cyan-400' : 'bg-neutral-700/20 text-neutral-500'}`}>
          <Box className="w-4 h-4" />
        </div>
        <h3 className="text-[13px] font-bold text-white truncate" title={data.label}>{data.label}</h3>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-mono">
           <span className="text-neutral-500">IMAGE</span>
           <span className="text-cyan-300/80 truncate max-w-[100px]" title={data.image}>{data.image}</span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono">
           <span className="text-neutral-500">STATE</span>
           <span className={`font-bold px-1.5 py-0.5 rounded ${isRunning ? 'text-cyan-300 bg-cyan-500/10' : 'text-neutral-400 bg-neutral-700/20'}`}>
             {data.statusText || data.state}
           </span>
        </div>
      </div>
    </div>
  );
}

function SubnetNode({ data }: { data: any }) {
  return (
    <div className="bg-neutral-900 border-[3px] border-violet-500/80 p-4 rounded-2xl shadow-lg shadow-violet-900/30 w-[210px]">
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3" />
      <div className="flex items-center gap-3 border-b border-violet-500/30 pb-3 mb-3">
        <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
          <Network className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-white truncate">{data.label}</h3>
          <span className="text-[10px] text-violet-300/70 font-mono">{data.cidr}</span>
        </div>
      </div>
      <div className="flex justify-between items-center text-xs font-mono">
        <span className="text-neutral-500">DEVICES</span>
        <span className="text-violet-300 bg-violet-500/10 font-bold px-2 py-0.5 rounded">{data.deviceCount}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes = {
  vm: VmNode,
  device: DeviceNode,
  container: ContainerNode,
  subnet: SubnetNode,
};

function InnerGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [editName, setEditName] = useState("");
  const [editIp, setEditIp] = useState("");
  const flowRef = useRef<HTMLDivElement>(null);
  const { getNodes } = useReactFlow(); // Official XYFlow Context hooks

  const [routerIp, setRouterIp] = useState("192.168.1.1");
  const [routerPos, setRouterPos] = useState({ x: 0, y: 100 });
  const [routerLoaded, setRouterLoaded] = useState(false);

  // Restore saved viewport (zoom + pan) from localStorage
  const savedViewport = useMemo<Viewport | null>(() => {
    try {
      const raw = localStorage.getItem('topology-viewport');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  // Fetch Router IP and Position from settings
  useEffect(() => {
    (async () => {
      try {
        const [ipRes, xRes, yRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/DefaultRouterIp`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/RouterPosX`),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/RouterPosY`)
        ]);

        if (ipRes.ok) {
          const data = await ipRes.json();
          if (data.value) setRouterIp(data.value);
        }

        let posX = window.innerWidth / 2 - 100;
        let posY = 100;

        if (xRes.ok) {
          const data = await xRes.json();
          if (data.value) posX = parseFloat(data.value);
        }
        if (yRes.ok) {
          const data = await yRes.json();
          if (data.value) posY = parseFloat(data.value);
        }

        setRouterPos({ x: posX, y: posY });
        setRouterLoaded(true);
      } catch (err) { 
        console.error("Failed to fetch router settings", err); 
        setRouterLoaded(true); 
      }
    })();
  }, []);

  // Persist viewport changes (pan + zoom) to localStorage
  const onMoveEnd = useCallback((_: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    localStorage.setItem('topology-viewport', JSON.stringify(viewport));
  }, []);

  const loadGraph = useCallback(async (overrideIp?: string) => {
    if (!routerLoaded) return;
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const activeRouterIp = overrideIp || routerIp;

    initialNodes.push({
      id: 'router',
      type: 'device',
      position: routerPos,
      data: { label: 'Main Router', ip: activeRouterIp, status: 'Online' }
    });

    try {
      const [devicesRes, agentsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices`).catch((e) => { console.error("Device fetch error", e); return null; }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`).catch((e) => { console.error("Agent fetch error", e); return null; })
      ]);

      let devices: any[] = [];
      let agents: any[] = [];

      if (devicesRes && devicesRes.ok) {
        try { devices = await devicesRes.json(); } catch(e) { console.error("Device JSON error", e); }
      }
      if (agentsRes && agentsRes.ok) {
        try { agents = await agentsRes.json(); } catch(e) { console.error("Agent JSON error", e); }
      }

      // ── Determine subnets ──────────────────────────────────────────────────
      const filteredDevices = Array.isArray(devices)
        ? devices.filter((d: any) => d.ipAddress !== activeRouterIp)
        : [];

      // Group by first 3 octets: "192.168.1"
      const subnetMap = new Map<string, any[]>();
      for (const d of filteredDevices) {
        const prefix = d.ipAddress.split('.').slice(0, 3).join('.');
        if (!subnetMap.has(prefix)) subnetMap.set(prefix, []);
        subnetMap.get(prefix)!.push(d);
      }

      const multiSubnet = subnetMap.size > 1;

      // Load saved subnet positions from localStorage
      let savedSubnetPositions: Record<string, { x: number; y: number }> = {};
      try {
        savedSubnetPositions = JSON.parse(localStorage.getItem('topology-subnet-positions') || '{}');
      } catch { /* ignore */ }

      // ── Layout constants ───────────────────────────────────────────────────
      const DEV_SPACING_X = 260;  // horizontal gap between device nodes
      const SUBNET_MARGIN  = 80;  // extra gap between adjacent subnet fans
      const SUBNET_NODE_W  = 210; // width of the subnet node card
      const DEV_ROW_SIZE   = 6;   // max devices per row before wrapping

      // ── Pre-compute each subnet's required width ───────────────────────────
      // Width = max(SUBNET_NODE_W, deviceCount * DEV_SPACING_X)
      const subnetPrefixes = [...subnetMap.keys()];
      const subnetWidths = new Map<string, number>();
      for (const prefix of subnetPrefixes) {
        const count = subnetMap.get(prefix)!.length;
        const rowLen = Math.min(count, DEV_ROW_SIZE);
        subnetWidths.set(prefix, Math.max(SUBNET_NODE_W, rowLen * DEV_SPACING_X));
      }

      // ── Assign auto X centres for subnets (cumulative, left→right) ─────────
      const totalWidth = [...subnetWidths.values()].reduce((s, w) => s + w + SUBNET_MARGIN, -SUBNET_MARGIN);
      const subnetDefaultCenters = new Map<string, number>();
      let cursor = routerPos.x - totalWidth / 2;
      for (const prefix of subnetPrefixes) {
        const w = subnetWidths.get(prefix)!;
        subnetDefaultCenters.set(prefix, cursor + w / 2);
        cursor += w + SUBNET_MARGIN;
      }

      // ── Create subnet nodes (only when >1 subnet) ─────────────────────────
      if (multiSubnet) {
        for (const prefix of subnetPrefixes) {
          const subnetId = `subnet-${prefix}`;
          const centerX = subnetDefaultCenters.get(prefix)!;
          const pos = savedSubnetPositions[subnetId] ?? { x: centerX - SUBNET_NODE_W / 2, y: 280 };
          initialNodes.push({
            id: subnetId,
            type: 'subnet',
            position: pos,
            data: {
              label: `${prefix}.0`,
              cidr: `${prefix}.0/24`,
              deviceCount: subnetMap.get(prefix)!.length,
            }
          });
          initialEdges.push({
            id: `e-router-${subnetId}`,
            source: 'router',
            target: subnetId,
            data: { shouldAnimate: true },
            style: { stroke: '#8b5cf6', strokeWidth: 2.5 }
          });
        }
      }

      // ── Add device nodes ──────────────────────────────────────────────────
      if (Array.isArray(devices)) {
        filteredDevices.forEach((d: any, index: number) => {
          const id = `dev-${d.id}`;
          const prefix = d.ipAddress.split('.').slice(0, 3).join('.');
          const subnetId = `subnet-${prefix}`;
          const subnetDevices = subnetMap.get(prefix) ?? [];
          const subnetIndex = subnetDevices.findIndex((sd: any) => sd.id === d.id);

          let defaultX: number;
          let defaultY: number;

          if (multiSubnet) {
            // Use saved subnet position if available; otherwise use computed centre
            const savedSubnetX = savedSubnetPositions[subnetId]?.x;
            const subnetCenterX = savedSubnetX != null
              ? savedSubnetX + SUBNET_NODE_W / 2
              : (subnetDefaultCenters.get(prefix) ?? 0);

            // Multi-row grid layout centred under the subnet node
            const row = Math.floor(subnetIndex / DEV_ROW_SIZE);
            const col = subnetIndex % DEV_ROW_SIZE;
            const rowCount = Math.min(DEV_ROW_SIZE, subnetDevices.length - row * DEV_ROW_SIZE);
            const rowOffsetX = (rowCount - 1) * DEV_SPACING_X / 2;

            defaultX = subnetCenterX - rowOffsetX + col * DEV_SPACING_X;
            defaultY = 510 + row * 220;
          } else {
            defaultX = 100 + (index * DEV_SPACING_X);
            defaultY = 350;
          }

          initialNodes.push({
            id,
            type: 'device',
            position: { x: d.positionX ?? defaultX, y: d.positionY ?? defaultY },
            data: { label: d.hostName || d.macAddress || 'Unknown Device', ip: d.ipAddress, status: d.status, rawDevice: d }
          });

          const edgeSource = multiSubnet ? subnetId : 'router';
          initialEdges.push({
            id: `e-${edgeSource}-${id}`,
            source: edgeSource,
            target: id,
            data: { shouldAnimate: d.status === 'Online' },
            style: { stroke: d.status === 'Online' ? '#10b981' : '#f43f5e', strokeWidth: 2, opacity: d.status === 'Online' ? 1 : 0.4 }
          });
        });
      }

      // ── Track real bottom edge of each subnet's device fan ────────────────
      // Used by the agent layout below so agents sit below the last device row,
      // even when devices have stale saved positions from a previous layout.
      const subnetMaxDeviceY = new Map<string, number>();
      if (multiSubnet) {
        for (const n of initialNodes) {
          if (!n.id.startsWith('dev-')) continue;
          const d = filteredDevices.find((fd: any) => `dev-${fd.id}` === n.id);
          if (!d) continue;
          const prefix = d.ipAddress.split('.').slice(0, 3).join('.');
          const nodeY = n.position.y;
          subnetMaxDeviceY.set(prefix, Math.max(subnetMaxDeviceY.get(prefix) ?? 0, nodeY));
        }
      }

      if (Array.isArray(agents)) {
        // ── Pass 1: fetch every agent's containers in parallel ────────────────
        const agentContainerData = await Promise.all(
          agents.map(async (a: any) => {
            const empty = { agent: a, containers: [], hostMetrics: null as any };
            try {
              let agentIp: string | null = null;
              try { const url = new URL(a.endpointUrl); agentIp = url.hostname; } catch { return empty; }

              // Always fetch stats — we need host metrics regardless of device match
              const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${a.id}/stats`).catch(() => null);
              if (!statsRes || !statsRes.ok) return empty;

              let statsData: any;
              try { statsData = await statsRes.json(); } catch { return empty; }

              const host = statsData?.host ?? statsData?.Host ?? null;
              const hostMetrics = host ? {
                memoryUsedMB:  host.memoryUsedMB  ?? host.MemoryUsedMB  ?? 0,
                memoryTotalMB: host.memoryTotalMB ?? host.MemoryTotalMB ?? 0,
                diskUsedGB:    host.diskUsedGB    ?? host.DiskUsedGB    ?? 0,
                diskTotalGB:   host.diskTotalGB   ?? host.DiskTotalGB   ?? 0
              } : null;
              // Containers are only shown when the agent IP matches a scanned device
              const matchingDevice = devices.find((d: any) => d.ipAddress === agentIp);
              const containers = matchingDevice && Array.isArray(statsData?.containers) ? statsData.containers : [];
              return { agent: a, containers, hostMetrics };
            } catch (err) {
              console.error(`Failed to fetch containers for agent ${a.id}`, err);
              return empty;
            }
          })
        );

        // ── Pass 2: resolve agent IPs + group by subnet ───────────────────────
        const CONTAINER_SPACING = 220;
        const FAN_MARGIN        = 100;
        const AGENT_NODE_W      = 240; // width of VM card
        const DEVICE_NODE_H     = 170; // approximate height of a DeviceNode card

        // For each agent, resolve its IP prefix once
        const agentWithPrefix = agentContainerData.map(entry => {
          let agentIp: string | null = null;
          try { const url = new URL(entry.agent.endpointUrl); agentIp = url.hostname; } catch { /* ignore */ }
          const prefix = agentIp ? agentIp.split('.').slice(0, 3).join('.') : null;
          return { ...entry, agentIp, prefix };
        });

        // ── Pass 3: compute default positions ─────────────────────────────────
        const agentDefaultPositions = new Map<number, { x: number; y: number }>();

        if (!multiSubnet) {
          // ── Single-subnet: original cumulative cursor logic ──────────────────
          let cursorX = 150;
          for (const { agent: a, containers } of agentContainerData) {
            if (a.positionX != null) continue;
            const rowSize = containers.length > 0 ? Math.min(containers.length, 4) : 1;
            const fanWidth = Math.max(rowSize * CONTAINER_SPACING, 350);
            agentDefaultPositions.set(a.id, { x: cursorX + fanWidth / 2 - 120, y: 600 });
            cursorX += fanWidth + FAN_MARGIN;
          }
        } else {
          // ── Multi-subnet: place agents below the REAL bottom of their subnet's
          //    device fan (uses actual node Y, not a formula).
          const agentIndexPerPrefix = new Map<string, number>();

          for (const { agent: a, prefix, containers } of agentWithPrefix) {
            // In multi-subnet mode: always recompute — saved positions are stale
            // (they were set in single-subnet layout at the wrong Y).
            if (!prefix) {
              agentDefaultPositions.set(a.id, { x: routerPos.x, y: 900 });
              continue;
            }

            const agentIdx = agentIndexPerPrefix.get(prefix) ?? 0;
            agentIndexPerPrefix.set(prefix, agentIdx + 1);

            // Derive Y from the actual bottom of the last device row in this subnet
            const maxDevY = subnetMaxDeviceY.get(prefix) ?? 510;
            const agentY  = maxDevY + DEVICE_NODE_H + 80;

            // X: fan agents horizontally, centred over the subnet column
            const subnetCenterX = subnetDefaultCenters.get(prefix) ?? routerPos.x;
            const fanWidth = Math.max(AGENT_NODE_W, Math.min(containers.length, 4) * CONTAINER_SPACING);
            // Count ALL agents in this subnet (not just unsaved) for correct centering
            const totalAgentsInSubnet = agentWithPrefix.filter(e => e.prefix === prefix).length;
            const totalFanWidth = totalAgentsInSubnet * (fanWidth + FAN_MARGIN) - FAN_MARGIN;
            const startX = subnetCenterX - totalFanWidth / 2;

            agentDefaultPositions.set(a.id, {
              x: startX + agentIdx * (fanWidth + FAN_MARGIN) + fanWidth / 2 - AGENT_NODE_W / 2,
              y: agentY,
            });
          }
        }

        // ── Pass 4: build agent + container nodes ─────────────────────────────
        // In multi-subnet mode, wipe any stale container positions from localStorage.
        // Those positions are absolute and become invalid when agents move to new Y.
        // Single-subnet mode keeps saved positions so user-dragged containers persist.
        if (multiSubnet) {
          localStorage.removeItem('topology-container-positions');
        }
        let savedContainerPositions: Record<string, { x: number; y: number }> = {};
        if (!multiSubnet) {
          try {
            savedContainerPositions = JSON.parse(localStorage.getItem('topology-container-positions') || '{}');
          } catch { /* ignore */ }
        }

        for (const { agent: a, containers, hostMetrics, prefix } of agentWithPrefix) {
          const agentNodeId = `agent-${a.id}`;
          // Single-subnet: respect saved position (user may have dragged it)
          // Multi-subnet:  always use fresh computed position — saved Y is stale
          const pos = (!multiSubnet && a.positionX != null)
            ? { x: a.positionX, y: a.positionY ?? 600 }
            : (agentDefaultPositions.get(a.id) ?? { x: routerPos.x, y: 800 });

          const agentEdgeSource = (multiSubnet && prefix && subnetMap.has(prefix))
            ? `subnet-${prefix}`
            : 'router';

          initialNodes.push({
            id: agentNodeId,
            type: 'vm',
            position: pos,
            data: {
              label: a.name,
              rawAgent: a,
              memUsed:   hostMetrics?.memoryUsedMB  ?? null,
              memTotal:  hostMetrics?.memoryTotalMB ?? null,
              diskUsed:  hostMetrics?.diskUsedGB    ?? null,
              diskTotal: hostMetrics?.diskTotalGB   ?? null,
            }
          });
          initialEdges.push({
            id: `e-${agentEdgeSource}-${agentNodeId}`,
            source: agentEdgeSource,
            target: agentNodeId,
            data: { shouldAnimate: true },
            style: { stroke: '#6366f1', strokeWidth: 2 }
          });

          const containerCount = containers.length;
          if (containerCount === 0) continue;

          const rowSize = Math.min(containerCount, 4);

          containers.forEach((c: any, cIdx: number) => {
            const row = Math.floor(cIdx / rowSize);
            const col = cIdx % rowSize;
            const rowItemCount = Math.min(rowSize, containerCount - row * rowSize);
            const rowOffset = (rowItemCount - 1) * CONTAINER_SPACING / 2;

            const containerId = `container-${a.id}-${cIdx}`;
            const containerName = (c.name || c.id || 'container').replace(/^\//, '');

            const savedPos = savedContainerPositions[containerId];
            const defaultPos = {
              x: pos.x + 120 + (col * CONTAINER_SPACING) - rowOffset,
              y: pos.y + 320 + (row * 200)
            };

            initialNodes.push({
              id: containerId,
              type: 'container',
              position: savedPos ?? defaultPos,
              data: {
                label: containerName,
                image: c.image || 'unknown',
                state: c.state || 'unknown',
                statusText: c.status || c.state || 'unknown'
              }
            });

            initialEdges.push({
              id: `e-${agentNodeId}-${containerId}`,
              source: agentNodeId,
              target: containerId,
              data: { shouldAnimate: c.state === 'running' },
              style: {
                stroke: c.state === 'running' ? '#06b6d4' : '#525252',
                strokeWidth: 1.5,
                strokeDasharray: c.state === 'running' ? undefined : '5,5',
                opacity: c.state === 'running' ? 0.8 : 0.4
              }
            });
          });
        }
      }
    } catch (err) {
      console.error("Failed to load topology", err);
    } finally {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [setNodes, setEdges, routerIp, routerLoaded, routerPos]);

  // Trigger once routerLoaded flips to true (fixes multi-subnet blank topology)
  useEffect(() => {
    if (routerLoaded) loadGraph();
  }, [routerLoaded]); // eslint-disable-line react-hooks/exhaustive-deps


  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Handle Drag Position Saving
  const onNodeDragStop = useCallback(async (event: any, node: Node) => {
    try {
      if (node.id === 'router') {
        await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/RouterPosX`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: node.position.x.toString() })
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/RouterPosY`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: node.position.y.toString() })
          })
        ]);
        setRouterPos({ x: node.position.x, y: node.position.y });
      } else if (node.id.startsWith('subnet-')) {
        const saved = JSON.parse(localStorage.getItem('topology-subnet-positions') || '{}');
        saved[node.id] = { x: node.position.x, y: node.position.y };
        localStorage.setItem('topology-subnet-positions', JSON.stringify(saved));
      } else if (node.id.startsWith('dev-')) {
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
      } else if (node.id.startsWith('container-')) {
        const saved = JSON.parse(localStorage.getItem('topology-container-positions') || '{}');
        saved[node.id] = { x: node.position.x, y: node.position.y };
        localStorage.setItem('topology-container-positions', JSON.stringify(saved));
      }
    } catch(err) { console.error("Failed to save coordinates: ", err); }
  }, []);


  // Handle PNG Export
  const downloadGraph = () => {
    const nodesBounds = getNodesBounds(getNodes()); // Pass explicitly retrieved nodes from XYFlow Context!
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
    // Prevent modal from opening for read-only nodes
    if (node.id.startsWith('container-') || node.id.startsWith('subnet-')) return;
    
    setEditingNode(node);
    const nodeData = node.data as any;
    if (node.id === 'router') {
      setEditName(nodeData.label || 'Main Router');
      setEditIp(nodeData.ip || '');
    } else {
      setEditName(nodeData.label || 'Unknown Device');
      setEditIp(""); // Not editable for standard devices here
    }
  }, []);

  const saveEdit = async () => {
    if (!editingNode) return;
    try {
       if (editingNode.id === 'router') {
          // Save Router IP and Name to settings
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/DefaultRouterIp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: editIp })
          });
          setRouterIp(editIp);
          loadGraph(editIp); // Force immediate reload with new IP
       } else if (editingNode.id.startsWith('dev-')) {
         const devId = editingNode.id.replace('dev-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scanner/devices/${devId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ hostName: editName })
         });
         loadGraph();
       } else if (editingNode.id.startsWith('agent-')) {
         const agentId = editingNode.id.replace('agent-', '');
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ name: editName })
         });
         loadGraph();
       }
       setEditingNode(null);
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }} className="relative">
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
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          colorMode="dark"
          defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: 0.75 }}
          fitView={savedViewport === null}
          minZoom={0.1}
          maxZoom={4}
          onlyRenderVisibleElements={true}
          className="bg-neutral-950 flex-1 w-full relative z-0"
        >
          <Controls className="bg-black/80 border-white/10" style={{ zIndex: 10 }} />
          <MiniMap className="bg-black/50 border-white/5 rounded-xl overflow-hidden" maskColor="rgba(0,0,0,0.8)" nodeColor="#6366f1" style={{ zIndex: 10 }}/>
          <Background variant={BackgroundVariant.Dots} gap={32} size={2} color="#ffffff20" />
          
          <Panel position="top-right" className="!m-6 flex flex-col gap-3 items-end">
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
              className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 transition-colors w-full mb-4"
              disabled={editingNode.id === 'router'} // Router name is currently fixed for simplicity, but IP is editable
            />

            {editingNode.id === 'router' && (
              <>
                <label className="text-sm font-semibold text-neutral-300 mb-2">Router IP Address</label>
                <input 
                  type="text" 
                  value={editIp} 
                  onChange={(e) => setEditIp(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 transition-colors w-full mb-6"
                  placeholder="192.168.1.1"
                />
              </>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-white/5">
              <button 
                 onClick={deleteNode} 
                 className={`flex items-center gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-lg font-semibold transition-colors ${(editingNode.id === 'router' || (editingNode.data as any).status === 'Online') ? 'opacity-50 cursor-not-allowed' : ''}`}
                 disabled={editingNode.id === 'router' || (editingNode.data as any).status === 'Online'} // Only offline devices should be deleted safely
                 title={editingNode.id === 'router' ? "Cannot delete the main router." : (editingNode.data as any).status === 'Online' ? "Cannot delete Online entities. They must be offline first." : ""}
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

export default function NetworkTopologyGraph() {
  return (
    <ReactFlowProvider>
      <InnerGraph />
    </ReactFlowProvider>
  );
}

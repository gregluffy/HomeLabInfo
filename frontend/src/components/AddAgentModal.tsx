"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Terminal, Copy, Check, Edit2 } from "lucide-react";

export default function AddAgentModal({ 
  isOpen, 
  onClose, 
  onAdded,
  agentToEdit
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onAdded: () => void,
  agentToEdit?: any 
}) {
  const [name, setName] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("http://192.168.1.50:8080");
  const [isLoading, setIsLoading] = useState(false);
  const [agentData, setAgentData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const copyText = (text: string, setCopiedState: (v: boolean) => void) => {
    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(text);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2000);
    });
  };

  useEffect(() => {
    if (isOpen) {
      if (agentToEdit) {
        setName(agentToEdit.name || "");
        setEndpointUrl(agentToEdit.endpointUrl || "");
        // Fetch full agent data including the public key so they can see it again
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentToEdit.id}`)
          .then(res => res.json())
          .then(data => setAgentData(data))
          .catch(console.error);
      } else {
        setName("");
        setEndpointUrl("http://192.168.1.50:8080");
        setAgentData(null);
      }
    }
  }, [isOpen, agentToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let res;
      if (agentToEdit) {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents/${agentToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, endpointUrl }),
        });
        if (!res.ok) throw new Error("Failed to update agent");
        onAdded();
        onClose(); // Close immediately on edit since key is already known
      } else {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, endpointUrl }),
        });
        if (!res.ok) throw new Error("Failed to register agent");
        const data = await res.json();
        setAgentData(data);
        onAdded();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save agent. Ensure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setAgentData(null);
    onClose();
  }

  const codeSnippet = `version: '3.8'

services:
  homelab-agent:
    # Build your local agent image first or push it to a registry
    # image: ghcr.io/yourusername/homelab-agent:latest 
    build:
      context: ./agent
      dockerfile: Dockerfile
    container_name: homelab-agent
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/host:ro
      - /proc:/host/proc:ro
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - HUB_PUBLIC_KEY=${agentData?.publicKeyBase64}
`;

  const copyToClipboard = () => {
    copyText(codeSnippet, setCopied);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {agentToEdit ? <Edit2 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />} 
            {agentToEdit && agentData?.publicKeyBase64 ? "Edit Agent" : agentData ? "Agent Registered" : "Register New Agent"}
          </h2>
          <button onClick={handleClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto min-h-[300px]">
          {(!agentData || agentToEdit) ? (
             <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Agent / System Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="e.g. Proxmox-Docker-Host" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Agent Endpoint URL</label>
                  <input required value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} type="url" placeholder="http://192.168.1.50:8080" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors" />
                  <p className="text-xs text-neutral-500 mt-2">This is the IP and Port where the Hub will contact the Agent.</p>
                </div>
                
                {agentToEdit && agentData?.publicKeyBase64 && (
                  <div className="pt-4 border-t border-white/5">
                    <h3 className="text-white text-sm font-semibold mb-2">Agent Public Key</h3>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-neutral-300 font-mono text-[10px] break-all selection:bg-indigo-500/50 flex items-center">
                        {agentData.publicKeyBase64}
                      </div>
                      <button type="button" onClick={() => copyText(agentData.publicKeyBase64, setCopiedRaw)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white shrink-0">
                          {copiedRaw ? <Check className="w-4 h-4 text-emerald-400"/> : <Copy className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 flex justify-end">
                  <button disabled={isLoading} type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isLoading ? "Saving..." : agentToEdit ? "Save Changes" : "Register Agent"}
                  </button>
                </div>
             </form>
          ) : (
            <div className="space-y-4">
               <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg flex items-start gap-3">
                 <Check className="w-6 h-6 flex-shrink-0 mt-0.5" />
                 <div>
                    <p className="text-sm font-bold">Agent successfully registered!</p>
                    <p className="text-xs mt-1 text-emerald-400/80">A unique RSA public key has been generated precisely for this agent instance.</p>
                 </div>
               </div>
               
               <div className="mb-6 mt-6">
                 <h3 className="text-white font-semibold mb-2 flex items-center gap-2">Agent Public Key</h3>
                 <p className="text-sm text-neutral-400 mb-2">Copy this key directly to your agent's appsettings.json or HUB_PUBLIC_KEY environment variable.</p>
                 <div className="flex gap-2">
                   <div className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-neutral-300 font-mono text-xs break-all selection:bg-indigo-500/50">
                     {agentData.publicKeyBase64}
                   </div>
                   <button type="button" onClick={() => copyText(agentData.publicKeyBase64, setCopiedRaw)} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-white shrink-0">
                      {copiedRaw ? <Check className="w-5 h-5 text-emerald-400"/> : <Copy className="w-5 h-5"/>}
                   </button>
                 </div>
               </div>
               
               <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><Terminal className="w-4 h-4"/> docker-compose.yml</h3>
               <p className="text-sm text-neutral-400 mb-2">Or run this docker configuration on your target machine to bootstrap it.</p>
               
               <div className="relative group">
                 <div className="absolute top-3 right-3">
                    <button onClick={copyToClipboard} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white backdrop-blur-md">
                      {copied ? <Check className="w-4 h-4 text-emerald-400"/> : <Copy className="w-4 h-4"/>}
                    </button>
                 </div>
                 <pre className="bg-black/60 border border-white/10 p-4 rounded-xl text-neutral-300 font-mono text-xs overflow-x-auto">
                   <code>{codeSnippet}</code>
                 </pre>
               </div>
               
               <div className="pt-4 flex justify-end">
                  <button onClick={handleClose} className="bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                    Done
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

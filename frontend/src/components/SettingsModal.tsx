"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Bell, Webhook, Save, Send, ShieldCheck, AlertCircle, ChevronDown, Eye, EyeOff } from "lucide-react";

export default function SettingsModal({ 
  isOpen, 
  onClose,
}: { 
  isOpen: boolean, 
  onClose: () => void, 
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [provider, setProvider] = useState("discord");
  const [enableDhcp, setEnableDhcp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const keys = ["WebhookUrl", "WebhookProvider", "EnableDhcpListening"];
      const results = await Promise.all(keys.map(async (k) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/${k}`);
            if (res.ok) return await res.json();
            return { value: "" };
        } catch {
            return { value: "" };
        }
      }));
      
      setWebhookUrl(results[0]?.value || "");
      setProvider(results[1]?.value || "discord");
      setEnableDhcp(results[2]?.value === "true");
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: "WebhookUrl", value: webhookUrl },
        { key: "WebhookProvider", value: provider },
        { key: "EnableDhcpListening", value: enableDhcp.toString() }
      ];

      await Promise.all(updates.map(u => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/${u.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Value: u.value })
        })
      ));
      
      onClose();
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("Error saving settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!webhookUrl) return;
    setTestStatus("loading");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, provider: provider })
      });
      if (res.ok) {
          setTestStatus("success");
          setTimeout(() => setTestStatus("idle"), 3000);
      } else {
          setTestStatus("error");
          setTimeout(() => setTestStatus("idle"), 3000);
      }
    } catch {
      setTestStatus("error");
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-500/20 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-indigo-400" />
             </div>
             <h2 className="text-xl font-bold text-white">Application Settings</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Webhook Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
              <Webhook className="w-4 h-4" /> Webhook Notifications
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="relative">
                  <label className="block text-xs text-neutral-500 mb-1.5 ml-1">Service Provider</label>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`w-full bg-black/50 border ${isDropdownOpen ? 'border-indigo-500' : 'border-white/10'} hover:border-white/20 rounded-lg px-4 py-2.5 text-sm text-white transition-colors flex items-center justify-between shadow-inner`}
                  >
                    <span className="flex items-center gap-2">
                       {provider === "discord" && <span className="w-2 h-2 rounded-full bg-[#5865F2] shadow-[0_0_8px_#5865F2]"></span>}
                       {provider === "teams" && <span className="w-2 h-2 rounded-full bg-[#5059C9] shadow-[0_0_8px_#5059C9]"></span>}
                       {provider === "generic" && <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]"></span>}
                       {provider === "discord" ? "Discord" : provider === "teams" ? "Microsoft Teams" : "Generic Webhook"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-neutral-900 border border-white/10 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top">
                        <button
                          type="button"
                          onClick={() => { setProvider("discord"); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${provider === 'discord' ? 'bg-indigo-500/10 font-bold text-white' : 'text-neutral-300'}`}
                        >
                           <span className="w-2 h-2 rounded-full bg-[#5865F2] ml-1"></span> Discord
                        </button>
                        <button
                          type="button"
                          onClick={() => { setProvider("teams"); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${provider === 'teams' ? 'bg-indigo-500/10 font-bold text-white' : 'text-neutral-300'}`}
                        >
                           <span className="w-2 h-2 rounded-full bg-[#5059C9] ml-1"></span> Microsoft Teams
                        </button>
                        <button
                          type="button"
                          onClick={() => { setProvider("generic"); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 hover:bg-white/5 transition-colors ${provider === 'generic' ? 'bg-indigo-500/10 font-bold text-white' : 'text-neutral-300'}`}
                        >
                           <span className="w-2 h-2 rounded-full bg-white ml-1"></span> Generic Webhook
                        </button>
                      </div>
                    </>
                  )}
               </div>
               <div className="flex items-end">
                  <button 
                    onClick={handleTestNotification}
                    disabled={testStatus === "loading" || !webhookUrl}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {testStatus === "loading" ? "Sending..." : testStatus === "success" ? "Sent!" : testStatus === "error" ? "Failed" : "Send Test"}
                    {testStatus === "idle" && <Send className="w-4 h-4" />}
                  </button>
               </div>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 ml-1">Webhook URL</label>
              <div className="relative">
                <input 
                  value={webhookUrl} 
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  type={showWebhook ? "text" : "password"} 
                  placeholder="https://discord.com/api/webhooks/..." 
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-neutral-600 font-mono" 
                />
                <button
                  type="button"
                  onClick={() => setShowWebhook(!showWebhook)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* DHCP Section */}
          <div className="flex items-center justify-between gap-4 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Instant DHCP Discovery</h3>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  App will listen for DHCP broadcasts to detect new devices instantly as they join the network.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableDhcp} 
                onChange={(e) => setEnableDhcp(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex justify-end">
           <button 
             onClick={handleSave}
             disabled={isSaving || isLoading}
             className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-900/40 transition-all flex items-center gap-2 disabled:opacity-50"
           >
             <Save className="w-4 h-4" />
             {isSaving ? "Saving..." : "Save Configuration"}
           </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useState } from "react";
import { Radio, Send, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { createAnnouncement } from "@/app/actions/announcements";

export default function AdminAnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [targetAudience, setTargetAudience] = useState<"all" | "teams" | "judges" | "ops">("all");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      await createAnnouncement({
        title,
        message,
        priority,
        target_audience: targetAudience,
      });
      setStatusMsg("Announcement broadcasted live to all portals!");
      setTitle("");
      setMessage("");
      setTimeout(() => {
        setIsOpen(false);
        setStatusMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-secondary hover:bg-accent-secondary/80 text-white font-tech font-bold uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shadow-accent-secondary/20"
      >
        <Radio size={14} className="animate-pulse" />
        <span>Broadcast Alert</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-tech animate-fade-in">
          <div className="glass-panel max-w-lg w-full p-6 border border-accent-secondary/50 space-y-5 bg-[#0a0a12]">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <Radio className="text-accent-secondary animate-pulse" size={18} />
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Broadcast Event Announcement
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-text-primary text-xs font-mono font-bold uppercase"
              >
                ✕ Close
              </button>
            </div>

            {statusMsg && (
              <div className="p-3 bg-status-success/15 border border-status-success text-status-success text-xs font-mono">
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase text-text-secondary font-bold mb-1">
                  Alert Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Round 1 Pitching Begins in 15 Minutes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-color border border-border-color p-2.5 text-text-primary text-xs focus:border-accent-secondary outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase text-text-secondary font-bold mb-1">
                  Message Body *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter details for participants, judges, or ops desks..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-surface-color border border-border-color p-2.5 text-text-primary text-xs focus:border-accent-secondary outline-none font-sans resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase text-text-secondary font-bold mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full bg-surface-color border border-border-color p-2.5 text-text-primary text-xs focus:border-accent-secondary outline-none"
                  >
                    <option value="normal">Normal (Info)</option>
                    <option value="important">Important (Warning)</option>
                    <option value="urgent">Urgent (Critical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase text-text-secondary font-bold mb-1">
                    Target Audience
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e: any) => setTargetAudience(e.target.value)}
                    className="w-full bg-surface-color border border-border-color p-2.5 text-text-primary text-xs focus:border-accent-secondary outline-none"
                  >
                    <option value="all">All Portals (Global)</option>
                    <option value="teams">Teams Only</option>
                    <option value="judges">Judges Only</option>
                    <option value="ops">Operations Desks Only</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-border-color flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-surface-color border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-accent-secondary hover:bg-accent-secondary/80 text-white text-xs uppercase font-bold flex items-center gap-2"
                >
                  <Send size={13} />
                  <span>{loading ? "Broadcasting..." : "Publish Broadcast"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Radio, Send, X } from "lucide-react";
import { createAnnouncement } from "@/app/actions/announcements";

export default function AdminAnnouncementModal() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [targetAudience, setTargetAudience] = useState<"all" | "teams" | "judges" | "ops">("all");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-accent-secondary hover:bg-accent-secondary/80 text-white font-tech font-bold uppercase text-xs flex items-center gap-2 transition-colors shadow-lg shadow-accent-secondary/20 cursor-pointer"
      >
        <Radio size={14} className="animate-pulse" />
        <span>Broadcast Alert</span>
      </button>

      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-start justify-center p-4 pt-10 sm:pt-14 md:pt-16 font-tech animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-announcement-title"
          aria-describedby="admin-announcement-desc"
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="glass-panel max-w-lg w-full max-h-[calc(100vh-4rem)] overflow-y-auto p-5 sm:p-6 border border-accent-secondary/50 space-y-4 sm:space-y-5 bg-[#0a0a12] shadow-2xl relative my-0">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <Radio className="text-accent-secondary animate-pulse" size={18} />
                <h3 id="admin-announcement-title" className="font-heading text-lg text-text-primary uppercase m-0">
                  Broadcast Event Announcement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-text-primary text-xs font-mono font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X size={15} />
                <span>Close</span>
              </button>
            </div>

            {statusMsg && (
              <div id="admin-announcement-desc" className="p-3 bg-status-success/15 border border-status-success text-status-success text-xs font-mono">
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
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as "normal" | "important" | "urgent")}
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
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetAudience(e.target.value as "all" | "teams" | "judges" | "ops")}
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
                  className="px-4 py-2 bg-surface-color border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-accent-secondary hover:bg-accent-secondary/80 text-white text-xs uppercase font-bold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{loading ? "Broadcasting..." : "Publish Broadcast"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}


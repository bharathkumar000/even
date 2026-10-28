"use client";

import { useEffect, useState } from "react";
import { Bell, X, ExternalLink, Paperclip, Calendar, AlertTriangle, Info, AlertCircle, FileText, Star } from "lucide-react";
import { format } from "date-fns";

export type AnnouncementCategory = "general" | "important" | "deadline" | "schedule" | "emergency";
export type AnnouncementPriority = "normal" | "high" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority_level: "normal" | "high" | "urgent";
  target_audience: string;
  status: string;
  is_active: boolean;
  pin_to_top: boolean;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  resource_links: Record<string, string>[];
  created_at: string;
}

interface AnnouncementsPanelProps {
  /** Portal audience identifier */
  audience: "all" | "teams" | "judges" | "ops" | "admin" | "participants" | "staff" | "organizers";
  /** Maximum number of announcements to show */
  maxItems?: number;
  /** Whether to show as a compact bell dropdown */
  compact?: boolean;
  /** Custom title for the panel */
  title?: string;
  /** Callback when announcement is clicked */
  onAnnouncementClick?: (announcement: any) => void;
  /** Custom className for the container */
  className?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  general: { icon: FileText, color: "text-gray-400", bgColor: "bg-gray-500/20", label: "General" },
  important: { icon: Info, color: "text-blue-400", bgColor: "bg-blue-500/20", label: "Important" },
  deadline: { icon: AlertTriangle, color: "text-orange-400", bgColor: "bg-orange-500/20", label: "Deadline" },
  schedule: { icon: Calendar, color: "text-purple-400", bgColor: "bg-purple-500/20", label: "Schedule" },
  emergency: { icon: AlertCircle, color: "text-red-400", bgColor: "bg-red-500/20", label: "Emergency" },
};

export function AnnouncementsPanel({
  audience,
  maxItems = 5,
  compact = false,
  title = "Announcements",
  onAnnouncementClick,
  className = "",
}: AnnouncementsPanelProps) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  const fetchAnnouncements = async () => {
    try {
      // Try RPC first
      const res = await fetch(`/api/announcements?audience=${audience}&limit=${maxItems}`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      } else {
        // Fallback: use server action via API route
        const fallbackRes = await fetch(`/api/announcements-fallback?audience=${audience}&limit=${maxItems}`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setAnnouncements(data.announcements || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, [audience, maxItems]);

  const unreadCount = announcements.filter((a) => !a.read_at).length;

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="Announcements"
          aria-expanded={isOpen}
        >
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="hidden sm:block text-sm text-gray-300 font-medium">{title}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="fixed top-14 right-4 z-50 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl animate-slide-down">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-pink-500" />
                  {title}
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-pink-600 text-white rounded-full">{unreadCount} new</span>
                  )}
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {renderAnnouncementsList()}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full panel mode
  return (
    <div className={`bg-gray-900/50 border border-gray-700 rounded-xl ${className}`}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-pink-500" />
          {title}
        </h3>
      </div>
      <div className="p-4">
        {renderAnnouncementsList()}
      </div>
    </div>
  );

  function renderAnnouncementsList() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-6 h-6 text-pink-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-2 text-gray-400 text-sm">Loading announcements...</span>
        </div>
      );
    }

    if (announcements.length === 0) {
      return (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.599 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-gray-400 text-sm">No announcements at this time</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            onClick={onAnnouncementClick}
          />
        ))}
      </div>
    );
  }
}

function AnnouncementCard({ announcement, onClick }: { announcement: any; onClick?: (announcement: any) => void }) {
  const categoryConfig = CATEGORY_CONFIG[announcement.category] || CATEGORY_CONFIG.general;
  const CategoryIcon = categoryConfig.icon;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return "—";
    }
  };

  const handleClick = () => {
    if (onClick) onClick(announcement);
    // Mark as read could be implemented here
  };

  return (
    <div
      onClick={handleClick}
      className="group relative p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-pink-500/30 hover:bg-gray-800 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${categoryConfig.bgColor} flex-shrink-0`}>
          <CategoryIcon className={`w-5 h-5 ${categoryConfig.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-white truncate">{announcement.title}</h4>
              {announcement.pin_to_top && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">
                  PINNED
                </span>
              )}
              <span className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_CONFIG[announcement.category]?.bgColor || "bg-gray-500/20"} ${categoryConfig.color} border border-gray-700`}>
                {categoryConfig.label}
              </span>
              {announcement.priority_level !== "normal" && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  announcement.priority_level === "urgent" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  announcement.priority_level === "high" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                  "bg-gray-500/20 text-gray-400 border-gray-700"
                }`}>
                  {announcement.priority_level.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <p className="mt-2 text-gray-300 text-sm line-clamp-2">{announcement.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {announcement.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Published {format(new Date(announcement.published_at), "MMM d, yyyy h:mm a")}
              </span>
            )}
            {announcement.expires_at && (
              <span className="flex items-center gap-1 text-orange-400">
                <AlertTriangle className="w-3 h-3" />
                Expires {format(new Date(announcement.expires_at), "MMM d, h:mm a")}
              </span>
            )}
          </div>

          {announcement.attachment_url && (
            <a
              href={announcement.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-pink-400 hover:bg-gray-700 transition-colors"
            >
              <Paperclip className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{announcement.attachment_name || "Attachment"}</span>
            </a>
          )}

          {announcement.resource_links && announcement.resource_links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {announcement.resource_links.slice(0, 2).map((link: any, index: number) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-pink-400 hover:bg-gray-700 truncate max-w-[150px]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="truncate max-w-[120px]">{link.label || link.url}</span>
                </a>
              ))}
              {announcement.resource_links.length > 2 && (
                <span className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-500">
                  +{announcement.resource_links.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  }

export default AnnouncementsPanel;
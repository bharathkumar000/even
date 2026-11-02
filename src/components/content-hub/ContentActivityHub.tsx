"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  X,
  Calendar,
  Bell,
  Clock,
  Edit,
  Eye,
  Send,
  RotateCcw,
  Archive,
  Trash2,
  Copy,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Star,
  Paperclip,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Menu,
  Shield,
  Users,
  Gavel,
  Briefcase,

  Sparkles,
  Tag,
  Flag,
  Bookmark,
  Download,
  Upload,
  Image as ImageIcon,
  Video,
  Music,
  Code,
  FileCode,
  FileSpreadsheet,
  FileJson,
  File as FilePdfIcon,
  FileImage,
  FileVideo,
  FileAudio,
  Lock,
  Unlock,

  Shield as ShieldIcon,
  Users as UsersIcon,
  Gavel as GavelIcon,

  Award,
  Layers,
  Globe,
  Users as UsersIcon2,
  Briefcase as BriefcaseIcon,
  Crown,
  Edit2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export type ContentType =
  | "problem_statement"
  | "certificate_release"
  | "announcement"
  | "resource"
  | "custom";

export type ContentStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";

export type PortalAudience =
  | "all"
  | "team_leader"
  | "participant"
  | "staff"
  | "judge"
  | "operations"
  | "organizer"
  | "admin";

export type PriorityLevel = "normal" | "high" | "urgent";

export interface ContentHubItem {
  id: string;
  reference_number: string | null;
  title: string;
  summary: string | null;
  body: string;
  content_type: string;
  category: string | null;
  status: string;
  priority_level: string;
  pin_to_top: boolean;
  target_audiences: string[];
  target_audience: string;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  domain: string | null;
  team_limit: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening: string | null;
  selection_closing: string | null;
  recipient: string | null;
  team_name: string | null;
  resource_url: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  resource_links: Record<string, unknown>[];
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ContentHubAttachment {
  id: string;
  content_id: string;
  name: string;
  path: string;
  mime_type: string | null;
  size: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ContentHubFilters {
  search?: string;
  content_type?: string;
  category?: string;
  status?: string;
  priority?: string;
  audience?: string;
}

export interface ContentActivityHubProps {
  initialItems?: ContentHubItem[];
  portalAudience?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showCreateButton?: boolean;
  onCreate?: () => void;
  onEdit?: (item: ContentHubItem) => void;
  onDelete?: (id: string) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onArchive?: (id: string) => void;
  onView?: (item: ContentHubItem) => void;
  className?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  errorMessage?: string;
  itemsPerPage?: number;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  problem_statement: "Problem Statement",
  certificate_release: "Certificate Release",
  announcement: "Announcement",
  resource: "Resource",
  custom: "Custom Activity",
};

const CONTENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  problem_statement: FileText,
  certificate_release: Award,
  announcement: Bell,
  resource: Bookmark,
  custom: Layers,
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  problem_statement: "text-accent-secondary",
  certificate_release: "text-accent-primary",
  announcement: "text-status-warning",
  resource: "text-accent-tertiary",
  custom: "text-text-secondary",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-surface-color-light text-text-secondary border-border-color",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  unpublished: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  archived: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/10 text-red-400 border-red-500/30",
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Portals",
  team_leader: "Team Leaders",
  participant: "Participants",
  staff: "Staff / SPOC",
  judge: "Judges",
  operations: "Operations",
  organizer: "Organizers",
  admin: "Admin Portal",
};

const AUDIENCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  all: Globe,
  team_leader: UsersIcon,
  participant: UsersIcon2,
  staff: ShieldIcon,
  judge: GavelIcon,
  operations: BriefcaseIcon,
  organizer: Crown,
  admin: Shield,
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  important: "Important",
  deadline: "Deadline",
  schedule: "Schedule",
  emergency: "Emergency",
  guideline: "Guideline",
  template: "Template",
  reference: "Reference",
  guide: "Guide",
  tool: "Tool",
};

function getContentTypeIcon(type: string) {
  const Icon = CONTENT_TYPE_ICONS[type] || Layers;
  const color = CONTENT_TYPE_COLORS[type] || "text-text-secondary";
  return <Icon className={`w-4 h-4 ${color}`} />;
}

function getAudienceIcon(audience: string) {
  const Icon = AUDIENCE_ICONS[audience] || Globe;
  return <Icon className="w-3 h-3" />;
}

function getAudienceLabel(audience: string) {
  return AUDIENCE_LABELS[audience] || audience;
}

function getContentTypeLabel(type: string) {
  return CONTENT_TYPE_LABELS[type] || type;
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

function getPriorityLabel(priority: string) {
  return PRIORITY_LABELS[priority] || priority;
}

function getStatusColors(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}

function getPriorityColors(priority: string) {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return "—";
  }
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

function getFileIcon(mimeType: string | null, fileName: string) {
  if (!mimeType) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return <FilePdfIcon className="w-5 h-5 text-red-500" />;
      case "doc":
      case "docx": return <FileText className="w-5 h-5 text-blue-500" />;
      case "xls":
      case "xlsx": return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case "ppt":
      case "pptx": return <FileText className="w-5 h-5 text-orange-500" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp": return <FileImage className="w-5 h-5 text-purple-500" />;
      case "mp4":
      case "mov":
      case "avi": return <FileVideo className="w-5 h-5 text-pink-500" />;
      case "mp3":
      case "wav": return <FileAudio className="w-5 h-5 text-cyan-500" />;
      case "zip":
      case "rar": return <FileText className="w-5 h-5 text-yellow-500" />;
      case "json": return <FileJson className="w-5 h-5 text-yellow-500" />;
      case "csv": return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case "md":
      case "txt": return <FileText className="w-5 h-5 text-gray-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  }

  if (mimeType.startsWith("image/")) return <FileImage className="w-5 h-5 text-purple-500" />;
  if (mimeType.startsWith("video/")) return <FileVideo className="w-5 h-5 text-pink-500" />;
  if (mimeType.startsWith("audio/")) return <FileAudio className="w-5 h-5 text-cyan-500" />;
  if (mimeType === "application/pdf") return <FilePdfIcon className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className="w-5 h-5 text-orange-500" />;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed")) return <FileText className="w-5 h-5 text-yellow-500" />;
  if (mimeType === "application/json") return <FileJson className="w-5 h-5 text-yellow-500" />;
  if (mimeType === "text/csv") return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType.startsWith("text/")) return <FileText className="w-5 h-5 text-gray-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContentActivityHub({
  initialItems = [],
  portalAudience = "all",
  showFilters = true,
  showSearch = true,
  showCreateButton = false,
  onCreate,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onArchive,
  onView,
  className = "",
  emptyMessage,
  loadingMessage = "Loading content...",
  errorMessage = "Failed to load content.",
  itemsPerPage = 20,
}: ContentActivityHubProps) {
  const [items, setItems] = useState<ContentHubItem[]>(initialItems || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filters
  const [filters, setFilters] = useState<ContentHubFilters>({
    search: "",
    content_type: "",
    category: "",
    status: "",
    priority: "",
    audience: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPageState] = useState(itemsPerPage);

  // Modals
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentHubItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ContentHubItem | null>(null);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesBody = item.body?.toLowerCase().includes(query) ?? false;
        const matchesSummary = item.summary?.toLowerCase().includes(query) ?? false;
        const matchesRef = item.reference_number?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesBody && !matchesSummary && !matchesRef) return false;
      }
      if (filters.content_type && item.content_type !== filters.content_type) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority_level !== filters.priority) return false;
      if (filters.audience) {
        const aud = filters.audience;
        if (!item.target_audiences.includes(aud) && item.target_audience !== aud) return false;
      }
      return true;
    });
  }, [items, filters]);

  // Total pages
  const totalPages = useMemo(() => Math.ceil(filteredItems.length / itemsPerPageState), [filteredItems.length, itemsPerPageState]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPageState;
    return filteredItems.slice(start, start + itemsPerPageState);
  }, [filteredItems, currentPage]);

  const handleFilterChange = (key: keyof ContentHubFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleView = (item: ContentHubItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
    onView?.(item);
  };

  const handleEdit = (item: ContentHubItem) => {
    onEdit?.(item);
  };

  const handleDeleteConfirm = (item: ContentHubItem) => {
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await onDelete?.(itemToDelete.id);
      setNotification({ type: "success", message: "Content deleted successfully." });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to delete content." });
    } finally {
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await onPublish?.(id);
      setNotification({ type: "success", message: "Content published successfully." });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to publish." });
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await onUnpublish?.(id);
      setNotification({ type: "success", message: "Content unpublished successfully." });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to unpublish." });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await onArchive?.(id);
      setNotification({ type: "success", message: "Content archived successfully." });
    } catch (err) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to archive." });
    }
  };

  const handleRefresh = () => {
    // Trigger a refresh - in a real app this would refetch from server
    setNotification({ type: "success", message: "Content refreshed." });
  };

  const handleCopyLink = (item: ContentHubItem) => {
    const url = `${window.location.origin}/content/${item.id}`;
    navigator.clipboard.writeText(url);
    setNotification({ type: "success", message: "Link copied to clipboard." });
  };

  const downloadAttachment = (attachment: any) => {
    const link = document.createElement("a");
    link.href = attachment.path;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getContentTypeIconComponent = (type: string) => {
    const Icon = CONTENT_TYPE_ICONS[type] || Layers;
    const color = CONTENT_TYPE_COLORS[type] || "text-text-secondary";
    return <Icon className={`w-4 h-4 ${color}`} />;
  }

  return (
    <div className={`space-y-6 animate-fade-in font-tech ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Layers className="w-7 h-7 md:w-9 md:h-9 text-accent-secondary" />
            Content & Activity Hub
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl m-0">
            Discover and manage content across all portals.
          </p>
        </div>

        {showCreateButton && onCreate && (
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
          >
            <Sparkles size={15} />
            <span>Create Content</span>
          </button>
        )}
      </div>

      {/* Error/Loading/Empty States */}
      {error && (
        <div className="p-4 border border-status-error/40 bg-status-error/10 rounded text-xs text-status-error flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading && items.length === 0 && (
        <div className="min-h-[300px] flex flex-col items-center justify-center border border-border-color bg-surface-color/50 rounded p-8">
          <Loader2 className="w-8 h-8 text-accent-secondary animate-spin mb-3" />
          <p className="font-tech text-text-secondary text-sm uppercase tracking-wider">
            {loadingMessage}
          </p>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="border border-dashed border-border-color bg-surface-color/30 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-accent-secondary mx-auto mb-3 opacity-50" />
          <h3 className="font-heading text-lg text-text-primary uppercase m-0">
            {emptyMessage || "No content found"}
          </h3>
          <p className="text-xs text-text-secondary mt-2">
            Create your first content item or adjust filters to find what you're looking for.
          </p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
            >
              <Sparkles size={14} />
              Create Content
            </button>
          )}
        </div>
      )}

      {/* Filters & Search */}
      {showFilters && (
        <div className="bg-surface-color/50 border border-border-color rounded-xl p-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            {showSearch && (
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="text"
                  name="search"
                  placeholder="Search by title, content, or reference..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none font-mono"
                />
              </div>
            )}

            <select
              value={filters.content_type}
              onChange={(e) => handleFilterChange("content_type", e.target.value)}
              className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
            >
              <option value="">All Types</option>
              {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
            >
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
              className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filters.audience}
              onChange={(e) => handleFilterChange("audience", e.target.value)}
              className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2 outline-none focus:border-accent-secondary uppercase"
            >
              <option value="">All Audiences</option>
              {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </form>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginatedItems.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onView={() => handleView(item)}
            onEdit={() => onEdit?.(item)}
            onDelete={() => handleDeleteConfirm(item)}
            onPublish={() => onPublish?.(item.id)}
            onUnpublish={() => onUnpublish?.(item.id)}
            onArchive={() => onArchive?.(item.id)}
            onCopyLink={() => {
              const url = `${window.location.origin}/content/${item.id}`;
              navigator.clipboard.writeText(url);
              setNotification({ type: "success", message: "Link copied to clipboard." });
            }}
          />
        ))}

        {paginatedItems.length === 0 && items.length > 0 && (
          <div className="col-span-full p-8 text-center text-text-secondary">
            No items match your current filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="flex items-center text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-900/90 border border-green-500/30 text-green-100"
              : "bg-red-900/90 border border-red-500/30 text-red-100"
          }`}>
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-color border border-border-color rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between p-5 border-b border-border-color">
              <div>
<div className="flex items-center gap-2 mb-1">
                {getContentTypeIconComponent(selectedItem.content_type)}
                <span className="text-[10px] uppercase tracking-wider text-accent-secondary font-bold">
                  {getContentTypeLabel(selectedItem.content_type)}
                </span>
                  {selectedItem.pin_to_top && (
                    <Star className="w-4 h-4 text-yellow-400 animate-pulse" />
                  )}
                </div>
                <h3 className="font-heading text-xl text-text-primary uppercase m-0">
                  {selectedItem.title}
                </h3>
              </div>
              <button
                onClick={() => { setIsDetailOpen(false); setSelectedItem(null); }}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-6 max-h-[65vh] overflow-y-auto">
              {/* Status & Meta */}
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getStatusColors(selectedItem.status)}`}>
                  {getStatusLabel(selectedItem.status)}
                </span>
                <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${getPriorityColors(selectedItem.priority_level)}`}>
                  {getPriorityLabel(selectedItem.priority_level)}
                </span>
                <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary font-bold">
                  {getContentTypeLabel(selectedItem.content_type)}
                </span>
                {selectedItem.pin_to_top && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    PINNED
                  </span>
                )}
              </div>

              {/* Summary */}
              {selectedItem.summary && (
                <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">
                    Summary
                  </p>
                  <p className="text-sm text-text-primary m-0">
                    {selectedItem.summary}
                  </p>
                </div>
              )}

              {/* Body */}
              <div className="prose-invert max-w-none">
                {selectedItem.body ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {selectedItem.body}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No content body.</p>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Content Type</p>
                  <p className="font-medium text-text-primary m-0">{getContentTypeLabel(selectedItem.content_type)}</p>
                </div>
                {selectedItem.category && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Category</p>
                    <p className="font-medium text-text-primary m-0 capitalize">{selectedItem.category}</p>
                  </div>
                )}
                {selectedItem.domain && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Domain</p>
                    <p className="font-medium text-text-primary m-0">{selectedItem.domain}</p>
                  </div>
                )}
                {selectedItem.team_limit && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Team Limit</p>
                    <p className="font-heading text-lg text-accent-primary m-0">{selectedItem.team_limit}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Priority</p>
                  <p className="m-0">{getPriorityLabel(selectedItem.priority_level)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Status</p>
                  <p className="m-0">{getStatusLabel(selectedItem.status)}</p>
                </div>
              </div>

              {/* Target Audiences */}
              <div className="border border-border-color rounded p-4 bg-surface-color-light/50">
                <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold m-0 mb-2">
                  Target Portals
                </p>
                <div className="flex flex-wrap gap-2">
{selectedItem.target_audiences.map((audience) => (
                    <span key={audience} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-bold uppercase">
                      {AUDIENCE_ICONS[audience] ? (() => { const Icon = AUDIENCE_ICONS[audience]; return <Icon className="w-3 h-3" />; })() : <Globe className="w-3 h-3" />}
                      <span>{getAudienceLabel(audience)}</span>
                    </span>
                  ))}
                  {selectedItem.target_audience && selectedItem.target_audience !== "all" && !selectedItem.target_audiences.includes(selectedItem.target_audience) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-full bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-bold uppercase">
                      <Globe className="w-3 h-3" />
                      <span>{getAudienceLabel(selectedItem.target_audience)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Created</p>
                  <p className="font-mono text-sm text-text-secondary m-0">{formatDate(selectedItem.created_at)}</p>
                </div>
                <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Updated</p>
                  <p className="font-mono text-sm text-text-secondary m-0">{formatDate(selectedItem.updated_at)}</p>
                </div>
                {selectedItem.published_at && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Published</p>
                    <p className="font-mono text-sm text-text-secondary m-0">{formatDate(selectedItem.published_at)}</p>
                  </div>
                )}
                {selectedItem.scheduled_at && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Scheduled</p>
                    <p className="font-mono text-sm text-accent-primary m-0">{formatDate(selectedItem.scheduled_at)}</p>
                  </div>
                )}
                {selectedItem.expires_at && (
                  <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">Expires</p>
                    <p className="font-mono text-sm text-status-warning m-0">{formatDate(selectedItem.expires_at)}</p>
                  </div>
                )}
              </div>

              {/* Attachments */}
              {/* Note: In a real app, you'd fetch attachments from the server */}
              {/* For now, we'll show placeholder */}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border-color">
                <button
                  onClick={() => { setIsDetailOpen(false); setSelectedItem(null); }}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary w-full sm:w-auto"
                >
                  Close
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {selectedItem.status === "draft" && (
                    <button
                      onClick={() => { onPublish?.(selectedItem.id); setIsDetailOpen(false); setSelectedItem(null); }}
                      className="px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 w-full sm:w-auto"
                    >
                      <Send size={14} className="mr-1" />
                      <span>Publish</span>
                    </button>
                  )}
                  {selectedItem.status === "published" && (
                    <button
                      onClick={() => { onUnpublish?.(selectedItem.id); setIsDetailOpen(false); setSelectedItem(null); }}
                      className="px-4 py-2 bg-gradient-to-r from-status-warning to-status-error text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 w-full sm:w-auto"
                    >
                      <RotateCcw size={14} className="mr-1" />
                      <span>Unpublish</span>
                    </button>
                  )}
                  {selectedItem.status !== "archived" && (
                    <button
                      onClick={() => { onArchive?.(selectedItem.id); setIsDetailOpen(false); setSelectedItem(null); }}
                      className="px-4 py-2 bg-status-error/80 hover:bg-status-error text-white text-xs uppercase font-bold rounded w-full sm:w-auto"
                    >
                      <Archive size={14} className="mr-1" />
                      <span>Archive</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-status-error/40 rounded-xl w-full max-w-md p-6 space-y-4 animate-fade-in shadow-2xl">
            <h3 className="font-heading text-lg text-status-error uppercase m-0">
              Delete Content
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed m-0">
              Are you sure you want to permanently delete{" "}
              <span className="text-text-primary font-bold">{itemToDelete.title}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-status-error text-white text-xs uppercase font-bold rounded hover:bg-status-error/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-900/90 border border-green-500/30 text-green-100"
              : "bg-red-900/90 border border-red-500/30 text-red-100"
          }`}>
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Content Card Component
function ContentCard({
  item,
  onView,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onArchive,
  onCopyLink,
}: {
  item: ContentHubItem;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onCopyLink: () => void;
}) {
  const statusColors = getStatusColors(item.status);
  const priorityColors = getPriorityColors(item.priority_level);

  return (
    <article
      onClick={onView}
      className="border border-border-color bg-surface-color/40 rounded-xl p-5 flex flex-col gap-4 hover:border-accent-secondary/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded border ${CONTENT_TYPE_COLORS[item.content_type] || "text-text-secondary"} bg-${CONTENT_TYPE_COLORS[item.content_type]?.replace("text-", "bg-").replace("text-", "bg-") || "surface-color"}/10`}>
            {(CONTENT_TYPE_ICONS[item.content_type] ? (() => { const Icon = CONTENT_TYPE_ICONS[item.content_type]; return <Icon className="w-5 h-5" />; })() : <FileText className="w-5 h-5" />)}
          </div>
          <div>
            <h3 className="font-heading text-base text-text-primary uppercase tracking-wide m-0 truncate">
              {item.title}
            </h3>
            <span className={`px-2 py-0.5 border rounded text-[9px] uppercase tracking-wider font-bold ${getStatusColors(item.status)}`}>
              {getStatusLabel(item.status)}
            </span>
          </div>
        </div>

        <p className="text-xs text-text-secondary m-0 line-clamp-2">
          {item.summary || item.body?.slice(0, 180) || "No summary yet."}
        </p>

        <div className="flex flex-wrap gap-2 text-[10px] text-text-secondary font-mono">
          {item.reference_number && <span>{item.reference_number}</span>}
          {item.domain && <span>Domain: {item.domain}</span>}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${PRIORITY_COLORS[item.priority_level] || PRIORITY_COLORS.normal}`}>
            {PRIORITY_LABELS[item.priority_level] || item.priority_level}
          </span>
          <span className="flex items-center gap-1">
            <Paperclip size={10} className="inline" />
            {/* Attachments count would go here */}
          </span>
          <span>Updated {formatRelativeTime(item.updated_at)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border-color">
          <div className="flex flex-wrap items-center gap-2">
{item.target_audiences.map((audience) => (
                <span key={audience} className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
                  {(AUDIENCE_ICONS[audience] ? (() => { const Icon = AUDIENCE_ICONS[audience]; return <Icon className="w-2.5 h-2.5" />; })() : <Globe className="w-2.5 h-2.5" />)}
                  <span className="capitalize">{audience.replace("_", " ")}</span>
                </span>
              ))}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
              className="p-1.5 border border-border-color rounded text-text-secondary hover:text-accent-primary hover:border-accent-primary/50 transition-colors"
              title="Copy link"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 border border-border-color rounded text-text-secondary hover:text-accent-tertiary hover:border-accent-tertiary/50 transition-colors"
              title="Edit"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPublish(); }}
              disabled={item.status === "published"}
              className="p-1.5 border border-border-color rounded text-text-secondary hover:text-status-success hover:border-status-success/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={item.status === "published" ? "Already published" : "Publish"}
            >
              {item.status === "published" ? <CheckCircle2 size={13} /> : <Send size={13} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="p-1.5 border border-border-color rounded text-text-secondary hover:text-status-error hover:border-status-error/50 transition-colors"
              title="Archive"
            >
              <Archive size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 border border-border-color rounded text-text-secondary hover:text-status-error hover:border-status-error/50 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
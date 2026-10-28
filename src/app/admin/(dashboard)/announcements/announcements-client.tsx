"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import {
  Plus,
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
  X as XIcon,
} from "lucide-react";
import {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  unpublishAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  duplicateAnnouncement,
  getAnnouncementsAdmin,
  getAnnouncementCounts,
} from "@/app/actions/announcements";
import { format } from "date-fns";

export type AnnouncementStatus = "draft" | "scheduled" | "published" | "unpublished" | "archived";
export type AnnouncementCategory = "general" | "important" | "deadline" | "schedule" | "emergency";
export type AnnouncementPriority = "normal" | "high" | "urgent";
export type AnnouncementAudience = "all" | "teams" | "judges" | "ops" | "admin" | "participants" | "staff" | "organizers";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: string;
  priority_level: string;
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
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AnnouncementCounts {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  archived: number;
}

interface AnnouncementsClientProps {
  initialCounts: {
    total: number;
    published: number;
    scheduled: number;
    drafts: number;
    archived: number;
  };
  initialAnnouncements: any[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: { status?: string; audience?: string; search?: string };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  published: "bg-green-500/20 text-green-300 border-green-500/30",
  unpublished: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  archived: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-300 border-red-500/30",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: FileText,
  important: Info,
  deadline: AlertTriangle,
  schedule: Calendar,
  emergency: AlertCircle,
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Portals",
  teams: "Team Leaders",
  judges: "Judges",
  ops: "Operations",
  admin: "Admin Portal",
  participants: "Participants",
  staff: "Staff",
  organizers: "Organizers",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

export default function AnnouncementsClient({
  initialCounts,
  initialAnnouncements,
  total,
  currentPage,
  totalPages,
  filters,
}: AnnouncementsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [counts, setCounts] = useState<{
    total: number;
    published: number;
    scheduled: number;
    drafts: number;
    archived: number;
  }>(initialCounts);
  const [totalItems, setTotalItems] = useState(total);
  const [totalPagesState, setTotalPagesState] = useState(totalPages);
  const [page, setPage] = useState(currentPage);
  const [search, setSearch] = useState(filters.search || "");
  const [statusFilter, setStatusFilter] = useState(filters.status || "all");
  const [audienceFilter, setAudienceFilter] = useState(filters.audience || "all");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; announcement: Announcement } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    category: "general" as any,
    priority_level: "normal" as any,
    target_audience: "all" as any,
    status: "draft" as any,
    scheduled_at: "",
    expires_at: "",
    pin_to_top: false,
    attachment_url: "",
    attachment_name: "",
    resource_links: [{ label: "", url: "" }],
  });

  // Sync with URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (audienceFilter !== "all") params.set("audience", audienceFilter);
    router.push(`/admin/announcements?${params.toString()}`, { scroll: false });
  }, [page, search, statusFilter, audienceFilter, router]);

  // Fetch data when filters change
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [countsData, announcementsData] = await Promise.all([
        getAnnouncementCounts(),
        getAnnouncementsAdmin({
          status: (statusFilter !== "all" ? statusFilter : undefined) as any,
          audience: (audienceFilter !== "all" ? audienceFilter : undefined) as any,
          search: search || undefined,
          limit: 20,
          offset: (page - 1) * 20,
        }),
      ]);
      setCounts(countsData);
      setAnnouncements(announcementsData.announcements);
      setTotalItems(announcementsData.total);
      setTotalPagesState(Math.ceil(announcementsData.total / 20));
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, statusFilter, audienceFilter, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch((e.target as HTMLFormElement).search.value);
  };

  const handleStatusFilterChange = (value: string) => {
    setPage(1);
    setStatusFilter(value);
  };

  const handleAudienceFilterChange = (value: string) => {
    setPage(1);
    setAudienceFilter(value);
  };

  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: "",
      message: "",
      category: "general",
      priority_level: "normal",
      target_audience: "all",
      status: "draft",
      scheduled_at: "",
      expires_at: "",
      pin_to_top: false,
      attachment_url: "",
      attachment_name: "",
      resource_links: [{ label: "", url: "" }],
    });
    setModalOpen(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      category: announcement.category,
      priority_level: announcement.priority_level,
      target_audience: announcement.target_audience,
      status: announcement.status,
      scheduled_at: announcement.scheduled_at ? new Date(announcement.scheduled_at).toISOString().slice(0, 16) : "",
      expires_at: announcement.expires_at ? new Date(announcement.expires_at).toISOString().slice(0, 16) : "",
      pin_to_top: announcement.pin_to_top,
      attachment_url: announcement.attachment_url || "",
      attachment_name: announcement.attachment_name || "",
      resource_links: announcement.resource_links && announcement.resource_links.length > 0
        ? announcement.resource_links.map((rl: any) => ({ label: rl.label || "", url: rl.url || "" }))
        : [{ label: "", url: "" }],
    });
    setModalOpen(true);
  };

  const openPreview = (announcement: Announcement) => {
    setPreviewAnnouncement(announcement);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAnnouncement(null);
    setFormData({
      title: "",
      message: "",
      category: "general",
      priority_level: "normal",
      target_audience: "all",
      status: "draft",
      scheduled_at: "",
      expires_at: "",
      pin_to_top: false,
      attachment_url: "",
      attachment_name: "",
      resource_links: [{ label: "", url: "" }],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      resource_links: formData.resource_links.filter((r: any) => r.label || r.url),
      scheduled_at: formData.scheduled_at || null,
      expires_at: formData.expires_at || null,
    };

    try {
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, payload);
        setNotification({ type: "success", message: "Announcement updated successfully" });
      } else {
        await createAnnouncement(payload);
        setNotification({ type: "success", message: "Announcement created successfully" });
      }
      closeModal();
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Operation failed" });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishAnnouncement(id);
      setNotification({ type: "success", message: "Announcement published" });
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to publish" });
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await unpublishAnnouncement(id);
      setNotification({ type: "success", message: "Announcement unpublished" });
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to unpublish" });
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveAnnouncement(id);
      setNotification({ type: "success", message: "Announcement archived" });
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to archive" });
    }
  };

  const confirmDelete = (announcement: Announcement) => {
    setDeleteTarget(announcement);
    setConfirmAction({ type: "delete", announcement });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAnnouncement(deleteTarget.id);
      setNotification({ type: "success", message: "Announcement deleted" });
      setDeleteTarget(null);
      setConfirmAction(null);
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to delete" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateAnnouncement(id);
      setNotification({ type: "success", message: "Announcement duplicated" });
      fetchData();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to duplicate" });
    }
  };

  const addResourceLink = () => {
    setFormData((prev: any) => ({
      ...prev,
      resource_links: [...prev.resource_links, { label: "", url: "" }],
    }));
  };

  const removeResourceLink = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      resource_links: prev.resource_links.filter((_: any, i: number) => i !== index),
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return "—";
    }
  };

  const formatDateTimeLocal = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle2 className="w-3 h-3" />;
      case "scheduled": return <Clock className="w-3 h-3" />;
      case "draft": return <FileText className="w-3 h-3" />;
      case "archived": return <Archive className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-sm text-gray-400 mt-1">Manage system-wide announcements across all portals</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-white">{counts.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Published</p>
              <p className="text-2xl font-bold text-white">{counts.published}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Scheduled</p>
              <p className="text-2xl font-bold text-white">{counts.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Drafts</p>
              <p className="text-2xl font-bold text-white">{counts.drafts}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Archive className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Archived</p>
              <p className="text-2xl font-bold text-white">{counts.archived}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="search"
              type="text"
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={audienceFilter}
            onChange={(e) => handleAudienceFilterChange(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
          >
            <option value="all">All Audiences</option>
            <option value="all">All Portals</option>
            <option value="teams">Team Leaders</option>
            <option value="judges">Judges</option>
            <option value="ops">Operations</option>
            <option value="admin">Admin Portal</option>
            <option value="participants">Participants</option>
            <option value="staff">Staff</option>
            <option value="organizers">Organizers</option>
          </select>
        </form>
      </div>

      {/* Announcements List */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-2" />
            <p className="text-gray-400">Loading announcements...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300 mb-1">No announcements found</h3>
            <p className="text-gray-500 text-sm">Create your first announcement or adjust filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Audience</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Published</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Expires</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {announcements.map((announcement: Announcement) => (
                    <tr key={announcement.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {announcement.pin_to_top && <Star className="w-4 h-4 text-yellow-400" />}
                          <div>
                            <p className="font-medium text-white truncate max-w-xs md:max-w-md">{announcement.title}</p>
                            <p className="text-xs text-gray-400 truncate max-w-xs md:max-w-md line-clamp-1">{announcement.message}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-800 border border-gray-700">
                          {(() => {
                            const IconComponent = CATEGORY_ICONS[announcement.category] || FileText;
                            return <IconComponent className="w-3 h-3 text-gray-400" />;
                          })()}
                          <span className="capitalize text-gray-300">{announcement.category}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                          {AUDIENCE_LABELS[announcement.target_audience] || announcement.target_audience}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${STATUS_COLORS[announcement.status] || STATUS_COLORS.draft}`}>
                          {getStatusIcon(announcement.status)}
                          <span className="capitalize">{STATUS_LABELS[announcement.status] || announcement.status}</span>
                        </span>
                        {announcement.pin_to_top && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">PINNED</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-sm">
                        {announcement.published_at ? formatDate(announcement.published_at) : "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-sm">
                        {announcement.expires_at ? formatDate(announcement.expires_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openPreview(announcement)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(announcement)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {announcement.status === "draft" && (
                            <button
                              onClick={() => handlePublish(announcement.id)}
                              className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                              title="Publish Now"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {announcement.status === "published" && (
                            <button
                              onClick={() => handleUnpublish(announcement.id)}
                              className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                              title="Unpublish"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {announcement.status !== "archived" && (
                            <button
                              onClick={() => handleArchive(announcement.id)}
                              className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicate(announcement.id)}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(announcement)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPagesState > 1 && (
              <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  Page {page} of {totalPagesState} · {totalItems} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || isLoading}
                    className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPagesState || isLoading}
                    className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
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

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">{editingAnnouncement ? "Edit Announcement" : "Create Announcement"}</h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Announcement title"
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Announcement message (supports paragraphs, lists, links)"
                  required
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-mono text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  >
                    <option value="general">General</option>
                    <option value="important">Important</option>
                    <option value="deadline">Deadline</option>
                    <option value="schedule">Schedule</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Priority *</label>
                  <select
                    value={formData.priority_level}
                    onChange={(e) => setFormData({ ...formData, priority_level: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Audience *</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  >
                    <option value="all">All Portals</option>
                    <option value="teams">Team Leaders</option>
                    <option value="judges">Judges</option>
                    <option value="ops">Operations</option>
                    <option value="admin">Admin Portal</option>
                    <option value="participants">Participants</option>
                    <option value="staff">Staff</option>
                    <option value="organizers">Organizers</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Scheduled At</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Expires At</label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pin_to_top}
                    onChange={(e) => setFormData({ ...formData, pin_to_top: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-gray-300">Pin to top</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Attachment URL</label>
                <input
                  type="url"
                  value={formData.attachment_url}
                  onChange={(e) => setFormData({ ...formData, attachment_url: e.target.value })}
                  placeholder="https://example.com/file.pdf"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Attachment Name</label>
                <input
                  type="text"
                  value={formData.attachment_name}
                  onChange={(e) => setFormData({ ...formData, attachment_name: e.target.value })}
                  placeholder="Document name (optional)"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-400">Resource Links</label>
                  <button type="button" onClick={addResourceLink} className="text-xs text-pink-400 hover:text-pink-300">
                    <Plus className="w-3 h-3 inline mr-1" /> Add Link
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.resource_links.map((link: any, index: number) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Label"
                        value={link.label}
                        onChange={(e) => {
                          const newLinks = [...formData.resource_links];
                          newLinks[index] = { ...link, label: e.target.value };
                          setFormData({ ...formData, resource_links: newLinks });
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                      />
                      <input
                        type="url"
                        placeholder="URL"
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...formData.resource_links];
                          newLinks[index] = { ...link, url: e.target.value };
                          setFormData({ ...formData, resource_links: newLinks });
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                      />
                      {formData.resource_links.length > 1 && (
                        <button type="button" onClick={() => removeResourceLink(index)} className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg">
                  {editingAnnouncement ? "Save Changes" : "Create Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Preview Announcement</h2>
              <button onClick={() => setPreviewAnnouncement(null)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${STATUS_COLORS[previewAnnouncement.status] || STATUS_COLORS.draft}`}>
                  {getStatusIcon(previewAnnouncement.status)}
                  <span className="capitalize">{STATUS_LABELS[previewAnnouncement.status] || previewAnnouncement.status}</span>
                </span>
                <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-300">
                  {AUDIENCE_LABELS[previewAnnouncement.target_audience] || previewAnnouncement.target_audience}
                </span>
                {previewAnnouncement.pin_to_top && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">PINNED</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white">{previewAnnouncement.title}</h3>
              <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                {previewAnnouncement.message}
              </div>
              {previewAnnouncement.attachment_url && (
                <a href={previewAnnouncement.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-pink-400 hover:bg-gray-700 transition-colors">
                  <Paperclip className="w-4 h-4" />
                  <span>{previewAnnouncement.attachment_name || "Attachment"}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {previewAnnouncement.resource_links && previewAnnouncement.resource_links.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Resources</p>
                  <ul className="space-y-1">
                    {previewAnnouncement.resource_links.map((link: any, index: number) => (
                      <li key={index}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300">
                          <ExternalLink className="w-3 h-3" />
                          <span>{link.label || link.url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-4 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-500">
                <span>Created: {formatDate(previewAnnouncement.created_at)}</span>
                <span>Updated: {formatDate(previewAnnouncement.updated_at)}</span>
                {previewAnnouncement.published_at && <span>Published: {formatDate(previewAnnouncement.published_at)}</span>}
                {previewAnnouncement.expires_at && <span>Expires: {formatDate(previewAnnouncement.expires_at)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Delete Announcement</h3>
              </div>
              <p className="text-gray-300 mb-4">Are you sure you want to delete <strong>"{confirmAction.announcement.title}"</strong>? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setConfirmAction(null); setDeleteTarget(null); }} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700">
                  Cancel
                </button>
                <button onClick={executeDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  FolderKanban,
  FolderPlus,
  History,
  Import,
  Loader2,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createContentActivity,
  createContentItem,
  deleteContentItem,
  getContentFileDownloadUrl,
  getContentItemHistory,
  prepareContentFileUpload,
  publishContentItem,
  publishAllContentItems,
  registerContentFile,
  removeContentFile,
  unpublishContentItem,
  updateContentItem,
  scheduleContentItem,
} from "@/app/actions/admin-content-hub";
import type {
  ActivityType,
  ContentActivity,
  ContentFile,
  ContentHistoryEntry,
  ContentItem,
} from "@/app/actions/admin-content-hub";

interface ContentHubClientViewProps {
  initialActivities: ContentActivity[];
  initialItems: ContentItem[];
  initialError?: string;
}

interface ItemFormState {
  title: string;
  referenceNumber: string;
  summary: string;
  body: string;
  domain: string;
  priority: string;
  audience: string;
  recipient: string;
  teamName: string;
  resourceUrl: string;
  category: string;
  // New field – maximum number of teams allowed to select this statement.
  teamLimit: string;
  // Allocation controls
  enableSelection: boolean;
  manualLock: boolean;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  problem_statements: "Problem Statements",
  certificates: "Certificate Releases",
  announcements: "Announcements",
  resources: "Resource Library",
  custom: "Custom Activity",
};

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  problem_statements: FileText,
  certificates: Award,
  announcements: Megaphone,
  resources: BookOpen,
  custom: FolderKanban,
};

const ACTIVITY_ACCENTS: Record<ActivityType, string> = {
  problem_statements: "text-accent-secondary border-accent-secondary/40 bg-accent-secondary/10",
  certificates: "text-accent-primary border-accent-primary/40 bg-accent-primary/10",
  announcements: "text-status-warning border-status-warning/40 bg-status-warning/10",
  resources: "text-accent-tertiary border-accent-tertiary/40 bg-accent-tertiary/10",
  custom: "text-text-primary border-border-color bg-surface-color-light",
};

const EMPTY_FORM: ItemFormState = {
  title: "",
  referenceNumber: "",
  summary: "",
  body: "",
  domain: "",
  priority: "normal",
  audience: "all",
  recipient: "",
  teamName: "",
  resourceUrl: "",
  category: "",
  teamLimit: "",
  enableSelection: true,
  manualLock: false,
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(size: number): string {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "content"
  );
}

function recountActivities(
  activities: ContentActivity[],
  items: ContentItem[]
): ContentActivity[] {
  return activities.map((activity) => {
    const activityItems = items.filter(
      (item) => item.activity_id === activity.id
    );
    const publishedCount = activityItems.filter(
      (item) => item.status === "published"
    ).length;

    return {
      ...activity,
      item_count: activityItems.length,
      published_count: publishedCount,
      draft_count: activityItems.length - publishedCount,
    };
  });
}

function metadataFor(
  type: ActivityType,
  form: ItemFormState
): Record<string, unknown> {
  switch (type) {
    case "problem_statements":
      return { domain: form.domain.trim() || null };
    case "certificates":
      return {
        recipient: form.recipient.trim() || null,
        team_name: form.teamName.trim() || null,
      };
    case "announcements":
      return {
        priority: form.priority || "normal",
        audience: form.audience || "all",
      };
    case "resources":
      return {
        resource_url: form.resourceUrl.trim() || null,
        category: form.category.trim() || null,
      };
    default:
      return { category: form.category.trim() || null };
  }
}

function statusClass(status: ContentItem["status"]): string {
  if (status === "published") {
    return "bg-status-success/15 text-status-success border-status-success/40";
  }
  if (status === "unpublished") {
    return "bg-status-warning/15 text-status-warning border-status-warning/40";
  }
  return "bg-surface-color-light text-text-secondary border-border-color";
}

function downloadBlob(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function renderBody(body: string) {
  const lines = body.split(/\r?\n/);
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-2" />;
    if (trimmed.startsWith("### ")) {
      return (
        <h4
          key={index}
          className="font-heading text-sm uppercase tracking-wider text-accent-tertiary mt-4 mb-1"
        >
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3
          key={index}
          className="font-heading text-base uppercase tracking-wider text-text-primary mt-4 mb-1"
        >
          {trimmed.slice(3)}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2
          key={index}
          className="font-heading text-lg uppercase tracking-wider text-accent-secondary mt-4 mb-1"
        >
          {trimmed.slice(2)}
        </h2>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <p key={index} className="text-sm text-text-secondary my-1 pl-4">
          <span className="text-accent-primary mr-2">•</span>
          {trimmed.slice(2)}
        </p>
      );
    }
    return (
      <p key={index} className="text-sm leading-relaxed text-text-secondary my-1">
        {line}
      </p>
    );
  });
}

export default function ContentHubClientView({
  initialActivities,
  initialItems,
  initialError,
}: ContentHubClientViewProps) {
  const [activities, setActivities] = useState(initialActivities);
  const [items, setItems] = useState(initialItems);
  const error = initialError || "";
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ActivityType>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleItem, setScheduleItem] = useState<ContentItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTimezone, setScheduleTimezone] = useState<string>('UTC');
  const [activityForm, setActivityForm] = useState<{
    title: string;
    description: string;
    type: ActivityType;
  }>({ title: "", description: "", type: "custom" });
  const [creatingActivity, setCreatingActivity] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [historyItem, setHistoryItem] = useState<ContentItem | null>(null);
  const [historyEntries, setHistoryEntries] = useState<ContentHistoryEntry[]>(
    []
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) || null,
    [activities, selectedActivityId]
  );

  const activityItems = useMemo(() => {
    if (!selectedActivity) return [];
    const query = search.toLowerCase().trim();
    return items
      .filter((item) => item.activity_id === selectedActivity.id)
      .filter((item) => {
        if (statusFilter === "published" && item.status !== "published") {
          return false;
        }
        if (statusFilter === "draft" && item.status === "published") {
          return false;
        }
        if (!query) return true;
        return (
          item.title.toLowerCase().includes(query) ||
          (item.summary?.toLowerCase().includes(query) ?? false) ||
          (item.reference_number?.toLowerCase().includes(query) ?? false) ||
          item.body.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [items, selectedActivity, search, statusFilter]);

  const filteredActivities = useMemo(() => {
    const query = search.toLowerCase().trim();
    return activities.filter((activity) => {
      if (typeFilter !== "all" && activity.type !== typeFilter) return false;
      if (!query) return true;
      return (
        activity.title.toLowerCase().includes(query) ||
        (activity.description?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [activities, search, typeFilter]);

  const metrics = useMemo(() => {
    const published = items.filter((item) => item.status === "published").length;
    const files = items.reduce((sum, item) => sum + item.files.length, 0);
    return {
      activities: activities.length,
      items: items.length,
      published,
      drafts: items.length - published,
      files,
    };
  }, [activities, items]);

  const replaceItem = (updated: ContentItem) => {
    setItems((prev) => {
      const exists = prev.some((item) => item.id === updated.id);
      const next = exists
        ? prev.map((item) => (item.id === updated.id ? updated : item))
        : [updated, ...prev];
      setActivities((current) => recountActivities(current, next));
      return next;
    });
    setEditingItem(updated);
  };

  const removeItemFromState = (itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      setActivities((current) => recountActivities(current, next));
      return next;
    });
    if (editingItem?.id === itemId) {
      setEditingItem(null);
      setEditorOpen(false);
    }
  };

  const openCreateActivity = () => {
    setActivityForm({ title: "", description: "", type: "custom" });
    setActivityModalOpen(true);
  };

  const submitActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!activityForm.title.trim()) return;

    setCreatingActivity(true);
    try {
      const created = await createContentActivity({
        title: activityForm.title,
        description: activityForm.description,
        type: activityForm.type,
      });
      setActivities((prev) => [...prev, created]);
      setActivityModalOpen(false);
      setSelectedActivityId(created.id);
      setSearch("");
      setNotification({
        type: "success",
        message: `Activity “${created.title}” created.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to create activity.",
      });
    } finally {
      setCreatingActivity(false);
    }
  };

  const openCreateItem = () => {
    if (!selectedActivity) return;
    setEditingItem(null);
    setItemForm({
      ...EMPTY_FORM,
      audience: "all",
      priority: "normal",
    });
    setEditorOpen(true);
  };

  const openEditItem = (item: ContentItem) => {
    setEditingItem(item);
    setItemForm({
      title: item.title,
      referenceNumber: item.reference_number || "",
      summary: item.summary || "",
      body: item.body || "",
      domain: item.domain || String(item.metadata.domain || ""),
      priority: String(item.metadata.priority || "normal"),
      audience: String(item.metadata.audience || "all"),
      recipient: String(item.metadata.recipient || ""),
      teamName: String(item.metadata.team_name || ""),
      resourceUrl: String(item.metadata.resource_url || ""),
      category: String(item.metadata.category || ""),
      teamLimit: item.team_limit != null ? String(item.team_limit) : "",
      enableSelection: item.enable_selection !== false,
      manualLock: item.manual_lock === true,
    });
    setEditorOpen(true);
  };

  const saveItem = async (publishAfterSave: boolean) => {
    if (!selectedActivity) return;
    if (!itemForm.title.trim()) {
      setNotification({ type: "error", message: "A content title is required." });
      return;
    }

    setSavingItem(true);
    try {
      const rawTeamLimit = itemForm.teamLimit.trim();
      const teamLimit =
        selectedActivity.type !== "problem_statements"
          ? undefined
          : rawTeamLimit
            ? Number.parseInt(rawTeamLimit, 10)
            : editingItem?.team_limit != null
              ? null
              : undefined;
      const allocationChanged =
        selectedActivity.type === "problem_statements" &&
        (itemForm.enableSelection !== (editingItem?.enable_selection ?? true) ||
          itemForm.manualLock !== (editingItem?.manual_lock ?? false));

      const payload = {
        activityId: selectedActivity.id,
        title: itemForm.title,
        referenceNumber: itemForm.referenceNumber,
        summary: itemForm.summary,
        body: itemForm.body,
        domain: itemForm.domain,
        metadata: metadataFor(selectedActivity.type, itemForm),
        ...(teamLimit !== undefined ? { teamLimit } : {}),
        ...(allocationChanged
          ? {
              enableSelection: itemForm.enableSelection,
              manualLock: itemForm.manualLock,
            }
          : {}),
      };

      let saved: ContentItem;
      if (editingItem) {
        saved = await updateContentItem({
          itemId: editingItem.id,
          ...payload,
        });
      } else {
        saved = await createContentItem(payload);
      }

      if (publishAfterSave) {
        saved = await publishContentItem(saved.id);
        setEditorOpen(false);
      }

      replaceItem(saved);
      setNotification({
        type: "success",
        message: publishAfterSave
          ? `“${saved.title}” published.`
          : `Draft saved for “${saved.title}”. You can now attach files.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save content.",
      });
    } finally {
      setSavingItem(false);
    }
  };

  const togglePublish = (item: ContentItem) => {
    startTransition(async () => {
      try {
        const updated =
          item.status === "published"
            ? await unpublishContentItem(item.id)
            : await publishContentItem(item.id);
        replaceItem(updated);
        setNotification({
          type: "success",
          message:
            updated.status === "published"
              ? `“${updated.title}” is now published.`
              : `“${updated.title}” returned to draft.`,
        });
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Failed to change publication.",
        });
      }
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteContentItem(deleteTarget.id);
      removeItemFromState(deleteTarget.id);
      setDeleteTarget(null);
      setPreviewItem(null);
      setNotification({ type: "success", message: "Content item deleted." });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete item.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!editingItem) {
      setNotification({
        type: "error",
        message: "Save the draft first, then attach files to it.",
      });
      return;
    }

    setUploadingFile(true);
    try {
      const uploaded: ContentFile[] = [];

      for (const file of Array.from(files)) {
        const prepared = await prepareContentFileUpload({
          itemId: editingItem.id,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        });

        const response = await fetch(prepared.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}.`);
        }

        const registered = await registerContentFile({
          itemId: editingItem.id,
          name: file.name,
          path: prepared.path,
          mimeType: file.type,
          size: file.size,
        });

        uploaded.push(registered);
      }

      const updated = {
        ...editingItem,
        files: [...editingItem.files, ...uploaded],
      };
      replaceItem(updated);
      setNotification({
        type: "success",
        message: `${uploaded.length} file${uploaded.length === 1 ? "" : "s"} attached.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "File upload failed.",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = async (file: ContentFile) => {
    if (!editingItem) return;
    setUploadingFile(true);
    try {
      await removeContentFile({
        itemId: editingItem.id,
        fileId: file.id,
      });
      const updated = {
        ...editingItem,
        files: editingItem.files.filter((entry) => entry.id !== file.id),
      };
      replaceItem(updated);
      setNotification({ type: "success", message: "File removed." });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to remove file.",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadFile = async (file: ContentFile) => {
    if (!editingItem) return;
    try {
      const result = await getContentFileDownloadUrl({
        itemId: editingItem.id,
        fileId: file.id,
      });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to open file download.",
      });
    }
  };

  const importTextFile = async (file: File | undefined) => {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const supported = [".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm"];

    if (!supported.includes(extension)) {
      setNotification({
        type: "error",
        message:
          "Text extraction is available for TXT, MD, CSV, JSON, and HTML files. Other supported files can still be uploaded.",
      });
      return;
    }

    setImporting(true);
    try {
      let text = await file.text();
      let suggestedTitle = file.name.replace(/\.[^.]+$/, "");

      if (extension === ".html" || extension === ".htm") {
        const document = new DOMParser().parseFromString(text, "text/html");
        text = document.body.textContent || "";
      } else if (extension === ".json") {
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const record = parsed as Record<string, unknown>;
            if (typeof record.title === "string") suggestedTitle = record.title;
          }
          text = JSON.stringify(parsed, null, 2);
        } catch {
          // Keep the raw text if it is not valid JSON.
        }
      } else if (extension === ".md" || extension === ".markdown") {
        const heading = text.match(/^#\s+(.+)$/m);
        if (heading?.[1]) suggestedTitle = heading[1].trim();
      }

      setItemForm((prev) => ({
        ...prev,
        title: prev.title.trim() || suggestedTitle,
        body: text,
      }));
      setNotification({
        type: "success",
        message: `Imported “${file.name}” into the editable draft.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to read the document.",
      });
    } finally {
      setImporting(false);
    }
  };

  const openHistory = async (item: ContentItem) => {
    setHistoryItem(item);
    setHistoryEntries([]);
    setHistoryLoading(true);
    try {
      const entries = await getContentItemHistory(item.id);
      setHistoryEntries(entries);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to load publication history.",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportItem = (item: ContentItem, format: "json" | "markdown") => {
    if (format === "json") {
      downloadBlob(
        `${slugify(item.title)}.json`,
        JSON.stringify(
          {
            title: item.title,
            reference_number: item.reference_number,
            activity: selectedActivity?.title || null,
            activity_type: item.activity_type,
            item_type: item.item_type,
            status: item.status,
            summary: item.summary,
            body: item.body,
            domain: item.domain,
            metadata: item.metadata,
            files: item.files.map((file) => ({
              name: file.name,
              path: file.path,
              mime_type: file.mime_type,
              size: file.size,
            })),
            published_at: item.published_at,
            updated_at: item.updated_at,
          },
          null,
          2
        ),
        "application/json"
      );
      return;
    }

    const lines = [
      `# ${item.title}`,
      "",
      item.reference_number ? `Reference: ${item.reference_number}` : "",
      item.domain ? `Domain: ${item.domain}` : "",
      item.summary ? `Summary: ${item.summary}` : "",
      "",
      item.body,
      "",
      "## Attached files",
      ...(item.files.length > 0
        ? item.files.map((file) => `- ${file.name} (${formatBytes(file.size)})`)
        : ["- None"]),
    ].filter((line) => line !== "");

    downloadBlob(
      `${slugify(item.title)}.md`,
      lines.join("\n"),
      "text/markdown"
    );
  };

  const renderHub = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Activities",
            value: metrics.activities,
            icon: FolderKanban,
            color: "text-accent-secondary",
          },
          {
            label: "Content Items",
            value: metrics.items,
            icon: FileCheck2,
            color: "text-accent-tertiary",
          },
          {
            label: "Published",
            value: metrics.published,
            icon: CheckCircle2,
            color: "text-status-success",
          },
          {
            label: "Drafts",
            value: metrics.drafts,
            icon: Clock3,
            color: "text-accent-primary",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border border-border-color bg-surface-color/50 rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[1.5px] text-text-secondary font-bold m-0">
                {metric.label}
              </p>
              <p className={`font-heading text-2xl m-0 mt-1 ${metric.color}`}>
                {metric.value}
              </p>
            </div>
            <metric.icon size={22} className={metric.color} />
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-status-error/40 bg-status-error/10 px-4 py-3 rounded text-xs text-status-error flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities and content..."
              className="w-full pl-9 pr-3 py-2.5 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "all" | ActivityType)
            }
            className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2.5 outline-none focus:border-accent-secondary uppercase"
          >
            <option value="all">All Activity Types</option>
            {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={openCreateActivity}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
        >
          <Plus size={15} />
          <span>Create Activity</span>
        </button>
      </div>

      {filteredActivities.length === 0 ? (
        <div className="border border-dashed border-border-color bg-surface-color/30 rounded-lg p-12 text-center">
          <FolderPlus className="w-10 h-10 text-accent-secondary mx-auto mb-3" />
          <h3 className="font-heading text-lg text-text-primary uppercase m-0">
            No activities match
          </h3>
          <p className="text-xs text-text-secondary mt-2">
            Adjust the search or create a new activity to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredActivities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type];
            const accent = ACTIVITY_ACCENTS[activity.type];
            const publishedLabel =
              activity.published_count > 0
                ? `${activity.published_count} published`
                : "No published content";

            return (
              <article
                key={activity.id}
                className="relative overflow-hidden border border-border-color bg-surface-color/50 rounded-lg p-5 flex flex-col gap-4 hover:border-accent-secondary/50 transition-colors"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-tertiary" />
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2.5 rounded border ${accent}`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-[9px] uppercase tracking-[1.5px] text-text-secondary border border-border-color rounded px-2 py-1">
                    {activity.built_in ? "Built-in" : "Custom"}
                  </span>
                </div>

                <div className="space-y-1.5 flex-1">
                  <p className="text-[10px] uppercase tracking-[2px] text-accent-tertiary font-bold m-0">
                    {ACTIVITY_LABELS[activity.type]}
                  </p>
                  <h2 className="font-heading text-lg text-text-primary uppercase tracking-wide m-0">
                    {activity.title}
                  </h2>
                  <p className="text-xs text-text-secondary leading-relaxed m-0">
                    {activity.description || "No description provided."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <span className="px-2 py-1 rounded bg-surface-color-light border border-border-color text-text-secondary">
                    {activity.item_count} item{activity.item_count === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`px-2 py-1 rounded border ${
                      activity.published_count > 0
                        ? "bg-status-success/10 text-status-success border-status-success/40"
                        : "bg-surface-color-light text-text-secondary border-border-color"
                    }`}
                  >
                    {publishedLabel}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedActivityId(activity.id);
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="inline-flex items-center justify-between gap-2 px-3 py-2 border border-accent-secondary/40 bg-accent-secondary/5 text-accent-secondary hover:bg-accent-secondary/10 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowLeft size={13} className="rotate-180" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderWorkspace = () => {
    if (!selectedActivity) return null;
    const Icon = ACTIVITY_ICONS[selectedActivity.type];
    const accent = ACTIVITY_ACCENTS[selectedActivity.type];

    return (
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-color pb-5">
          <div className="flex items-start gap-3">
            <button
              onClick={() => {
                setSelectedActivityId(null);
                setSearch("");
                setStatusFilter("all");
              }}
              className="mt-1 p-2 border border-border-color rounded hover:border-accent-secondary text-text-secondary hover:text-text-primary transition-colors"
              title="Back to all activities"
            >
              <ArrowLeft size={16} />
            </button>
            <div className={`p-3 rounded border ${accent}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-accent-tertiary font-bold m-0">
                {ACTIVITY_LABELS[selectedActivity.type]}
              </p>
              <h2 className="font-heading text-2xl text-text-primary uppercase tracking-wide m-0">
                {selectedActivity.title}
              </h2>
              <p className="text-xs text-text-secondary m-0 mt-1 max-w-2xl">
                {selectedActivity.description || "No description provided."}
              </p>
            </div>
          </div>

          <button
            onClick={openCreateItem}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(255,0,127,0.28)]"
          >
            <Plus size={15} />
            <span>New Content</span>
          </button>
          {/* Bulk publish button – publishes all draft items in the current activity */}
          <button
            onClick={async () => {
              startTransition(async () => {
                try {
                  await publishAllContentItems(selectedActivity.id);
                  // Refresh activity items by reloading the page data.
                  window.location.reload();
                } catch (err) {
                  setNotification({ type: "error", message: err instanceof Error ? err.message : "Bulk publish failed" });
                }
              });
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-primary to-accent-secondary text-black font-tech font-bold uppercase tracking-wider text-xs rounded transition-all hover:opacity-90 shadow-[0_0_18px_rgba(0,255,127,0.28)]"
          >
            <Send size={15} />
            <span>Publish All Drafts</span>
          </button>

        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="border border-border-color bg-surface-color/50 rounded p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">
              Items
            </p>
            <p className="font-heading text-xl text-accent-tertiary m-0">
              {selectedActivity.item_count}
            </p>
          </div>
          <div className="border border-border-color bg-surface-color/50 rounded p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">
              Published
            </p>
            <p className="font-heading text-xl text-status-success m-0">
              {selectedActivity.published_count}
            </p>
          </div>
          <div className="border border-border-color bg-surface-color/50 rounded p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0">
              Drafts
            </p>
            <p className="font-heading text-xl text-accent-primary m-0">
              {selectedActivity.draft_count}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${selectedActivity.title}...`}
              className="w-full pl-9 pr-3 py-2.5 bg-surface-color border border-border-color rounded text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-secondary outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "published" | "draft"
              )
            }
            className="bg-surface-color border border-border-color rounded text-xs text-text-primary px-3 py-2.5 outline-none focus:border-accent-secondary uppercase"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>

        {activityItems.length === 0 ? (
          <div className="border border-dashed border-border-color bg-surface-color/30 rounded-lg p-12 text-center">
            <FileText className="w-10 h-10 text-accent-secondary mx-auto mb-3" />
            <h3 className="font-heading text-lg text-text-primary uppercase m-0">
              No content in this activity
            </h3>
            <p className="text-xs text-text-secondary mt-2">
              Create the first draft, import a text document, or attach a file.
            </p>
            <button
              onClick={openCreateItem}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-accent-secondary/40 text-accent-secondary rounded text-xs font-bold uppercase tracking-wider hover:bg-accent-secondary/10"
            >
              <Plus size={14} />
              Create Content
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activityItems.map((item) => {
              const published = item.status === "published";
              return (
                <article
                  key={item.id}
                  className="border border-border-color bg-surface-color/40 rounded-lg p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:border-accent-secondary/40 transition-colors"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-base text-text-primary uppercase tracking-wide m-0 truncate">
                        {item.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 border rounded text-[9px] uppercase tracking-wider font-bold ${statusClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      {item.is_legacy && (
                        <span className="px-2 py-0.5 border border-border-color rounded text-[9px] uppercase tracking-wider text-text-secondary">
                          Legacy statement
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary m-0 line-clamp-2">
                      {item.summary || item.body.slice(0, 180) || "No summary yet."}
                    </p>
                    <div className="flex flex-wrap gap-3 text-[10px] text-text-secondary font-mono">
                      {item.reference_number && <span>{item.reference_number}</span>}
                      {item.domain && <span>Domain: {item.domain}</span>}
                      <span>
                        <Paperclip size={10} className="inline mr-1" />
                        {item.files.length} file{item.files.length === 1 ? "" : "s"}
                      </span>
                      <span>Updated {formatDate(item.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditItem(item)}
                      className="p-2 border border-border-color rounded text-text-secondary hover:text-accent-tertiary hover:border-accent-tertiary/50 transition-colors"
                      title="Edit content"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-2 border border-border-color rounded text-text-secondary hover:text-accent-primary hover:border-accent-primary/50 transition-colors"
                      title="Preview content"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => openHistory(item)}
                      className="p-2 border border-border-color rounded text-text-secondary hover:text-accent-secondary hover:border-accent-secondary/50 transition-colors"
                      title="Publication history"
                    >
                      <History size={14} />
                    </button>
                    <button
                      onClick={() => exportItem(item, "json")}
                      className="p-2 border border-border-color rounded text-text-secondary hover:text-status-success hover:border-status-success/50 transition-colors"
                      title="Export JSON"
                    >
                      <FileJson size={14} />
                    </button>
                      <button
                        onClick={() => {
                          setScheduleItem(item);
                          // Set default datetime to now + 1 hour for convenience
                          const defaultDate = new Date(Date.now() + 60 * 60 * 1000);
                          // datetime-local expects format YYYY-MM-DDTHH:MM
                          setScheduleDate(defaultDate.toISOString().slice(0,16));
                          setScheduleTimezone('UTC');
                          setScheduleModalOpen(true);
                        }}
                        className="ml-2 p-2 border border-border-color rounded text-text-secondary hover:text-accent-primary hover:border-accent-primary/50 transition-colors"
                        title="Schedule publication"
                      >
                        <CalendarClock size={14} />
                      </button>
                     <button
                       onClick={() => togglePublish(item)}
                       disabled={isPending}
                       className={`inline-flex items-center gap-1.5 px-3 py-2 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                         published
                           ? "border-status-warning/40 text-status-warning hover:bg-status-warning/10"
                           : "border-status-success/40 text-status-success hover:bg-status-success/10"
                       }`}
                     >
                       {published ? <X size={13} /> : <Send size={13} />}
                       {published ? "Unpublish" : "Publish"}
                     </button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 border border-border-color rounded text-text-secondary hover:text-status-error hover:border-status-error/50 transition-colors"
                      title="Delete content"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-tech">
      {notification && (
        <div
          className={`p-4 border rounded flex items-center justify-between text-xs ${
            notification.type === "success"
              ? "bg-status-success/15 border-status-success text-status-success"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-text-secondary hover:text-text-primary uppercase text-[10px] tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {selectedActivity ? renderWorkspace() : renderHub()}

      {scheduleModalOpen && scheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-color pb-3">
              <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                Schedule Publication
              </h3>
              <button onClick={() => setScheduleModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Publication Date &amp; Time (UTC)
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
              />
              <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                Timezone
              </label>
              <input
                type="text"
                value={scheduleTimezone}
                onChange={e => setScheduleTimezone(e.target.value)}
                placeholder="e.g. UTC"
                className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!scheduleItem) return;
                    try {
                      const iso = new Date(scheduleDate).toISOString();
                      await scheduleContentItem(scheduleItem.id, iso, scheduleTimezone || 'UTC');
                      setNotification({ type: 'success', message: `Scheduled “${scheduleItem.title}” for ${new Date(iso).toLocaleString()}.` });
                      setScheduleModalOpen(false);
                      setScheduleItem(null);
                    } catch (e) {
                      setNotification({ type: 'error', message: e instanceof Error ? e.message : 'Failed to schedule.' });
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold rounded hover:opacity-90"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
{activityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-color pb-3">
              <div>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0">
                  Create Activity
                </h3>
                <p className="text-[11px] text-text-secondary m-0 mt-1">
                  Activities are real workspaces backed by Supabase.
                </p>
              </div>
              <button
                onClick={() => setActivityModalOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitActivity} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Activity Type
                </label>
                <select
                  value={activityForm.type}
                  onChange={(event) =>
                    setActivityForm({
                      ...activityForm,
                      type: event.target.value as ActivityType,
                    })
                  }
                  className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none uppercase"
                >
                  {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(
                    (type) => (
                      <option key={type} value={type}>
                        {ACTIVITY_LABELS[type]}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Activity Title
                </label>
                <input
                  required
                  value={activityForm.title}
                  onChange={(event) =>
                    setActivityForm({ ...activityForm, title: event.target.value })
                  }
                  placeholder="e.g. Final Round Problem Statements"
                  className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={activityForm.description}
                  onChange={(event) =>
                    setActivityForm({
                      ...activityForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="What belongs in this activity?"
                  className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border-color pt-3">
                <button
                  type="button"
                  onClick={() => setActivityModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingActivity}
                  className="px-5 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 disabled:opacity-50"
                >
                  {creatingActivity ? "Creating..." : "Create Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editorOpen && selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-4xl my-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-color p-5 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold m-0">
                  {ACTIVITY_LABELS[selectedActivity.type]} ·{" "}
                  {editingItem ? "Edit Content" : "New Content"}
                </p>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0 mt-1">
                  {editingItem ? editingItem.title : "Create Content Draft"}
                </h3>
                {editingItem && (
                  <p className="text-[10px] text-text-secondary font-mono m-0 mt-1">
                    {editingItem.reference_number} · {editingItem.status}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                    Title
                  </label>
                  <input
                    value={itemForm.title}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, title: event.target.value })
                    }
                    placeholder="Content title"
                    className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                    Reference / Code
                  </label>
                  <input
                    value={itemForm.referenceNumber}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        referenceNumber: event.target.value,
                      })
                    }
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                  />
                </div>
              </div>

                {selectedActivity.type === "problem_statements" && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Domain / Track
                    </label>
                    <input
                      value={itemForm.domain}
                      onChange={(event) =>
                        setItemForm({ ...itemForm, domain: event.target.value })
                      }
                      placeholder="e.g. Artificial Intelligence"
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                )}
                {/* New team‑limit field – only relevant for problem statements */}
                {selectedActivity.type === "problem_statements" && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Team Limit (optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemForm.teamLimit}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, teamLimit: e.target.value })
                      }
                      placeholder="Leave empty for unlimited"
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                    <label className="inline-flex items-center mt-2">
                      <input
                        type="checkbox"
                        checked={itemForm.enableSelection}
                        onChange={(e) =>
                          setItemForm({ ...itemForm, enableSelection: e.target.checked })
                        }
                        className="mr-2"
                      />
                      Enable Team Selection
                    </label>
                    <label className="inline-flex items-center mt-2">
                      <input
                        type="checkbox"
                        checked={itemForm.manualLock}
                        onChange={(e) =>
                          setItemForm({ ...itemForm, manualLock: e.target.checked })
                        }
                        className="mr-2"
                      />
                      Manual Lock
                    </label>
                  </div>
                )}


              {selectedActivity.type === "certificates" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Recipient
                    </label>
                    <input
                      value={itemForm.recipient}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          recipient: event.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Team
                    </label>
                    <input
                      value={itemForm.teamName}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          teamName: event.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedActivity.type === "announcements" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Priority
                    </label>
                    <select
                      value={itemForm.priority}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          priority: event.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none uppercase"
                    >
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Audience
                    </label>
                    <select
                      value={itemForm.audience}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          audience: event.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none uppercase"
                    >
                      <option value="all">Everyone</option>
                      <option value="participants">Participants</option>
                      <option value="judges">Judges</option>
                      <option value="staff">Staff / Club Members</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedActivity.type === "resources" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Resource URL
                    </label>
                    <input
                      type="url"
                      value={itemForm.resourceUrl}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          resourceUrl: event.target.value,
                        })
                      }
                      placeholder="https://..."
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                      Category
                    </label>
                    <input
                      value={itemForm.category}
                      onChange={(event) =>
                        setItemForm({
                          ...itemForm,
                          category: event.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-text-secondary mb-1.5">
                  Summary
                </label>
                <textarea
                  rows={2}
                  value={itemForm.summary}
                  onChange={(event) =>
                    setItemForm({ ...itemForm, summary: event.target.value })
                  }
                  placeholder="Short team-facing summary"
                  className="w-full px-3 py-2.5 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-[10px] uppercase tracking-wider text-text-secondary">
                    Content Body
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-accent-tertiary hover:border-accent-tertiary/50 cursor-pointer">
                      {importing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Import size={12} />
                      )}
                      Import Text
                      <input
                        type="file"
                        accept=".txt,.md,.markdown,.csv,.json,.html,.htm"
                        className="hidden"
                        onChange={(event) => {
                          void importTextFile(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {editingItem && (
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-accent-secondary hover:border-accent-secondary/50 cursor-pointer">
                        {uploadingFile ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Upload size={12} />
                        )}
                        Upload Files
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp,.zip"
                          className="hidden"
                          onChange={(event) => {
                            void uploadFiles(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
                <textarea
                  rows={14}
                  value={itemForm.body}
                  onChange={(event) =>
                    setItemForm({ ...itemForm, body: event.target.value })
                  }
                  placeholder="Write or import the content. Markdown headings (#, ##, ###) and bullet lists are supported in preview."
                  className="w-full px-3 py-3 bg-surface-color-light border border-border-color rounded text-xs text-text-primary focus:border-accent-secondary outline-none font-mono leading-relaxed"
                />
                <p className="text-[10px] text-text-secondary mt-1.5">
                  Text import supports TXT, MD, CSV, JSON, and HTML. Save the draft
                  before attaching other documents.
                </p>
              </div>

              {editingItem && (
                <div className="border border-border-color rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold m-0">
                      Attached Files ({editingItem.files.length})
                    </p>
                    <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent-secondary cursor-pointer">
                      {uploadingFile ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      Add file
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp,.zip"
                        className="hidden"
                        onChange={(event) => {
                          void uploadFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {editingItem.files.length === 0 ? (
                    <p className="text-[11px] text-text-secondary m-0">
                      No files attached yet. PDFs, Office documents, images, text,
                      and ZIP archives are supported up to 50MB.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {editingItem.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 border border-border-color/70 rounded px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] text-text-primary m-0 truncate">
                              {file.name}
                            </p>
                            <p className="text-[9px] text-text-secondary font-mono m-0">
                              {formatBytes(file.size)} · {formatDate(file.uploaded_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => downloadFile(file)}
                              className="p-1.5 text-text-secondary hover:text-accent-primary"
                              title="Download"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              onClick={() => removeFile(file)}
                              className="p-1.5 text-text-secondary hover:text-status-error"
                              title="Remove file"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border-color pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {editingItem && (
                    <>
                      <button
                        onClick={() => setPreviewItem(editingItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-accent-primary"
                      >
                        <Eye size={13} /> Preview
                      </button>
                      <button
                        onClick={() => openHistory(editingItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-accent-secondary"
                      >
                        <History size={13} /> History
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      editingItem
                        ? exportItem(editingItem, "markdown")
                        : undefined
                    }
                    disabled={!editingItem}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-status-success disabled:opacity-40"
                  >
                    <FileText size={13} /> Export MD
                  </button>
                  <button
                    onClick={() =>
                      editingItem ? exportItem(editingItem, "json") : undefined
                    }
                    disabled={!editingItem}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-status-success disabled:opacity-40"
                  >
                    <FileJson size={13} /> Export JSON
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setEditorOpen(false)}
                    className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => void saveItem(false)}
                    disabled={savingItem}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-accent-tertiary/40 text-accent-tertiary text-xs uppercase font-bold tracking-wider rounded hover:bg-accent-tertiary/10 disabled:opacity-50"
                  >
                    {savingItem ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Save Draft
                  </button>
                  <button
                    onClick={() => void saveItem(true)}
                    disabled={savingItem}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black text-xs uppercase font-bold tracking-wider rounded hover:opacity-90 disabled:opacity-50"
                  >
                    <Send size={14} />
                    Save &amp; Publish
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-3xl my-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border-color p-5">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-accent-tertiary font-bold m-0">
                  {ACTIVITY_LABELS[previewItem.activity_type]} · Preview
                </p>
                <h3 className="font-heading text-2xl text-text-primary uppercase m-0 mt-1">
                  {previewItem.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={`px-2 py-0.5 border rounded text-[9px] uppercase tracking-wider font-bold ${statusClass(
                      previewItem.status
                    )}`}
                  >
                    {previewItem.status}
                  </span>
                  {previewItem.reference_number && (
                    <span className="text-[10px] text-text-secondary font-mono">
                      {previewItem.reference_number}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {previewItem.summary && (
                <div className="border border-border-color rounded p-3 bg-surface-color-light/50">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary m-0 mb-1">
                    Summary
                  </p>
                  <p className="text-sm text-text-primary m-0">
                    {previewItem.summary}
                  </p>
                </div>
              )}

              <div className="prose-invert max-w-none">
                {previewItem.body ? (
                  renderBody(previewItem.body)
                ) : (
                  <p className="text-sm text-text-secondary">
                    This content item has no body yet.
                  </p>
                )}
              </div>

              {previewItem.files.length > 0 && (
                <div className="border-t border-border-color pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">
                    Attachments
                  </p>
                  <div className="space-y-1.5 mt-2">
                    {previewItem.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-2 text-xs border border-border-color rounded px-2.5 py-2"
                      >
                        <span className="truncate text-text-primary">
                          <Paperclip size={12} className="inline mr-1.5" />
                          {file.name}
                        </span>
                        <span className="text-[10px] text-text-secondary shrink-0">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportItem(previewItem, "markdown")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-status-success"
                >
                  <FileText size={13} /> Export MD
                </button>
                <button
                  onClick={() => exportItem(previewItem, "json")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-status-success"
                >
                  <FileJson size={13} /> Export JSON
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPreviewItem(null);
                    openEditItem(previewItem);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-border-color rounded text-[10px] uppercase tracking-wider text-text-secondary hover:text-accent-tertiary"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => {
                    setPreviewItem(null);
                    togglePublish(previewItem);
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black rounded text-[10px] uppercase font-bold tracking-wider hover:opacity-90 disabled:opacity-50"
                >
                  {previewItem.status === "published" ? (
                    <X size={13} />
                  ) : (
                    <Send size={13} />
                  )}
                  {previewItem.status === "published" ? "Unpublish" : "Publish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historyItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-border-color rounded-lg w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-color p-5">
              <div>
                <p className="text-[10px] uppercase tracking-[2px] text-accent-secondary font-bold m-0">
                  Publication History
                </p>
                <h3 className="font-heading text-lg text-text-primary uppercase m-0 mt-1">
                  {historyItem.title}
                </h3>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-secondary">
                  <Loader2 size={16} className="animate-spin" />
                  Loading history...
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="text-center py-10">
                  <History className="w-8 h-8 text-text-secondary mx-auto mb-2" />
                  <p className="text-xs text-text-secondary m-0">
                    No publication events recorded for this item yet.
                  </p>
                </div>
              ) : (
                historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-border-color rounded p-3 flex items-start gap-3"
                  >
                    <div className="p-1.5 rounded bg-surface-color-light border border-border-color text-accent-tertiary">
                      <CalendarClock size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-primary font-bold uppercase tracking-wider">
                          {entry.action}
                        </span>
                        {entry.previous_status && (
                          <span className="text-[9px] text-text-secondary font-mono">
                            {entry.previous_status} → {entry.new_status}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-secondary m-0 mt-1">
                        {entry.performed_by_name} · {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border-color p-4 flex justify-end">
              <button
                onClick={() => setHistoryItem(null)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-surface-color border border-status-error/40 rounded-lg w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="font-heading text-lg text-status-error uppercase m-0">
              Delete Content
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed m-0">
              Delete{" "}
              <span className="text-text-primary font-bold">
                {deleteTarget.title}
              </span>
              ? Attached files will be removed from storage. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-border-color text-text-secondary text-xs uppercase font-bold rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="px-4 py-2 bg-status-error text-white text-xs uppercase font-bold rounded hover:bg-status-error/90 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

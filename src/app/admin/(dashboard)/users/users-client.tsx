"use client";

import React, { useState, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Gavel,
  Crown,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  LucideIcon,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Download,
  Upload,
  FileSpreadsheet,
  Edit2,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  UserProfileItem,
  AllowedUserRole,
  updateUserRole,
  createUser,
  deleteUser,
  TeamHierarchyItem,
  // seedMockDataServerAction,
  bulkImportUsers,
  BulkImportUserRecord,
} from "@/app/actions/admin-users";

interface UsersClientProps {
  initialUsers: UserProfileItem[];
  initialTeamsHierarchy?: TeamHierarchyItem[];
  currentUserEmail?: string;
  currentUserId?: string;
}

const roleBadges: Record<
  AllowedUserRole,
  { label: string; badgeClass: string; icon: LucideIcon }
> = {
  admin: {
    label: "Admin",
    badgeClass: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/40",
    icon: ShieldCheck,
  },
  judge: {
    label: "Judge",
    badgeClass: "bg-accent-tertiary/15 text-accent-tertiary border-accent-tertiary/40",
    icon: Gavel,
  },
  spoc: {
    label: "SPOC / Staff",
    badgeClass: "bg-status-success/15 text-status-success border-status-success/40",
    icon: Shield,
  },
   staff: {
    label: "Staff / Club",
    badgeClass: "bg-status-success/15 text-status-success border-status-success/40",
    icon: Shield,
  },
    leader: {
        label: "Team Leader",
        badgeClass: "bg-accent-primary/15 text-accent-primary border-accent-primary/40",
        icon: Crown,
    },
  participant: {
    label: "Participant",
    badgeClass: "bg-surface-color-light text-text-secondary border-border-color",
    icon: Users,
  },
};

const filterTabs = [
  { id: "all", label: "All Users" },
  { id: "teams", label: "Teams & Members" },
  { id: "participant", label: "Participants" },
  { id: "leader", label: "Team Leaders" },
  { id: "judge", label: "Judges" },
  { id: "staff", label: "Staff & Club" },
  { id: "admin", label: "Admins" },
];

export default function UsersClientView({
  initialUsers,
  initialTeamsHierarchy = [],
  currentUserId,
}: UsersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role") || "all";

  const [activeTab, setActiveTab] = useState<string>(initialRoleParam);
  const [searchQuery, setSearchQuery] = useState("");
  const [usersList, setUsersList] = useState<UserProfileItem[]>(initialUsers);
  const [teamsHierarchy, setTeamsHierarchy] = useState<TeamHierarchyItem[]>(initialTeamsHierarchy);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  // Toggle tree expansion
  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: prev[teamId] === undefined ? false : !prev[teamId], // default expanded unless toggled
    }));
  };

  const isTeamExpanded = (teamId: string) => {
    return expandedTeams[teamId] !== false; // expanded by default
  };

  React.useEffect(() => {
    setTeamsHierarchy(initialTeamsHierarchy);
  }, [initialTeamsHierarchy]);

  React.useEffect(() => {
    const roleParam = searchParams.get("role") || "all";
    setActiveTab(roleParam);
  }, [searchParams]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfileItem | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAddModalOpen(false);
        setUserToDelete(null);
        setIsImportModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Notifications
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // New User Form State
   const [newUserData, setNewUserData] = useState({
     fullName: "",
     username: "",
     email: "",
     password: "",
     role: "participant" as AllowedUserRole,
   });
  const [formLoading, setFormLoading] = useState(false);

  // Import / Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<BulkImportUserRecord[]>([]);
  const [selectedRecordIndexes, setSelectedRecordIndexes] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRowData, setEditRowData] = useState<BulkImportUserRecord | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Toggle selection for single record
  const handleToggleRecordSelect = (index: number) => {
    setSelectedRecordIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Select all or deselect all records
  const handleToggleSelectAllRecords = () => {
    if (selectedRecordIndexes.size === importPreview.length) {
      setSelectedRecordIndexes(new Set());
    } else {
      setSelectedRecordIndexes(new Set(importPreview.map((_, idx) => idx)));
    }
  };

  // Start editing a record
  const handleStartEditRecord = (index: number) => {
    setEditingIndex(index);
    setEditRowData({ ...importPreview[index] });
  };

  // Save edited record back to staging preview
  const handleSaveEditRecord = () => {
    if (editingIndex === null || !editRowData) return;
    setImportPreview((prev) =>
      prev.map((r, idx) => (idx === editingIndex ? { ...editRowData } : r))
    );
    setEditingIndex(null);
    setEditRowData(null);
  };

  // Remove a record from import
  const handleRemoveRecord = (index: number) => {
    setImportPreview((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedRecordIndexes((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditRowData(null);
    }
  };

  // Export Users as CSV
  const handleExportCSV = () => {
    try {
      const headers = ["Full Name", "Username", "Email", "Role", "Team Name", "Team Role", "Created At"];
      const rows = usersList.map((u) => [
        `"${(u.full_name || "").replace(/"/g, '""')}"`,
        `"${(u.username || (u.email ? u.email.split("@")[0] : "")).replace(/"/g, '""')}"`,
        `"${(u.email || "").replace(/"/g, '""')}"`,
        `"${u.role || ""}"`,
        `"${(u.team_name || "").replace(/"/g, '""')}"`,
        `"${(u.team_role || "").replace(/"/g, '""')}"`,
        `"${u.created_at || ""}"`,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ivc_pulse_users_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setNotification({
        type: "success",
        message: `Successfully exported ${usersList.length} users to CSV. You can also import this into Google Sheets.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to export CSV.",
      });
    }
  };

  // Download Sample CSV Template
   const handleDownloadSampleTemplate = () => {
     const headers = ["Full Name", "Email", "Username", "Role", "Password", "Team Name", "Team Code", "Track"];
     const sampleRows = [




      ['"Dr. Rajesh Sharma"', '"judge.rajesh@ivc.pulse"', '', '"judge"', '"123"', '""', '""', '""'],
      ['"Ananya Rao"', '"lead.team21@ivc.pulse"', '', '"leader"', '"123"', '"Team CyberViper"', '"CV-21"', '"Artificial Intelligence"'],
      ['"Rohan Verma"', '"member1.team21@ivc.pulse"', '', '"participant"', '"123"', '"Team CyberViper"', '"CV-21"', '"Artificial Intelligence"'],
      ['"Kavita Patil"', '"spoc.kavita@ivc.pulse"', '', '"staff"', '"123"', '""', '""', '""'],
     ];


    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...sampleRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ivc_pulse_users_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Uploaded CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Split by lines
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setImportError("CSV file must have a header row and at least one data row.");
          return;
        }

        // Parse header
        const rawHeaders = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());
        
        // Find column indices
         const nameIdx = rawHeaders.findIndex((h) => h.includes("name"));
         const emailIdx = rawHeaders.findIndex((h) => h.includes("email"));
         const usernameIdx = rawHeaders.findIndex((h) => h.includes("username"));
         const roleIdx = rawHeaders.findIndex((h) => h.includes("role"));
         const passIdx = rawHeaders.findIndex((h) => h.includes("pass"));
         const teamNameIdx = rawHeaders.findIndex((h) => h.includes("team") && !h.includes("code") && !h.includes("role"));
         const teamCodeIdx = rawHeaders.findIndex((h) => h.includes("code"));
         const trackIdx = rawHeaders.findIndex((h) => h.includes("track"));
 
         if (emailIdx === -1 && usernameIdx === -1) {
           setImportError("CSV header must contain an 'Email' or 'Username' column.");
           return;
         }

        // Helper regex to split CSV respecting quotes
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              result.push(current.trim().replace(/^["']|["']$/g, ""));
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim().replace(/^["']|["']$/g, ""));
          return result;
        };

         const records: BulkImportUserRecord[] = [];
         for (let i = 1; i < lines.length; i++) {
           const cols = parseCSVLine(lines[i]);


          const rawEmail = emailIdx !== -1 ? cols[emailIdx]?.trim() : undefined;
          const rawUsername = usernameIdx !== -1 ? cols[usernameIdx]?.trim() : undefined;
          const loginEmail = rawEmail
            ? rawEmail.toLowerCase()
            : rawUsername
            ? (rawUsername.includes("@") ? rawUsername.toLowerCase() : `${rawUsername.toLowerCase()}@ivc.pulse`)
            : undefined;
          const fullName = nameIdx !== -1 ? cols[nameIdx]?.trim() : loginEmail?.split("@")[0];
           let roleRaw = (roleIdx !== -1 ? cols[roleIdx]?.trim().toLowerCase() : "participant") as AllowedUserRole;
            
           // Fencing: nobody can be assigned as admin through CSV import
           if (roleRaw === "admin" || !["judge", "staff", "participant", "leader"].includes(roleRaw)) {
             roleRaw = "participant";
           }
 


          if (loginEmail) {
            records.push({
              email: loginEmail,
              full_name: fullName || loginEmail.split("@")[0],
              role: roleRaw,
              password: passIdx !== -1 && cols[passIdx] ? cols[passIdx] : undefined,
              team_name: teamNameIdx !== -1 ? cols[teamNameIdx] : undefined,
              team_code: teamCodeIdx !== -1 ? cols[teamCodeIdx] : undefined,
              track: trackIdx !== -1 ? cols[trackIdx] : undefined,
              username: rawUsername,
            });
          }
         }


        if (records.length === 0) {
          setImportError("No valid rows found in the CSV.");
          return;
        }

        setImportPreview(records);
        // By default check all verified records
        setSelectedRecordIndexes(new Set(records.map((_, idx) => idx)));
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
  };

  // Submit Verified Bulk Import
  const handleRunBulkImport = async () => {
    // Only import records checked/selected by user
    const recordsToImport = importPreview.filter((_, idx) => selectedRecordIndexes.has(idx));

    if (recordsToImport.length === 0) {
      setImportError("Please select at least one record with the checkbox to import.");
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const res = await bulkImportUsers(recordsToImport);
      setNotification({
        type: "success",
        message: `Verified Import Completed! Processed ${res.total} users (${res.created} created, ${res.updated} updated, ${res.errors.length} skipped).`,
      });
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportPreview([]);
      setSelectedRecordIndexes(new Set());
      setEditingIndex(null);
      setEditRowData(null);
      router.refresh();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Failed to import users.");
    } finally {
      setImportLoading(false);
    }
  };

  // Sync users list if parent re-renders with fresh data
  React.useEffect(() => {
    setUsersList(initialUsers);
  }, [initialUsers]);

  // Handle Tab Switch & URL parameter sync
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "all") {
      router.replace("/admin/users", { scroll: false });
    } else {
      router.replace(`/admin/users?role=${encodeURIComponent(tabId)}`, { scroll: false });
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      // Role filter
      if (activeTab !== "all") {
        if (u.role !== activeTab) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const nameMatch = u.full_name?.toLowerCase().includes(query);
        const emailMatch = u.email?.toLowerCase().includes(query);
        const teamMatch = u.team_name?.toLowerCase().includes(query);
        const usernameMatch =
          u.username?.toLowerCase().includes(query) ||
          u.email?.split("@")[0]?.toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !teamMatch && !usernameMatch) return false;
      }

      return true;
    });
  }, [usersList, activeTab, searchQuery]);

  // Filtered Teams List
  const filteredTeams = useMemo(() => {
    if (activeTab !== "teams") return [];
    if (!searchQuery.trim()) return teamsHierarchy;
    const q = searchQuery.toLowerCase();
    return teamsHierarchy.filter((t) => {
      const matchName = t.name.toLowerCase().includes(q);
      const matchCode = t.code?.toLowerCase().includes(q);
      const matchTrack = t.track?.toLowerCase().includes(q);
      const matchLeader =
        t.leader?.full_name?.toLowerCase().includes(q) ||
        t.leader?.name?.toLowerCase().includes(q) ||
        t.leader?.email?.toLowerCase().includes(q) ||
        t.leader_name?.toLowerCase().includes(q);
      const matchMember = t.members.some(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      );
      return matchName || matchCode || matchTrack || matchLeader || matchMember;
    });
  }, [teamsHierarchy, activeTab, searchQuery]);

  // Role Update Handler
  const handleRoleChange = async (userId: string, newRole: AllowedUserRole) => {
    setNotification(null);
    startTransition(async () => {
      try {
        const res = await updateUserRole({ userId, newRole });
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        setNotification({ type: "success", message: res.message });
        router.refresh();
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to update user role",
        });
      }
    });
  };

  // Create User Handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setNotification(null);

    try {
       const emailProvided = newUserData.email.trim();
       const loginEmail = emailProvided
         ? emailProvided
         : (() => {
             const trimmedUsername = newUserData.username.trim();
             return trimmedUsername.includes("@")
               ? trimmedUsername
               : `${trimmedUsername}@ivc.pulse`;
           })();
       await createUser({
         email: loginEmail,
         password: newUserData.password,
         fullName: newUserData.fullName,
         role: newUserData.role,
         username: newUserData.username.trim(),
       });
       setNotification({
         type: "success",
         message: `Account created for ${loginEmail} with role ${newUserData.role}`,
       });
       setIsAddModalOpen(false);
       setNewUserData({
         fullName: "",
         username: "",
         email: "",
         password: "",
         role: "participant",
       });
       router.refresh();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create user account.",
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Delete User Handler
  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setNotification(null);
    const target = userToDelete;
    setUserToDelete(null);

    startTransition(async () => {
      try {
        await deleteUser(target.id);
        setUsersList((prev) => prev.filter((u) => u.id !== target.id));
        setNotification({
          type: "success",
          message: `User ${target.email || target.full_name} deleted successfully.`,
        });
        router.refresh();
      } catch (err: unknown) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to delete user account.",
        });
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in font-tech">
      {/* Top Banner with Add User Button */}
      <div className="border-b border-border-color pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />
            <p className="font-tech text-xs uppercase tracking-[3px] text-accent-secondary font-bold m-0">
              Administration // Access Control
            </p>
          </div>
          <h1 className="text-3xl md:text-5xl font-heading text-text-primary tracking-wider uppercase m-0 flex items-center gap-3">
            <Users className="w-8 h-8 md:w-10 md:h-10 text-accent-secondary" />
            User Management
          </h1>
          <p className="font-tech text-text-secondary text-sm mt-2 max-w-2xl m-0">
            Directory of registered participants, team leaders, judges, and administrative staff. Provision new users or adjust permission tiers with full audit trail logging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Export CSV / Sheets */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-color border border-border-color hover:border-accent-primary text-text-primary font-tech font-bold uppercase tracking-wider text-xs transition-all hover:bg-surface-color-light cursor-pointer"
            title="Export all current user profiles, roles, and teams to CSV / Google Sheets"
          >
            <Download size={14} className="text-accent-primary" />
            <span>Export CSV / Sheets</span>
          </button>

          {/* Import CSV / Sheets */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-surface-color border border-accent-tertiary/50 hover:border-accent-tertiary text-accent-tertiary font-tech font-bold uppercase tracking-wider text-xs transition-all hover:bg-accent-tertiary/10 cursor-pointer"
            title="Import users and team affiliations from CSV file or Google Sheets export"
          >
            <Upload size={14} />
            <span>Import CSV</span>
          </button>

          {/* Add Single User */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-bold uppercase tracking-wider text-xs transition-all hover:opacity-90 shadow-[0_0_20px_rgba(255,0,127,0.3)] cursor-pointer"
          >
            <UserPlus size={15} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 border flex items-center justify-between text-xs transition-all animate-fade-in ${
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
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Role Tabs */}
        <div className="flex flex-wrap gap-1 bg-surface-color p-1 border border-border-color">
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? "bg-accent-secondary text-black shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-color-light"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-3 text-text-secondary" />
          <input
            type="text"
            placeholder="Search by name, email or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-color border border-border-color py-2 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-secondary outline-none focus:border-accent-secondary transition-colors font-sans tracking-normal"
          />
        </div>
      </div>

      {/* View Content: Either Teams Hierarchy or Users Data Table */}
      {activeTab === "teams" ? (
        <div className="space-y-4">
          {filteredTeams.length === 0 ? (
            <div className="glass-panel p-12 text-center border border-border-color">
              <Users className="w-10 h-10 text-text-secondary mx-auto mb-3 opacity-40" />
              <p className="text-text-secondary font-tech text-sm uppercase tracking-wider m-0">
                No teams found matching search criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredTeams.map((team) => {
                const expanded = isTeamExpanded(team.id);
                return (
                  <div
                    key={team.id}
                    className="glass-panel p-0 border border-border-color hover:border-accent-secondary/50 transition-all rounded bg-surface-color/40 overflow-hidden"
                  >
                    {/* Expandable Team Top Header */}
                    <div
                      onClick={() => toggleTeamExpand(team.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-surface-color-light/30 hover:bg-surface-color-light/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-surface-color text-text-secondary hover:text-text-primary transition-colors"
                          aria-label={expanded ? "Collapse team" : "Expand team"}
                        >
                          {expanded ? (
                            <ChevronDown size={18} className="text-accent-secondary" />
                          ) : (
                            <ChevronRight size={18} className="text-text-secondary" />
                          )}
                        </button>

                        <div className="w-9 h-9 rounded bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center font-heading text-accent-primary font-bold">
                          {team.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-base text-text-primary tracking-wide m-0">
                              {team.name}
                            </h3>
                            <span className="font-mono text-xs px-2 py-0.5 bg-surface-color border border-border-color text-accent-secondary uppercase font-bold">
                              #{team.code}
                            </span>
                          </div>
                          {team.track && (
                            <p className="font-tech text-xs text-text-secondary uppercase tracking-wider m-0 mt-0.5">
                              Track: <span className="text-accent-primary">{team.track}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {team.leader && (
                          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-tech">
                            <Crown size={12} />
                            <span>Leader: {team.leader.full_name || team.leader.name || team.leader.email}</span>
                          </div>
                        )}
                        <span className="font-tech text-xs uppercase px-2.5 py-1 bg-surface-color-light border border-border-color text-text-secondary">
                          Roster: <strong className="text-text-primary">{team.totalMembersCount}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Expandable Body: Leader & Members Tree */}
                    {expanded && (
                      <div className="p-5 border-t border-border-color/60 space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          {/* Team Leader Box */}
                          <div className="lg:col-span-5 bg-accent-primary/5 border border-accent-primary/30 rounded p-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-accent-primary text-black font-tech font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                              <Crown size={12} />
                              Team Leader
                            </div>

                            <p className="font-tech text-[10px] text-accent-primary uppercase tracking-widest font-bold mb-3 m-0">
                              Designated Leader
                            </p>

                            {team.leader ? (
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center font-heading text-accent-primary font-bold text-sm shrink-0">
                                  {(team.leader.full_name || team.leader.name || "L").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-heading text-sm text-text-primary truncate m-0 font-bold">
                                    {team.leader.full_name || team.leader.name || team.leader_name || "Team Leader"}
                                  </h4>
                                  <p className="text-xs text-text-secondary truncate m-0 flex items-center gap-1.5 mt-0.5">
                                    <Mail size={12} className="text-accent-primary/70 shrink-0" />
                                    <span className="truncate">{team.leader.email || "No email"}</span>
                                  </p>
                                  <span className="inline-block mt-2 font-mono text-[10px] px-2 py-0.5 bg-accent-primary/20 text-accent-primary border border-accent-primary/30 uppercase">
                                    Primary Contact
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-text-secondary italic py-2">
                                {team.leader_name ? (
                                  <div>
                                    <p className="text-text-primary font-bold m-0">{team.leader_name}</p>
                                    <span className="text-[11px] text-text-secondary">(Leader profile not yet registered)</span>
                                  </div>
                                ) : (
                                  "No designated leader assigned"
                                )}
                              </div>
                            )}
                          </div>

                          {/* Team Members Box */}
                          <div className="lg:col-span-7 bg-surface-color/60 border border-border-color rounded p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-tech text-[10px] text-text-secondary uppercase tracking-widest font-bold m-0 flex items-center gap-1.5">
                                <Users size={12} className="text-accent-secondary" />
                                Team Members ({team.members.length})
                              </p>
                            </div>

                            {team.members.length === 0 ? (
                              <div className="text-xs text-text-secondary italic py-2">
                                No additional team members enrolled yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {team.members.map((member) => (
                                  <div
                                    key={member.id}
                                    className="p-2.5 bg-surface-color-light/40 border border-border-color/80 rounded flex items-center gap-2.5 hover:border-accent-secondary/40 transition-colors"
                                  >
                                    <div className="w-7 h-7 rounded bg-surface-color border border-border-color flex items-center justify-center font-heading text-xs text-text-secondary shrink-0 uppercase">
                                      {(member.full_name || member.name || "M").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs text-text-primary truncate m-0">
                                        {member.full_name || member.name || "Member"}
                                      </p>
                                      <p className="text-[11px] text-text-secondary truncate m-0">
                                        {member.email || "No email"}
                                      </p>
                                    </div>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-surface-color border border-border-color text-text-secondary uppercase shrink-0">
                                      Member
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Users Data Table */
        <div className="glass-panel p-0 overflow-hidden border border-border-color">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-color bg-surface-color-light/50 text-[11px] text-accent-primary uppercase tracking-wider font-bold">
                <th className="p-4">User</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Team Association</th>
                <th className="p-4">Enrolled At</th>
                <th className="p-4 text-right">Actions & Role Elevation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color/60 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-secondary">
                    <p className="m-0 text-sm">No users found matching the filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleConfig = roleBadges[user.role] || roleBadges.participant;
                  const Icon = roleConfig.icon;
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      {/* Name, Username & Email */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-surface-color-light border border-border-color flex items-center justify-center font-heading font-bold text-accent-primary uppercase">
                            {user.full_name ? user.full_name.charAt(0) : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-text-primary flex items-center gap-2 flex-wrap">
                              <span>{user.full_name || "Unnamed User"}</span>
                              {(user.username || (user.email ? user.email.split("@")[0] : null)) && (
                                <span className="text-[11px] font-mono text-accent-tertiary bg-accent-tertiary/10 border border-accent-tertiary/30 px-1.5 py-0.5 rounded font-normal">
                                  @{user.username || user.email?.split("@")[0]}
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-text-secondary text-[11px] font-mono mt-0.5">
                              {user.email || "No email available"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Current Role Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border ${roleConfig.badgeClass}`}
                        >
                          <Icon size={12} />
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>

                      {/* Team Association */}
                      <td className="p-4 text-text-secondary">
                        {user.team_name ? (
                          <div>
                            <span className="text-text-primary font-semibold">
                              {user.team_name}
                            </span>
                            {user.team_role && (
                              <span className="text-[10px] text-accent-primary block uppercase">
                                ({user.team_role})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="opacity-60 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="p-4 text-text-secondary text-[11px]">
                        {new Date(user.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions: Role Selector Dropdown & Delete Button */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Role Select Dropdown */}
                          <select
                            disabled={isPending || isSelf}
                            value={user.role}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value as AllowedUserRole)
                            }
                            className="bg-surface-color border border-border-color hover:border-accent-primary py-1 px-2 text-[11px] font-tech text-text-primary uppercase tracking-wider outline-none focus:border-accent-secondary disabled:opacity-40 cursor-pointer"
                            title={isSelf ? "You cannot modify your own role" : "Elevate or alter role"}
                          >
                            <option value="participant">Participant</option>
                            <option value="leader">Team Leader</option>
                            <option value="judge">Judge</option>
                            <option value="staff">Staff / Club Member</option>
                            <option value="admin">Admin</option>
                          </select>

                          {/* Delete Button */}
                          <button
                            disabled={isPending || isSelf}
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 bg-status-error/10 border border-status-error/30 text-status-error hover:bg-status-error hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                            title={isSelf ? "Cannot delete your own account" : "Delete user"}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ADD USER MODAL */}
      {isAddModalOpen && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div className="glass-panel w-full max-w-md my-auto p-6 border border-accent-secondary/60 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-accent-secondary" />
                <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider m-0">
                  Provision New Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs uppercase text-text-secondary font-bold">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-2.5 text-text-secondary" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Mercer"
                    value={newUserData.fullName}
                    onChange={(e) =>
                      setNewUserData((p) => ({ ...p, fullName: e.target.value }))
                    }
                    className="w-full bg-surface-color border border-border-color py-2 pl-9 pr-3 text-xs text-text-primary focus:border-accent-secondary outline-none font-sans tracking-normal"
                  />
                </div>
              </div>

               <div className="space-y-1">
                 <label className="block text-xs uppercase text-text-secondary font-bold">
                   Username
                 </label>
                 <div className="relative">
                   <User size={15} className="absolute left-3 top-2.5 text-text-secondary" />
                   <input
                     type="text"
                     required
                     placeholder="e.g. alex"
                     value={newUserData.username}
                     onChange={(e) =>
                       setNewUserData((p) => ({ ...p, username: e.target.value }))
                     }
                     className="w-full bg-surface-color border border-border-color py-2 pl-9 pr-3 text-xs text-text-primary focus:border-accent-secondary outline-none font-sans tracking-normal"
                   />
                 </div>
               </div>

               <div className="space-y-1">
                 <label className="block text-xs uppercase text-text-secondary font-bold">
                   Email Address
                 </label>
                 <div className="relative">
                   <Mail size={15} className="absolute left-3 top-2.5 text-text-secondary" />
                   <input
                     type="email"
                     required
                     placeholder="e.g. alex@ivc.pulse"
                     value={newUserData.email}
                     onChange={(e) =>
                       setNewUserData((p) => ({ ...p, email: e.target.value }))
                     }
                     className="w-full bg-surface-color border border-border-color py-2 pl-9 pr-3 text-xs text-text-primary focus:border-accent-secondary outline-none font-sans tracking-normal"
                   />
                 </div>
               </div>

              <div className="space-y-1">
                <label className="block text-xs uppercase text-text-secondary font-bold">
                  Temporary Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-2.5 text-text-secondary" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters..."
                    value={newUserData.password}
                    onChange={(e) =>
                      setNewUserData((p) => ({ ...p, password: e.target.value }))
                    }
                    className="w-full bg-surface-color border border-border-color py-2 pl-9 pr-3 text-xs text-text-primary focus:border-accent-secondary outline-none font-sans tracking-normal"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs uppercase text-text-secondary font-bold">
                  Initial Role Assignment
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) =>
                    setNewUserData((p) => ({
                      ...p,
                      role: e.target.value as AllowedUserRole,
                    }))
                  }
                  className="w-full bg-surface-color border border-border-color py-2 px-3 text-xs text-text-primary focus:border-accent-secondary outline-none uppercase font-bold"
                >
                  <option value="participant">Participant</option>
                  <option value="leader">Team Leader</option>
                  <option value="judge">Judge</option>
                  <option value="staff">Staff / Club Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {formLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>{formLoading ? "Creating..." : "Provision User"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserToDelete(null);
          }}
        >
          <div className="glass-panel max-w-sm w-full my-auto p-6 border border-status-error/60 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-status-error">
              <div className="p-2 rounded bg-status-error/15 border border-status-error/40">
                <Trash2 size={20} />
              </div>
              <h3 className="font-heading text-lg uppercase tracking-wider m-0">
                Confirm Deletion
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed m-0">
              Are you sure you want to permanently delete{" "}
              <strong className="text-text-primary">
                {userToDelete.email || userToDelete.full_name}
              </strong>
              ? This removes their authentication credentials and all profile records.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase font-bold tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-status-error text-white font-bold uppercase tracking-wider text-xs hover:bg-status-error/90 transition-all cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* IMPORT CSV / GOOGLE SHEETS MODAL */}
      {isImportModalOpen && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in font-tech overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsImportModalOpen(false);
              setImportFile(null);
              setImportPreview([]);
              setSelectedRecordIndexes(new Set());
              setEditingIndex(null);
              setEditRowData(null);
              setImportError(null);
            }
          }}
        >
          <div className="glass-panel max-w-xl w-full my-auto p-6 border border-accent-tertiary/60 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-accent-tertiary/15 border border-accent-tertiary/40">
                  <FileSpreadsheet className="w-5 h-5 text-accent-tertiary" />
                </div>
                <div>
                  <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider m-0">
                    Import Users via CSV / Sheets
                  </h3>
                  <p className="text-[11px] text-text-secondary m-0">
                    Bulk provision judges, participants, team leaders, or staff from a spreadsheet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportPreview([]);
                  setImportError(null);
                }}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template & Guidelines */}
            <div className="bg-surface-color/60 border border-border-color p-3.5 rounded space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent-secondary" />
                  Format Requirements
                </span>
                <button
                  onClick={handleDownloadSampleTemplate}
                  className="inline-flex items-center gap-1 text-[11px] text-accent-primary hover:underline font-mono font-bold cursor-pointer"
                >
                  <Download size={12} />
                  Download Sample Template (.CSV)
                </button>
              </div>
                 <p className="text-text-secondary text-[11px] leading-relaxed m-0">
                 Columns supported: <code className="text-accent-tertiary font-mono">Full Name</code>, <code className="text-accent-tertiary font-mono">Email</code>, <code className="text-accent-tertiary font-mono">Username</code>, <code className="text-accent-tertiary font-mono">Role</code> (judge / leader / participant / staff / admin), <code className="text-accent-tertiary font-mono">Password</code> (optional, defaults to 123), <code className="text-accent-tertiary font-mono">Team Name</code>, <code className="text-accent-tertiary font-mono">Team Code</code>, <code className="text-accent-tertiary font-mono">Track</code>.
                 </p>
              <p className="text-[10px] text-text-secondary/70 m-0">
                Tip: In Google Sheets, click <em>File → Download → Comma Separated Values (.csv)</em> and upload it below.
              </p>
            </div>

            {/* File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border-color hover:border-accent-tertiary p-6 rounded text-center cursor-pointer bg-surface-color/30 hover:bg-surface-color transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-accent-tertiary mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-text-primary uppercase tracking-wider m-0">
                {importFile ? importFile.name : "Click to select or drop CSV file here"}
              </p>
              <p className="text-[10px] font-mono text-text-secondary mt-1 m-0">
                {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : "Supports UTF-8 CSV exports from Excel or Google Sheets"}
              </p>
            </div>

            {/* Error banner */}
            {importError && (
              <div className="p-3 bg-status-error/15 border border-status-error/40 text-status-error rounded text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{importError}</span>
              </div>
            )}

            {/* Verification & Edit Table */}
            {importPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-surface-color/70 border border-border-color rounded text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllRecords}
                      className="flex items-center gap-1.5 text-accent-tertiary hover:text-text-primary font-bold cursor-pointer"
                    >
                      {selectedRecordIndexes.size === importPreview.length ? (
                        <CheckSquare size={16} className="text-accent-tertiary" />
                      ) : (
                        <Square size={16} />
                      )}
                      <span>
                        {selectedRecordIndexes.size === importPreview.length
                          ? "Deselect All"
                          : `Select All (${importPreview.length})`}
                      </span>
                    </button>
                    <span className="text-text-secondary">•</span>
                    <span className="text-text-secondary font-mono">
                      {selectedRecordIndexes.size} of {importPreview.length} verified for import
                    </span>
                  </div>

                  <span className="text-[10px] text-accent-primary font-mono bg-accent-primary/10 border border-accent-primary/30 px-2 py-0.5 rounded">
                    🛡️ Admin role assignment locked
                  </span>
                </div>

                {/* Interactive Verification Checklist Table */}
                <div className="border border-border-color rounded max-h-64 overflow-y-auto bg-surface-color/40">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-surface-color-light text-text-secondary sticky top-0 border-b border-border-color z-10">
                      <tr>
                        <th className="p-2 w-8 text-center">Verify</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Team</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/40">
                      {importPreview.map((row, idx) => {
                        const isSelected = selectedRecordIndexes.has(idx);
                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              isSelected
                                ? "bg-accent-tertiary/[0.04] hover:bg-accent-tertiary/[0.08]"
                                : "opacity-45 hover:opacity-75"
                            }`}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRecordSelect(idx)}
                                className="accent-accent-tertiary cursor-pointer w-4 h-4"
                              />
                            </td>
                            <td className="p-2 text-text-primary font-bold">{row.full_name}</td>
                            <td className="p-2 text-text-secondary">{row.email}</td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                                  row.role === "judge"
                                    ? "bg-accent-tertiary/20 text-accent-tertiary border border-accent-tertiary/40"
                                    : row.role === "leader"
                                    ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/40"
                                    : row.role === "staff"
                                    ? "bg-status-success/20 text-status-success border border-status-success/40"
                                    : "bg-surface-color border border-border-color text-text-secondary"
                                }`}
                              >
                                {row.role}
                              </span>
                            </td>
                            <td className="p-2 text-text-secondary truncate max-w-[130px]">
                              {row.team_name ? (
                                <span>
                                  {row.team_name} {row.track ? `[${row.track}]` : ""}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditRecord(idx)}
                                  className="p-1 text-accent-tertiary hover:text-white hover:bg-accent-tertiary/20 rounded transition-colors"
                                  title="Edit details before importing"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecord(idx)}
                                  className="p-1 text-status-error/80 hover:text-status-error hover:bg-status-error/20 rounded transition-colors"
                                  title="Remove from import"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EDIT SINGLE RECORD SUB-MODAL */}
            {editingIndex !== null && editRowData && (
              <div className="p-4 bg-surface-color border-2 border-accent-tertiary rounded space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-border-color pb-2">
                  <span className="font-bold text-text-primary uppercase flex items-center gap-1.5">
                    <Edit2 size={13} className="text-accent-tertiary" />
                    Edit Row #{editingIndex + 1} Details
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(null);
                      setEditRowData(null);
                    }}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-bold block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editRowData.full_name}
                      onChange={(e) =>
                        setEditRowData({ ...editRowData, full_name: e.target.value })
                      }
                      className="w-full bg-surface-color-light border border-border-color p-2 rounded text-xs text-text-primary outline-none focus:border-accent-tertiary font-mono"
                    />
                  </div>

                   <div>
                     <label className="text-[10px] text-text-secondary uppercase font-bold block mb-1">
                       Email Address
                     </label>
                     <input
                       type="email"
                       value={editRowData.email}
                       onChange={(e) =>
                         setEditRowData({ ...editRowData, email: e.target.value })
                       }
                       className="w-full bg-surface-color-light border border-border-color p-2 rounded text-xs text-text-primary outline-none focus:border-accent-tertiary font-mono"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] text-text-secondary uppercase font-bold block mb-1">
                       Username (optional)
                     </label>
                     <input
                       type="text"
                       value={editRowData.username || ""}
                       onChange={(e) =>
                         setEditRowData({ ...editRowData, username: e.target.value })
                       }
                       className="w-full bg-surface-color-light border border-border-color p-2 rounded text-xs text-text-primary outline-none focus:border-accent-tertiary font-mono"
                     />
                   </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-bold block mb-1">
                      Assigned Role (Admin Locked)
                    </label>
                    <select
                      value={editRowData.role}
                      onChange={(e) =>
                        setEditRowData({
                          ...editRowData,
                          role: e.target.value as AllowedUserRole,
                        })
                      }
                      className="w-full bg-surface-color-light border border-border-color p-2 rounded text-xs text-text-primary outline-none focus:border-accent-tertiary font-mono uppercase"
                    >
                      <option value="participant">Participant</option>
                      <option value="leader">Team Leader</option>
                      <option value="judge">Judge</option>
                      <option value="staff">Staff / Club Member</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-secondary uppercase font-bold block mb-1">
                      Team Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={editRowData.team_name || ""}
                      onChange={(e) =>
                        setEditRowData({ ...editRowData, team_name: e.target.value })
                      }
                      placeholder="e.g. Team Hyperion"
                      className="w-full bg-surface-color-light border border-border-color p-2 rounded text-xs text-text-primary outline-none focus:border-accent-tertiary font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(null);
                      setEditRowData(null);
                    }}
                    className="px-3 py-1.5 border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditRecord}
                    className="px-4 py-1.5 bg-accent-tertiary text-black font-bold text-xs uppercase hover:bg-accent-tertiary/90 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-border-color flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary font-mono">
                {selectedRecordIndexes.size > 0
                  ? `Ready to import ${selectedRecordIndexes.size} verified record(s).`
                  : "Check the boxes above to confirm records for import."}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportPreview([]);
                    setSelectedRecordIndexes(new Set());
                    setEditingIndex(null);
                    setEditRowData(null);
                    setImportError(null);
                  }}
                  className="px-4 py-2 border border-border-color text-text-secondary hover:text-text-primary text-xs uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importLoading || selectedRecordIndexes.size === 0}
                  onClick={handleRunBulkImport}
                  className="px-5 py-2 bg-gradient-to-r from-accent-tertiary to-accent-primary text-black font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {importLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>
                    {importLoading
                      ? "Importing Records..."
                      : `Import Verified (${selectedRecordIndexes.size})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

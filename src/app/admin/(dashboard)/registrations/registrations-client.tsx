"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  Check,
  QrCode,
  ShieldAlert,
  Phone,
  Mail,
  Building,
  GraduationCap,
  Sparkles,
  AlertCircle,
  FileCheck2,
  X,
  CreditCard,
  Send,
  FileSpreadsheet,
  Download,
  RefreshCw,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import {
  approveRegistration,
  rejectRegistration,
  GeneratedCredentials,
  syncAllApprovedRegistrationsAction,
  exportRegistrationsCsvAction,
  getRegistrations,
} from "@/app/actions/team-registration";
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from "@/lib/google-sheets-sync";

interface RegistrationsClientViewProps {
  initialRegistrations: any[];
}

export default function RegistrationsClientView({
  initialRegistrations,
}: RegistrationsClientViewProps) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeProofUrl, setActiveProofUrl] = useState<{ url: string; team: string; utr: string } | null>(null);
  const [activeMembersModal, setActiveMembersModal] = useState<any | null>(null);
  const [activeCredentialsModal, setActiveCredentialsModal] = useState<GeneratedCredentials | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [expandedProofId, setExpandedProofId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLatestRegistrations = async (showLoading = false) => {
    try {
      if (showLoading) setRefreshing(true);
      const res = await getRegistrations("all");
      if (res.success && Array.isArray(res.registrations)) {
        setRegistrations(res.registrations);
      }
    } catch (e) {
      console.error("Auto-fetch registrations error:", e);
    } finally {
      if (showLoading) setRefreshing(false);
    }
  };

  useEffect(() => {
    setRegistrations(initialRegistrations);
  }, [initialRegistrations]);

  // Periodic polling every 8 seconds to automatically show newly registered teams
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestRegistrations(false);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  // Generate local QR code base64 URL whenever modal opens
  useEffect(() => {
    if (activeCredentialsModal?.qrPayload) {
      QRCode.toDataURL(
        activeCredentialsModal.qrPayload,
        {
          width: 320,
          margin: 1,
          color: {
            dark: "#050508",
            light: "#ffffff",
          },
        },
        (err, url) => {
          if (!err && url) {
            setQrDataUrl(url);
          }
        }
      );
    } else {
      setQrDataUrl("");
    }
  }, [activeCredentialsModal]);

  // Filtered registrations
  const filtered = registrations.filter((r) => {
    const matchesFilter = filter === "all" ? true : r.status === filter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      r.team_name?.toLowerCase().includes(term) ||
      r.leader_name?.toLowerCase().includes(term) ||
      r.leader_email?.toLowerCase().includes(term) ||
      r.leader_college?.toLowerCase().includes(term) ||
      r.payment_utr?.toLowerCase().includes(term);

    return matchesFilter && matchesSearch;
  });

  const countPending = registrations.filter((r) => r.status === "pending").length;
  const countApproved = registrations.filter((r) => r.status === "approved").length;
  const countRejected = registrations.filter((r) => r.status === "rejected").length;

  const handleApprove = async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    setActionNotice(null);

    try {
      const res = await approveRegistration(id);
      if (res.success && res.credentials) {
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "approved", generated_credentials: res.credentials }
              : r
          )
        );
        setActiveCredentialsModal(res.credentials);
        setActionNotice({ type: "success", text: res.message });
      } else {
        setActionNotice({ type: "error", text: res.message || "Approval failed" });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "An error occurred" });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Reason for rejecting registration:", "Payment proof mismatch / invalid UTR");
    if (!reason) return;

    setLoadingId(id);
    setActionNotice(null);

    try {
      const res = await rejectRegistration(id, reason);
      if (res.success) {
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: "rejected", rejection_reason: reason } : r
          )
        );
        setActionNotice({ type: "success", text: "Registration marked as rejected." });
      } else {
        setActionNotice({ type: "error", text: res.message || "Failed to reject" });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message });
    } finally {
      setLoadingId(null);
    }
  };

  const OFFICIAL_WHATSAPP_GROUP = "https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld";

  const copyCredentials = (creds: GeneratedCredentials) => {
    const text = `
=== EVENTRA 2026 - TEAM LOGIN CREDENTIALS ===
Team Name: ${creds.teamName}
Team Code: ${creds.teamCode}
Login Email: ${creds.email}
Password: ${creds.password}
============================================
Official WhatsApp Group: ${OFFICIAL_WHATSAPP_GROUP}

Coordinators for queries:
• Preksha Dixit: +91 99458 67010
• Parinitha K: +91 63614 55193
============================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEmailContent = (creds: GeneratedCredentials) => {
    const leader = creds.leaderName || "Team Leader";
    const subject = `[IVC Relaython 2026] Official Team Credentials & WhatsApp Group - ${creds.teamName}`;
    const body = `Dear ${leader},

Congratulations! Your team registration and payment for IVC Relaython 2026 have been successfully verified.

Here are your official team credentials:

=========================================
TEAM ACCESS CREDENTIALS
=========================================
Team Name / Username: ${creds.teamName}
Team Code: ${creds.teamCode}
Login Email: ${creds.email}
Generated Password: ${creds.password}
=========================================

IMPORTANT - JOIN OFFICIAL PARTICIPANTS WHATSAPP GROUP:
Join the official event WhatsApp group immediately to receive live schedule updates, announcements, and round briefings:
👉 ${OFFICIAL_WHATSAPP_GROUP}

For any queries or assistance, contact the student coordinators:
• Preksha Dixit: +91 99458 67010
• Parinitha K: +91 63614 55193

Best regards,
Innovators & Visionaries Club (IVC)`;

    return { subject, body };
  };

  const handleSendMailto = (creds: GeneratedCredentials) => {
    const { subject, body } = getEmailContent(creds);
    const mailtoUrl = `mailto:${encodeURIComponent(creds.email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleOpenGmail = (creds: GeneratedCredentials) => {
    const { subject, body } = getEmailContent(creds);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      creds.email
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };

  const handleSendWhatsApp = (creds: GeneratedCredentials) => {
    const cleanPhone = (creds.leaderPhone || "").replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `*RELAYTHON 2026 - OFFICIAL SQUAD CREDENTIALS*

Hello ${creds.leaderName || "Team Leader"}, your team registration has been verified!

*Team Name:* ${creds.teamName}
*Team Code:* ${creds.teamCode}
*Login Email:* ${creds.email}
*Password:* ${creds.password}

👉 *Join Official WhatsApp Group:*
${OFFICIAL_WHATSAPP_GROUP}

*Coordinators for queries:*
• Preksha Dixit: +91 99458 67010
• Parinitha K: +91 63614 55193`;

    const waUrl = phoneWithCountry
      ? `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleExportCsv = async () => {
    try {
      setActionNotice(null);
      const res = await exportRegistrationsCsvAction(filter);
      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `eventra-registrations-${filter}-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setActionNotice({
          type: "success",
          text: "Registrations CSV downloaded! Includes Team Lead name, email, phone, clg, sem, branch, team name, transaction ID, and payment proof.",
        });
      } else {
        setActionNotice({ type: "error", text: res.message || "Failed to export CSV." });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Export error" });
    }
  };

  const handleSyncToSheets = async () => {
    if (syncingSheets) return;
    setSyncingSheets(true);
    setActionNotice(null);
    try {
      const res = await syncAllApprovedRegistrationsAction();
      if (res.success) {
        setActionNotice({ type: "success", text: res.message });
      } else {
        setActionNotice({ type: "error", text: res.message });
      }
    } catch (err: any) {
      setActionNotice({ type: "error", text: err.message || "Sync failed" });
    } finally {
      setSyncingSheets(false);
    }
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => setFilter("all")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === "all"
              ? "bg-white/10 border-white/40 ring-1 ring-white/20"
              : "bg-surface-color border-border-color hover:border-white/20"
          }`}
        >
          <span className="font-tech text-xs uppercase text-text-secondary">Total Submissions</span>
          <p className="font-heading text-2xl text-text-primary mt-1 m-0">{registrations.length}</p>
        </div>

        <div
          onClick={() => setFilter("pending")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === "pending"
              ? "bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30"
              : "bg-surface-color border-border-color hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-tech text-xs uppercase text-amber-400 font-bold">Needs Review</span>
            {countPending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <p className="font-heading text-2xl text-amber-400 mt-1 m-0">{countPending}</p>
        </div>

        <div
          onClick={() => setFilter("approved")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === "approved"
              ? "bg-green-500/15 border-green-500/50 ring-1 ring-green-500/30"
              : "bg-surface-color border-border-color hover:border-green-500/30"
          }`}
        >
          <span className="font-tech text-xs uppercase text-green-400">Approved & Active</span>
          <p className="font-heading text-2xl text-green-400 mt-1 m-0">{countApproved}</p>
        </div>

        <div
          onClick={() => setFilter("rejected")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === "rejected"
              ? "bg-rose-500/15 border-rose-500/50 ring-1 ring-rose-500/30"
              : "bg-surface-color border-border-color hover:border-rose-500/30"
          }`}
        >
          <span className="font-tech text-xs uppercase text-rose-400">Rejected</span>
          <p className="font-heading text-2xl text-rose-400 mt-1 m-0">{countRejected}</p>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border font-tech text-xs flex items-center justify-between ${
            actionNotice.type === "success"
              ? "bg-green-500/15 border-green-500 text-green-300"
              : "bg-status-error/15 border-status-error text-status-error"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs, Search Bar & Google Sheets Actions */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-surface-color border border-border-color rounded-xl w-full lg:w-auto overflow-x-auto">
          {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 font-tech text-xs uppercase tracking-wider rounded-lg transition-all ${
                filter === tab
                  ? "bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === "all" ? "All" : tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search team, leader, UTR..."
              className="w-full bg-surface-color border border-border-color focus:border-cyan-400 text-text-primary pl-9 pr-3.5 py-2 rounded-xl font-tech text-xs outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Refresh Live Registrations */}
            <button
              type="button"
              onClick={() => fetchLatestRegistrations(true)}
              disabled={refreshing}
              title="Refresh registration submissions in real-time"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-text-primary rounded-xl font-tech text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-cyan-400" : ""} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            {/* Export CSV for Google Sheets */}
            <button
              type="button"
              onClick={handleExportCsv}
              title="Download CSV formatted for Google Sheets with Team Lead name, email, phone, clg, sem, branch, team name, transaction ID, and payment proof link"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-500 text-emerald-400 rounded-xl font-tech text-xs font-bold transition-all"
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>

            {/* Sync All to Google Sheets Webhook */}
            <button
              type="button"
              onClick={handleSyncToSheets}
              disabled={syncingSheets}
              title="Sync verified registrations to Google Sheets via Webhook"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-500 text-cyan-400 rounded-xl font-tech text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncingSheets ? "animate-spin" : ""} />
              <span>{syncingSheets ? "Syncing..." : "Sync Sheets"}</span>
            </button>

            {/* Help / Setup Guide Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowScriptModal(true)}
              title="Google Sheets Apps Script Setup Instructions"
              className="p-2 bg-surface-color hover:bg-white/10 border border-border-color hover:border-white/30 text-text-secondary hover:text-white rounded-xl transition-colors"
            >
              <HelpCircle size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-surface-color border border-border-color rounded-2xl">
          <FileCheck2 className="w-12 h-12 text-text-secondary mx-auto mb-3 opacity-40" />
          <h3 className="font-heading text-lg text-text-primary uppercase tracking-wider mb-1">
            No Registrations Found
          </h3>
          <p className="font-tech text-text-secondary text-xs">
            {searchTerm
              ? "No registration matches your search term."
              : `There are currently no registrations in "${filter}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isPending = item.status === "pending";
            const isApproved = item.status === "approved";
            const isRejected = item.status === "rejected";
            const creds = item.generated_credentials as GeneratedCredentials | undefined;
            const membersList = Array.isArray(item.members) ? item.members : [];

            return (
              <div
                key={item.id}
                className={`bg-surface-color border rounded-2xl p-5 sm:p-6 transition-all ${
                  isPending
                    ? "border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                    : isApproved
                    ? "border-green-500/30 hover:border-green-500/50"
                    : "border-rose-500/20 opacity-80"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-color">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h2 className="font-heading text-lg sm:text-xl text-text-primary uppercase tracking-wider m-0">
                        {item.team_name}
                      </h2>
                      <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-tech text-[10px] font-bold uppercase rounded">
                        {item.track}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded font-tech text-[10px] font-bold uppercase ${
                          isPending
                            ? "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                            : isApproved
                            ? "bg-green-500/15 border border-green-500/40 text-green-400"
                            : "bg-rose-500/15 border border-rose-500/40 text-rose-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-tech text-text-secondary mt-2">
                      <span className="flex items-center gap-1.5 text-text-primary">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        Leader: {item.leader_name}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {item.leader_email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {item.leader_phone}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        {item.leader_college}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* View Members Button */}
                    <button
                      type="button"
                      onClick={() => setActiveMembersModal(item)}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-border-color text-text-primary font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      All 4 Members ({1 + membersList.length})
                    </button>

                    {/* View Proof Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProofId((prev) => (prev === item.id ? null : item.id))
                      }
                      className={`px-3.5 py-2 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all ${
                        expandedProofId === item.id
                          ? "bg-pink-500 text-black border border-pink-400 font-bold shadow-[0_0_15px_rgba(255,0,127,0.4)]"
                          : "bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/40 text-pink-400"
                      }`}
                    >
                      {expandedProofId === item.id ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          Hide Proof
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          View Proof
                        </>
                      )}
                    </button>

                    {/* Approved: View Credentials */}
                    {isApproved && creds && (
                      <button
                        type="button"
                        onClick={() => setActiveCredentialsModal(creds)}
                        className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)]"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                        View Credentials
                      </button>
                    )}

                    {/* Pending: Approve & Reject */}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReject(item.id)}
                          disabled={loadingId === item.id}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApprove(item.id)}
                          disabled={loadingId === item.id}
                          className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-black font-tech font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] disabled:opacity-50"
                        >
                          {loadingId === item.id ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              Provisioning...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verify & Approve
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Proof Preview (Situated directly inside the clicked card right where cursor is clicked) */}
                {expandedProofId === item.id && (
                  <div className="mt-4 p-4 rounded-xl bg-black/85 border border-pink-500/40 shadow-[0_0_25px_rgba(255,0,127,0.15)] animate-fade-in space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/10 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-tech text-xs uppercase font-bold text-pink-400 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Payment Proof Screenshot
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">
                          UTR: {item.payment_utr}
                        </span>
                        <span className="text-[11px] font-mono text-text-secondary">
                          Payer: {item.payment_phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveProofUrl({
                              url: item.payment_proof_url,
                              team: item.team_name,
                              utr: item.payment_utr,
                            })
                          }
                          className="px-2.5 py-1 text-[11px] font-tech text-cyan-400 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors flex items-center gap-1"
                          title="Open in fullscreen lightbox modal"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Fullscreen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedProofId(null)}
                          className="px-2.5 py-1 text-[11px] font-tech text-text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          <span>Hide</span>
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[500px] overflow-auto flex items-center justify-center bg-black/60 rounded-lg p-2 border border-white/10">
                      <img
                        src={item.payment_proof_url}
                        alt={`Payment Proof for ${item.team_name}`}
                        className="max-h-[460px] w-auto max-w-full object-contain rounded-md cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => window.open(item.payment_proof_url, "_blank")}
                        title="Click to open original full-size image in new tab"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-tech text-text-secondary">
                      <span>Click image to open in full size in a new tab</span>
                      <a
                        href={item.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        Open Original Tab <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Payment summary footer */}
                <div className="pt-3 flex flex-wrap items-center justify-between text-xs font-tech text-text-secondary">
                  <div className="flex items-center gap-4">
                    <span>
                      UTR / Ref No:{" "}
                      <span className="text-cyan-400 font-mono font-bold">{item.payment_utr}</span>
                    </span>
                    <span>
                      Payer Phone: <span className="text-text-primary">{item.payment_phone}</span>
                    </span>
                  </div>
                  <div>
                    <span>Submitted: {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: PAYMENT PROOF LIGHTBOX (Teleported to document.body to prevent scroll container offset) */}
      {mounted && typeof document !== "undefined" && activeProofUrl && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-color border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-6 relative shadow-[0_0_50px_rgba(0,245,255,0.2)] animate-scale-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-color">
              <div>
                <h3 className="font-heading text-lg uppercase text-text-primary">
                  Payment Proof // {activeProofUrl.team}
                </h3>
                <p className="font-tech text-xs text-cyan-400 font-mono">
                  Reported UTR: {activeProofUrl.utr}
                </p>
              </div>
              <button
                onClick={() => setActiveProofUrl(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-black/50 rounded-xl p-2 border border-white/10">
              <Image
                src={activeProofUrl.url}
                alt="Payment Proof"
                width={600}
                height={500}
                className="max-h-[60vh] w-auto object-contain rounded-lg"
              />
            </div>

            <div className="mt-4 flex justify-between items-center">
              <a
                href={activeProofUrl.url}
                target="_blank"
                rel="noreferrer"
                className="font-tech text-xs text-cyan-400 hover:underline flex items-center gap-1.5"
              >
                Open Original Image <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setActiveProofUrl(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-text-primary font-tech text-xs uppercase rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: 4 MEMBERS ROSTER */}
      {mounted && typeof document !== "undefined" && activeMembersModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-color border border-border-color rounded-2xl max-w-3xl w-full p-6 relative shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-color">
              <div>
                <h3 className="font-heading text-lg uppercase text-text-primary">
                  Squad Roster // {activeMembersModal.team_name}
                </h3>
                <p className="font-tech text-xs text-text-secondary">
                  Track: {activeMembersModal.track} · College: {activeMembersModal.leader_college}
                </p>
              </div>
              <button
                onClick={() => setActiveMembersModal(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Member 1: Leader */}
              <div className="bg-[#050508] border border-cyan-500/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 font-tech text-[10px] font-bold uppercase rounded">
                    Member 1 // Team Leader
                  </span>
                  <span className="font-tech text-xs text-text-secondary font-mono">
                    USN: {activeMembersModal.leader_usn}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-tech">
                  <div>
                    <span className="text-text-secondary">Name:</span> {activeMembersModal.leader_name}
                  </div>
                  <div>
                    <span className="text-text-secondary">Email:</span> {activeMembersModal.leader_email}
                  </div>
                  <div>
                    <span className="text-text-secondary">Phone:</span> {activeMembersModal.leader_phone}
                  </div>
                  <div>
                    <span className="text-text-secondary">Branch / Sem:</span>{" "}
                    {activeMembersModal.leader_branch} ({activeMembersModal.leader_sem})
                  </div>
                </div>
              </div>

              {/* Members 2, 3, 4 */}
              {(Array.isArray(activeMembersModal.members) ? activeMembersModal.members : []).map(
                (m: any, i: number) => (
                  <div key={i} className="bg-[#050508] border border-border-color rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                      <span className="px-2 py-0.5 bg-white/10 text-text-primary font-tech text-[10px] font-bold uppercase rounded">
                        Member {i + 2}
                      </span>
                      <span className="font-tech text-xs text-text-secondary font-mono">
                        USN: {m.usn}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-tech">
                      <div>
                        <span className="text-text-secondary">Name:</span> {m.name}
                      </div>
                      <div>
                        <span className="text-text-secondary">Email:</span> {m.email}
                      </div>
                      <div>
                        <span className="text-text-secondary">College:</span> {m.college}
                      </div>
                      <div>
                        <span className="text-text-secondary">Branch / Sem:</span> {m.branch} ({m.sem})
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="mt-5 text-right">
              <button
                onClick={() => setActiveMembersModal(null)}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-text-primary font-tech text-xs uppercase rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: CREDENTIALS & OFFICIAL QR PASS */}
      {mounted && typeof document !== "undefined" && activeCredentialsModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a10] border border-cyan-500/50 rounded-2xl max-w-lg w-full p-6 text-center relative shadow-[0_0_50px_rgba(0,245,255,0.25)] animate-scale-in">
            <button
              onClick={() => setActiveCredentialsModal(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-green-500/10 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-3 text-green-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="font-heading text-xl uppercase tracking-wider text-text-primary">
              Credentials Provisioned
            </h3>
            <p className="font-tech text-xs text-text-secondary mt-1">
              Team &quot;{activeCredentialsModal.teamName}&quot; is active in database and ready for check-in.
            </p>

            {/* Generated QR Pass Preview (Rendered locally from payload) */}
            <div className="bg-white p-3 rounded-xl w-40 h-40 mx-auto my-5 shadow-lg flex items-center justify-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Official QR Pass"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 font-tech text-xs gap-1.5">
                  <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Generating QR...
                </div>
              )}
            </div>
            <p className="font-tech text-[10px] text-cyan-400 uppercase tracking-widest mb-4">
              Compatible with /ops/scanner Desk
            </p>

            {/* Credentials Card */}
            <div className="bg-[#050508] border border-white/10 rounded-xl p-4 text-left space-y-2 font-tech text-xs mb-5">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Team Name / Username:</span>
                <span className="text-text-primary font-bold">{activeCredentialsModal.teamName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Team Code:</span>
                <span className="text-cyan-400 font-mono font-bold">{activeCredentialsModal.teamCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Login Email:</span>
                <span className="text-text-primary">{activeCredentialsModal.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Generated Password:</span>
                <code className="text-pink-400 font-mono font-bold px-2 py-0.5 bg-pink-500/10 border border-pink-500/30 rounded">
                  {activeCredentialsModal.password}
                </code>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-text-secondary">Official WhatsApp:</span>
                <a
                  href={OFFICIAL_WHATSAPP_GROUP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-mono text-[11px] font-bold underline flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Join Group &gt;&gt;
                </a>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[11px]">
                <span className="text-text-secondary">Coordinators:</span>
                <span className="text-neutral-300 font-mono">Preksha Dixit (+91 99458 67010) · Parinitha K (+91 63614 55193)</span>
              </div>
            </div>

            {/* Actions & Copy */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyCredentials(activeCredentialsModal)}
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,245,255,0.25)]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied to Clipboard!" : "Copy Credentials & WhatsApp Link"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCredentialsModal(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-text-primary font-tech text-xs uppercase rounded-xl"
                >
                  Done
                </button>
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-left">
                <p className="font-tech text-[11px] text-emerald-300 m-0 leading-relaxed">
                  💡 <strong>Batch Dispatch Enabled:</strong> This team&apos;s credentials have been synced to Google Sheet (Sheet 2: <em>Approved</em>). You can send emails to all confirmed teams at once from your club&apos;s official email using <strong>🚀 Eventra Dispatch &gt; 📧 Send All Credentials Emails</strong> in the Google Sheet.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Google Sheets Setup Instructions Modal */}
      {mounted && typeof document !== "undefined" && showScriptModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-color border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-6 text-left relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowScriptModal(false)}
              className="absolute top-4 right-4 text-text-secondary hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-cyan-400 font-tech uppercase tracking-wider text-xs font-bold">
              <FileSpreadsheet className="w-5 h-5" />
              <span>Google Sheets Realtime Webhook Setup (1 Minute)</span>
            </div>

            <p className="font-tech text-xs text-text-secondary leading-relaxed">
              When an admin approves a team registration, Eventra automatically sends all details (Team Lead Name, Email, Phone, College, Sem, Branch, Team Name, Transaction ID, and clickable Payment Proof link) to your Google Sheet.
            </p>

            <div className="space-y-2 font-tech text-xs text-text-secondary">
              <p className="font-bold text-text-primary">Setup Instructions:</p>
              <ol className="list-decimal list-inside space-y-1.5 bg-black/40 p-3.5 rounded-xl border border-white/5">
                <li>Create a new Google Sheet (or open your existing one).</li>
                <li>Go to <strong>Extensions &gt; Apps Script</strong> in the top menu.</li>
                <li>Paste the script below into the code editor and save.</li>
                <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
                <li>Choose type: <strong>Web app</strong>, Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>.</li>
                <li>Copy the generated Web App URL and add to your <code className="text-cyan-400">.env.local</code>:</li>
              </ol>
              <div className="p-2.5 bg-[#050508] border border-cyan-500/30 rounded font-mono text-[11px] text-cyan-300">
                GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-tech text-xs uppercase text-text-secondary font-bold">
                  Google Apps Script Code:
                </span>
                <button
                  type="button"
                  onClick={copyAppsScript}
                  className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded text-xs font-tech font-bold flex items-center gap-1 transition-all"
                >
                  {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedScript ? "Copied Script!" : "Copy Script"}</span>
                </button>
              </div>

              <pre className="p-3 bg-black/80 border border-white/10 rounded-xl font-mono text-[10px] text-neutral-300 overflow-x-auto max-h-52">
                {GOOGLE_APPS_SCRIPT_TEMPLATE}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-text-primary font-tech text-xs uppercase rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


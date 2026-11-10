"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  approveRegistration,
  rejectRegistration,
  GeneratedCredentials,
} from "@/app/actions/team-registration";

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

  const copyCredentials = (creds: GeneratedCredentials) => {
    const text = `
=== EVENTRA 1.0 - TEAM LOGIN CREDENTIALS ===
Team Name: ${creds.teamName}
Team Code: ${creds.teamCode}
Portal URL: https://eventra-ivc.vercel.app/login
Login Email: ${creds.email}
Password: ${creds.password}
============================================
Official QR Code is activated for Registration Check-in & Meals.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEmailContent = (creds: GeneratedCredentials) => {
    const leader = creds.leaderName || "Team Leader";
    const subject = `[IVC Ideathon 2026] Official Team Credentials & QR Pass - ${creds.teamName}`;
    const body = `Dear ${leader},

Congratulations! Your team registration and payment for the IVC Ideathon 2026 have been successfully verified.

Here are your official credentials to access the Eventra portal:

=========================================
TEAM ACCESS CREDENTIALS
=========================================
Team Name / Username: ${creds.teamName}
Team Code: ${creds.teamCode}
Portal URL: https://eventra-ivc.vercel.app/login
Login Email: ${creds.email}
Password: ${creds.password}
=========================================

NEXT STEPS:
1. Log in to the Eventra portal (https://eventra-ivc.vercel.app/login) using your email and password above.
2. Go to the "Team QR" tab to access your squad's official live QR badge.
3. Present this QR badge at the desk for Registration Check-in, Goodies / Kit collection, and Meals during the event.
4. Problem statements and submission guidelines are now unlocked in your dashboard.

If you have any questions or require support, feel free to reply to this email.

Best regards,
Innovators & Visionaries Club (IVC)
Event Organizing Committee`;

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

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-surface-color border border-border-color rounded-xl w-full sm:w-auto overflow-x-auto">
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

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search team, leader, UTR..."
            className="w-full bg-surface-color border border-border-color focus:border-cyan-400 text-text-primary pl-9 pr-3.5 py-2 rounded-xl font-tech text-xs outline-none transition-all"
          />
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
                        setActiveProofUrl({
                          url: item.payment_proof_url,
                          team: item.team_name,
                          utr: item.payment_utr,
                        })
                      }
                      className="px-3.5 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/40 text-pink-400 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Proof
                    </button>

                    {/* Approved: View Credentials & Quick Email */}
                    {isApproved && creds && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveCredentialsModal(creds)}
                          className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)]"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                          View Credentials
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenGmail(creds)}
                          title="Open pre-formatted email draft in Gmail Web"
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-rose-300 font-tech text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all"
                        >
                          <Send className="w-3.5 h-3.5 text-rose-400" />
                          Email Lead
                        </button>
                      </>
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

      {/* MODAL 1: PAYMENT PROOF LIGHTBOX */}
      {activeProofUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
        </div>
      )}

      {/* MODAL 2: 4 MEMBERS ROSTER */}
      {activeMembersModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
        </div>
      )}

      {/* MODAL 3: CREDENTIALS & OFFICIAL QR PASS */}
      {activeCredentialsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
            </div>

            {/* Quick Email & Copy Buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenGmail(activeCredentialsModal)}
                  className="py-2.5 px-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-tech font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                >
                  <Send className="w-4 h-4" />
                  Draft in Gmail Web
                </button>

                <button
                  type="button"
                  onClick={() => handleSendMailto(activeCredentialsModal)}
                  className="py-2.5 px-3 bg-white/10 hover:bg-white/15 border border-white/20 text-text-primary font-tech font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <Mail className="w-4 h-4 text-cyan-400" />
                  Draft in Mail App
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyCredentials(activeCredentialsModal)}
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,245,255,0.25)]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied to Clipboard!" : "Copy All Credentials"}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCredentialsModal(null)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-text-primary font-tech text-xs uppercase rounded-xl"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


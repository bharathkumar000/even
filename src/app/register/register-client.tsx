"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  CreditCard,
  FileCheck,
  ShieldCheck,
  Users,
  Lock,
  ShieldAlert,
  MessageCircle,
  ExternalLink,
  Flag,
  Zap,
} from "lucide-react";
import { submitTeamRegistration, TeamMemberInput } from "@/app/actions/team-registration";
import RelayathonFooter from "@/components/RelayathonFooter";

interface DriverState {
  name: string;
  email: string;
  phone: string;
  usn: string;
  branch: string;
  sem: string;
  college: string;
}

const DEFAULT_DRIVER: DriverState = {
  name: "",
  email: "",
  phone: "",
  usn: "",
  branch: "Computer Science & Engg (CSE)",
  sem: "1st Semester",
  college: "Vidya Vardhaka College Of Engineering",
};

const BRANCHES = [
  "Computer Science & Engg (CSE)",
  "AI & Machine Learning (AIML)",
  "Information Science & Engg (ISE)",
  "Electronics & Communication (ECE)",
  "Electrical & Electronics (EEE)",
  "Mechanical Engineering (MECH)",
  "Civil Engineering (CIVIL)",
  "Data Science / Computer Science & Business (CSBS)",
  "Other Branch",
];

const SEMESTERS = [
  "1st Semester",
  "3rd Semester",
];

export default function RegisterClientView({
  initialCounts = { firstSemCount: 0, thirdSemCount: 0, maxLimit: 40, waitlistLimit: 10 },
}: {
  initialCounts?: { firstSemCount: number; thirdSemCount: number; maxLimit: number; waitlistLimit?: number };
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ teamName: string; refId: string; isWaitlist?: boolean } | null>(null);

  // Live Semester Counts & Locking State (40 Confirmed + 10 Waitlist = 50 Total per Semester)
  const [semCounts, setSemCounts] = useState({
    firstSemCount: initialCounts.firstSemCount || 0,
    thirdSemCount: initialCounts.thirdSemCount || 0,
    maxLimit: initialCounts.maxLimit || 40,
    waitlistLimit: initialCounts.waitlistLimit || 10,
  });
  const maxLimit = semCounts.maxLimit;
  const waitlistLimit = semCounts.waitlistLimit;
  const maxTotal = maxLimit + waitlistLimit;

  const isFirstSemWaitlist = semCounts.firstSemCount >= maxLimit && semCounts.firstSemCount < maxTotal;
  const isFirstSemLocked = semCounts.firstSemCount >= maxTotal;
  const isThirdSemWaitlist = semCounts.thirdSemCount >= maxLimit && semCounts.thirdSemCount < maxTotal;
  const isThirdSemLocked = semCounts.thirdSemCount >= maxTotal;
  const isAllLocked = isFirstSemLocked && isThirdSemLocked;
  const defaultAvailableSem = isFirstSemLocked && !isThirdSemLocked ? "3rd Semester" : "1st Semester";

  // Squad / Team Identity
  const [teamName, setTeamName] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("GRAND PRIX");

  // Driver 1 (Captain)
  const [driver1, setDriver1] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "Vidya Vardhaka College Of Engineering",
  });

  // Drivers 2, 3, 4
  const [driver2, setDriver2] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "Vidya Vardhaka College Of Engineering",
  });

  const [driver3, setDriver3] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "Vidya Vardhaka College Of Engineering",
  });

  const [driver4, setDriver4] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "Vidya Vardhaka College Of Engineering",
  });

  const isSelectedSemWaitlist =
    (driver1.sem.includes("1st") && isFirstSemWaitlist) ||
    (driver1.sem.includes("3rd") && isThirdSemWaitlist);
  const isSelectedSemLocked =
    isAllLocked ||
    (driver1.sem.includes("1st") && isFirstSemLocked) ||
    (driver1.sem.includes("3rd") && isThirdSemLocked);

  // Sync all squad members to the Captain's chosen semester
  const handleCaptainSemChange = (newSem: string) => {
    setDriver1((prev) => ({ ...prev, sem: newSem }));
    setDriver2((prev) => ({ ...prev, sem: newSem }));
    setDriver3((prev) => ({ ...prev, sem: newSem }));
    setDriver4((prev) => ({ ...prev, sem: newSem }));
  };

  // Payment
  const [paymentUtr, setPaymentUtr] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate crisp UPI QR Code for payment
  useEffect(() => {
    // Official UPI Payment Link with amount ₹400
    const upiLink = "upi://pay?pa=6361455193@okbizaxis&pn=Parinitha%20K&am=400&cu=INR&tn=Eventra%20Grand%20Prix%20Entry%20Fee";
    QRCode.toDataURL(
      upiLink,
      {
        width: 320,
        margin: 2,
        color: {
          dark: "#0a0a0a",
          light: "#ffffff",
        },
      },
      (err, url) => {
        if (!err && url) {
          setPaymentQrDataUrl(url);
        }
      }
    );
  }, []);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Payment proof file exceeds 10MB limit.");
      return;
    }
    setPaymentFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMsg(null);
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText("6361455193@okbizaxis");
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const validateForm = () => {
    setErrorMsg(null);

    if (!teamName.trim()) {
      setErrorMsg("DATABASE_ID: Please enter a valid Constructor Team / Squad Name.");
      return false;
    }

    // Validate Driver 1 (Captain)
    if (!driver1.name.trim() || !driver1.email.trim() || !driver1.phone.trim() || !driver1.college.trim()) {
      setErrorMsg("// DRIVER 1 (CAPTAIN): Please complete Name, Email, 10-digit Phone, and College.");
      return false;
    }
    if (!driver1.email.includes("@")) {
      setErrorMsg("// DRIVER 1 (CAPTAIN): Enter a valid email address.");
      return false;
    }
    if (driver1.phone.trim().length < 10) {
      setErrorMsg("// DRIVER 1 (CAPTAIN): Enter a valid 10-digit phone number.");
      return false;
    }

    // Validate Driver 2
    if (!driver2.name.trim() || !driver2.email.trim() || !driver2.phone.trim() || !driver2.college.trim()) {
      setErrorMsg("// DRIVER 2 (AERODYNAMICS): Please complete all required member details.");
      return false;
    }
    if (!driver2.email.includes("@")) {
      setErrorMsg("// DRIVER 2 (AERODYNAMICS): Enter a valid email address.");
      return false;
    }

    // Validate Driver 3
    if (!driver3.name.trim() || !driver3.email.trim() || !driver3.phone.trim() || !driver3.college.trim()) {
      setErrorMsg("// DRIVER 3 (POWERTRAIN): Please complete all required member details.");
      return false;
    }
    if (!driver3.email.includes("@")) {
      setErrorMsg("// DRIVER 3 (POWERTRAIN): Enter a valid email address.");
      return false;
    }

    // Validate Driver 4
    if (!driver4.name.trim() || !driver4.email.trim() || !driver4.phone.trim() || !driver4.college.trim()) {
      setErrorMsg("// DRIVER 4 (TELEMETRY): Please complete all required member details.");
      return false;
    }
    if (!driver4.email.includes("@")) {
      setErrorMsg("// DRIVER 4 (TELEMETRY): Enter a valid email address.");
      return false;
    }

    // Strict Semester Integrity (All 4 members must belong to the exact same semester)
    const expectedSem = driver1.sem.trim().toLowerCase();
    if (
      driver2.sem.trim().toLowerCase() !== expectedSem ||
      driver3.sem.trim().toLowerCase() !== expectedSem ||
      driver4.sem.trim().toLowerCase() !== expectedSem
    ) {
      setErrorMsg("SEMESTER ELIGIBILITY POLICY: All 4 squad members must belong to the exact same semester. Mixed semester and senior-junior teams are strictly prohibited.");
      return false;
    }

    // Validate Payment (Only required for confirmed slots < 40; not required for Waiting List)
    if (!isSelectedSemWaitlist) {
      if (!paymentUtr.trim() || paymentUtr.trim().length < 6) {
        setErrorMsg("GRAND PRIX ENTRY: Please enter a valid 12-digit UPI Reference / UTR Number.");
        return false;
      }
      if (!paymentFile) {
        setErrorMsg("GRAND PRIX ENTRY: Please upload your payment screenshot proof.");
        return false;
      }
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedTypes.includes(paymentFile.type.toLowerCase())) {
        setErrorMsg("PAYMENT PROOF: Only PNG, JPG, or JPEG images are permitted.");
        return false;
      }
      if (paymentFile.size > 10 * 1024 * 1024) {
        setErrorMsg("PAYMENT PROOF: Image file size must not exceed 10MB.");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check Semester Slot Lock before validating (40 confirmed + 10 waitlist = 50 max)
    if (isAllLocked) {
      setErrorMsg("REGISTRATION LOCKED: All 40 confirmed slots and 10 waiting list slots for both 1st Semester and 3rd Semester are full.");
      window.scrollTo({ top: 300, behavior: "smooth" });
      return;
    }
    if (driver1.sem.includes("1st") && isFirstSemLocked) {
      setErrorMsg("1st Semester registration is LOCKED (40 confirmed + 10 waiting list teams filled). Please select 3rd Semester if eligible.");
      window.scrollTo({ top: 300, behavior: "smooth" });
      return;
    }
    if (driver1.sem.includes("3rd") && isThirdSemLocked) {
      setErrorMsg("3rd Semester registration is LOCKED (40 confirmed + 10 waiting list teams filled). Please select 1st Semester if eligible.");
      window.scrollTo({ top: 300, behavior: "smooth" });
      return;
    }

    if (!validateForm()) {
      window.scrollTo({ top: 300, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("teamName", teamName.trim());
      formData.append("track", selectedDomain);

      // Captain (Leader)
      formData.append("leaderName", driver1.name.trim());
      formData.append("leaderEmail", driver1.email.trim().toLowerCase());
      formData.append("leaderPhone", driver1.phone.trim());
      formData.append("leaderCollege", driver1.college.trim());
      formData.append("leaderUsn", driver1.usn.trim() || "N/A");
      formData.append("leaderBranch", driver1.branch);
      formData.append("leaderSem", driver1.sem);

      // Remaining 3 Drivers
      const otherMembers: TeamMemberInput[] = [
        {
          name: driver2.name.trim(),
          email: driver2.email.trim().toLowerCase(),
          phone: driver2.phone.trim(),
          usn: driver2.usn.trim() || "N/A",
          college: driver2.college.trim(),
          branch: driver2.branch,
          sem: driver2.sem,
        },
        {
          name: driver3.name.trim(),
          email: driver3.email.trim().toLowerCase(),
          phone: driver3.phone.trim(),
          usn: driver3.usn.trim() || "N/A",
          college: driver3.college.trim(),
          branch: driver3.branch,
          sem: driver3.sem,
        },
        {
          name: driver4.name.trim(),
          email: driver4.email.trim().toLowerCase(),
          phone: driver4.phone.trim(),
          usn: driver4.usn.trim() || "N/A",
          college: driver4.college.trim(),
          branch: driver4.branch,
          sem: driver4.sem,
        },
      ];

      formData.append("membersJson", JSON.stringify(otherMembers));
      formData.append("paymentUtr", paymentUtr.trim());
      formData.append("paymentPhone", driver1.phone.trim());
      if (paymentFile) {
        formData.append("paymentProof", paymentFile);
      }

      const res = await submitTeamRegistration(formData);

      if (res.success) {
        setSemCounts((prev) => ({
          ...prev,
          firstSemCount: driver1.sem.includes("1st") ? prev.firstSemCount + 1 : prev.firstSemCount,
          thirdSemCount: driver1.sem.includes("3rd") ? prev.thirdSemCount + 1 : prev.thirdSemCount,
        }));
        setSuccessData({
          teamName: teamName.trim(),
          refId: res.registrationId || "SQUAD-" + Date.now().toString().slice(-6),
          isWaitlist: res.isWaitlist,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErrorMsg(res.message || "Failed to submit registration. Please verify details and retry.");
      }
    } catch (err: unknown) {
      console.error("Submission failed:", err);
      setErrorMsg("Unexpected system error while locking grid position. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white font-sans selection:bg-red-600 selection:text-white pb-20">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-md border-b border-red-950/40 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Top Left: Eventra Relaython 2026 */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="px-2.5 py-1 bg-red-600 text-black font-black uppercase text-xs italic tracking-widest rounded-sm shadow-[0_0_15px_rgba(255,0,0,0.5)] group-hover:scale-105 transition-transform">
              EVENTRA
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-red-500 font-bold">
              // RELAYATHON 2026
            </span>
          </Link>

          {/* Top Right: Login Button */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline font-mono text-xs text-neutral-400">
              Already Registered?
            </span>
            <Link
              href="/login"
              className="px-4 py-1.5 border border-red-600/70 hover:border-red-500 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white font-mono text-xs uppercase font-bold tracking-wider rounded transition-all shadow-[0_0_15px_rgba(255,0,0,0.2)]"
            >
              LOGIN &gt;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        {/* SUCCESS CONFIRMATION MODAL / SCREEN (F1 PADDOCK & RACE CONTROL STYLED) */}
        {successData ? (
          <div className="border-2 border-red-600 bg-[#080808] p-6 sm:p-12 rounded-2xl text-center space-y-6 sm:space-y-8 shadow-[0_0_60px_rgba(255,0,0,0.3)] animate-fade-in my-8 sm:my-12 relative overflow-hidden">
            {/* Top Chequered Track Border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(45deg,#ff0000,#ff0000_12px,#000000_12px,#000000_24px)] opacity-80" />

            {/* Glowing F1 Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600/15 border border-red-500/50 rounded-full text-red-400 font-mono text-[11px] sm:text-xs uppercase font-bold tracking-[3px] shadow-[0_0_20px_rgba(255,0,0,0.25)]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>
                {successData.isWaitlist
                  ? "🏎️ PIT LANE WAITING LIST // ENTRY LOGGED"
                  : "🏁 PADDOCK ACCESS GRANTED // FORMULA 1 GRID POSITION LOCKED"}
              </span>
            </div>

            {/* Main F1 Title */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl font-black italic uppercase text-white tracking-wide leading-tight drop-shadow-[0_0_30px_rgba(255,0,0,0.35)]">
                {successData.isWaitlist
                  ? `ON THE WAITING LIST, ${successData.teamName}`
                  : `WELCOME TO THE GRID, ${successData.teamName}`}
              </h1>
              <p className="font-mono text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto uppercase tracking-wider">
                {successData.isWaitlist
                  ? "Your squad details have been logged with Race Control into the Waiting List."
                  : "Your 4-driver constructor crew has been locked into the official Relaython 2026 grid."}
              </p>
              {successData.isWaitlist && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 font-mono text-xs max-w-xl mx-auto leading-relaxed mt-2">
                  ⚠️ <strong>Please Note:</strong> Registering on the waiting list does not guarantee a slot for participation. If any confirmed slot becomes available, our Race Stewards will reach out to the Team Lead for payment and participation confirmation.
                </div>
              )}
            </div>

            {/* F1 Race Control Telemetry Box */}
            <div className="p-4 sm:p-5 bg-black/80 border border-red-600/40 rounded-xl max-w-md mx-auto font-mono text-xs space-y-2.5 text-left shadow-inner">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-neutral-500 uppercase tracking-wider">CONSTRUCTOR SQUAD:</span>
                <span className="text-white font-bold">{successData.teamName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-neutral-500 uppercase tracking-wider">RACE CONTROL REF:</span>
                <span className="text-red-400 font-bold font-mono">{successData.refId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500 uppercase tracking-wider">TELEMETRY STATUS:</span>
                <span className={`font-bold ${successData.isWaitlist ? "text-yellow-400" : "text-emerald-400"}`}>
                  {successData.isWaitlist
                    ? "Waiting List Slot Logged"
                    : "Manual Telemetry & UTR Verification In Progress"}
                </span>
              </div>
            </div>

            {/* MANDATORY OFFICIAL WHATSAPP GROUP CARD */}
            <div className="p-6 sm:p-7 bg-gradient-to-b from-[#0a1f14] via-[#05130b] to-black border-2 border-emerald-500 rounded-2xl max-w-xl mx-auto text-center space-y-4 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-400 font-mono text-xs uppercase font-bold tracking-widest">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Mandatory Step // All 4 Drivers</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black italic uppercase text-white tracking-wide">
                Join The Official WhatsApp Group
              </h2>

              <p className="font-mono text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-lg mx-auto">
                All live race briefings, schedule updates, track announcements, and pit-stop instructions will be broadcasted exclusively in this group. All team members must join!
              </p>

              <a
                href="https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase italic tracking-wider text-sm sm:text-base rounded-xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95"
              >
                <MessageCircle className="w-5 h-5 fill-black" />
                <span>JOIN OFFICIAL WHATSAPP GROUP &gt;&gt;</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <div className="pt-2 text-[11px] font-mono text-neutral-400 break-all">
                Direct Link:{" "}
                <a
                  href="https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300"
                >
                  https://chat.whatsapp.com/Baq9uEcVFQs9loSZxJTspB
                </a>
              </div>
            </div>

            {/* Race Day Credentials & Helplines */}
            <div className="space-y-4 max-w-xl mx-auto font-mono">
              {!successData.isWaitlist && (
                <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 text-xs leading-relaxed">
                  💡 <strong>Next Steps:</strong> Once the UTR is verified by Race Control, your squad&apos;s official credentials will be dispatched to the Team Lead&apos;s email (<span className="text-white font-bold">{driver1.email}</span>).
                </div>
              )}

              <div className="pt-3 border-t border-neutral-800 text-center space-y-1.5">
                <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs block">
                  Race Control Coordinators:
                </span>
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-sm sm:text-base font-bold text-white">
                  <a href="tel:+918310353103" className="text-red-400 hover:text-white transition-colors">
                    Moksh (+91 831 035 3103)
                  </a>
                  <span className="text-neutral-600 hidden sm:inline">•</span>
                  <a href="tel:+916361455193" className="text-red-400 hover:text-white transition-colors">
                    Parinitha (+91 63614 55193)
                  </a>
                  <span className="text-neutral-600 hidden sm:inline">•</span>
                  <a href="tel:+919591755995" className="text-red-400 hover:text-white transition-colors">
                    Monish (+91 95917 55995)
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  window.location.reload();
                }}
                className="px-6 py-3 bg-transparent border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white font-mono text-xs uppercase font-bold tracking-wider rounded-xl transition-colors"
              >
                REGISTER ANOTHER CREW
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* HERO TITLE */}
            <div className="text-center my-6 sm:my-12 space-y-2 sm:space-y-3">
              <h1 className="text-3xl sm:text-6xl md:text-8xl font-black italic tracking-wider text-white uppercase m-0 leading-tight drop-shadow-[0_0_35px_rgba(255,0,0,0.3)] break-words">
                ENTER THE GRAND PRIX
              </h1>
              <p className="font-mono text-[10px] sm:text-sm text-neutral-400 uppercase tracking-[2px] sm:tracking-[3px]">
                OFFICIAL 4-DRIVER CONSTRUCTOR SQUAD REGISTRATION PORTAL
              </p>
            </div>

            {/* SEMESTER REGISTRATION QUOTA CARDS (2 COLUMNS IN A SINGLE ROW) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 font-mono">
              {/* Card 1: 1st Semester Teams */}
              <div
                className={`bg-[#080808] border rounded-xl p-5 space-y-3 shadow-lg transition-all ${
                  isFirstSemLocked
                    ? "border-red-600/70 bg-red-950/10"
                    : isFirstSemWaitlist
                      ? "border-yellow-500/60 bg-yellow-950/10"
                      : "border-red-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isFirstSemLocked
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          : isFirstSemWaitlist
                            ? "bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                            : "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-black italic tracking-wider text-white uppercase">
                      1ST SEMESTER TEAMS
                    </span>
                  </div>
                  {isFirstSemLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} /> LOCKED
                    </span>
                  ) : isFirstSemWaitlist ? (
                    <span className="px-2.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 text-[10px] font-bold uppercase tracking-wider">
                      WAITLIST
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      OPEN
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {Math.min(semCounts.firstSemCount, maxLimit)}{" "}
                    <span className="text-sm font-bold text-neutral-500">/ {maxLimit} TEAMS</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-bold">
                    {isFirstSemLocked
                      ? `WAITLIST FULL (${waitlistLimit}/${waitlistLimit})`
                      : isFirstSemWaitlist
                        ? `WAITLIST: ${semCounts.firstSemCount - maxLimit}/${waitlistLimit}`
                        : `${Math.max(0, maxLimit - semCounts.firstSemCount)} SLOTS LEFT`}
                  </span>
                </div>

                <div className="w-full bg-[#121212] rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isFirstSemLocked
                        ? "bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                        : isFirstSemWaitlist
                          ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"
                          : "bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_10px_rgba(255,0,0,0.8)]"
                    }`}
                    style={{ width: `${Math.min((semCounts.firstSemCount / maxLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Card 2: 3rd Semester Teams */}
              <div
                className={`bg-[#080808] border rounded-xl p-5 space-y-3 shadow-lg transition-all ${
                  isThirdSemLocked
                    ? "border-red-600/70 bg-red-950/10"
                    : isThirdSemWaitlist
                      ? "border-yellow-500/60 bg-yellow-950/10"
                      : "border-red-900/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isThirdSemLocked
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          : isThirdSemWaitlist
                            ? "bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                            : "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-black italic tracking-wider text-white uppercase">
                      3RD SEMESTER TEAMS
                    </span>
                  </div>
                  {isThirdSemLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} /> LOCKED
                    </span>
                  ) : isThirdSemWaitlist ? (
                    <span className="px-2.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 text-[10px] font-bold uppercase tracking-wider">
                      WAITLIST
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      OPEN
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    {Math.min(semCounts.thirdSemCount, maxLimit)}{" "}
                    <span className="text-sm font-bold text-neutral-500">/ {maxLimit} TEAMS</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-bold">
                    {isThirdSemLocked
                      ? `WAITLIST FULL (${waitlistLimit}/${waitlistLimit})`
                      : isThirdSemWaitlist
                        ? `WAITLIST: ${semCounts.thirdSemCount - maxLimit}/${waitlistLimit}`
                        : `${Math.max(0, maxLimit - semCounts.thirdSemCount)} SLOTS LEFT`}
                  </span>
                </div>

                <div className="w-full bg-[#121212] rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isThirdSemLocked
                        ? "bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                        : isThirdSemWaitlist
                          ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]"
                          : "bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_10px_rgba(255,0,0,0.8)]"
                    }`}
                    style={{ width: `${Math.min((semCounts.thirdSemCount / maxLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* FORM ERROR BANNER */}
            {errorMsg && (
              <div className="p-4 mb-6 rounded-lg bg-red-950/40 border border-red-600 text-red-300 font-mono text-xs flex items-center justify-between shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-neutral-400 hover:text-white uppercase font-bold text-[10px]"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* MAIN RED BORDERED FORM */}
            <form onSubmit={handleSubmit} className="border-2 border-red-600/80 bg-[#060606] rounded-xl p-3.5 sm:p-8 md:p-10 shadow-[0_0_40px_rgba(255,0,0,0.15)] space-y-7 sm:space-y-10">
              {/* SECTION 1: CREW IDENTIFIER & CAPACITY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 font-mono text-xs">
                {/* Team Capacity Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-red-500 uppercase font-bold tracking-wider text-[11px]">
                    TEAM_CAPACITY: PIT CREW (4 MEMBERS) <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full bg-[#0a0a0a] border border-red-900/60 p-3.5 text-neutral-200 rounded flex items-center justify-between">
                    <span className="flex items-center gap-2 text-white font-bold">
                      🏁 CONSTRUCTOR TEAM (4 DRIVERS)
                    </span>
                    <span className="text-[10px] text-red-500 uppercase">LOCKED</span>
                  </div>
                </div>

                {/* Team Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-red-500 uppercase font-bold tracking-wider text-[11px]">
                    DATABASE_ID: CONSTRUCTOR TEAM NAME <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="ENTER SQUAD IDENTIFIER (e.g. ApexPredators)"
                    className="w-full bg-[#0a0a0a] border border-red-900/60 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white p-3.5 rounded outline-none font-mono text-xs tracking-wider placeholder:text-neutral-600"
                  />
                </div>
              </div>

              {/* SEMESTER ELIGIBILITY & TEAM COMPOSITION POLICY BANNER */}
              <div className="p-4 sm:p-5 bg-red-950/20 border border-red-600/40 rounded-xl space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-xs">
                  <ShieldAlert size={16} className="text-red-500 shrink-0" />
                  <span>SEMESTER ELIGIBILITY &amp; TEAM COMPOSITION POLICY</span>
                </div>
                <p className="text-neutral-300 leading-relaxed text-[11px] sm:text-xs m-0">
                  To ensure fair competition across all participating squads, each team must consist strictly of members from the same semester:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 bg-black/60 border border-neutral-800 rounded">
                    <span className="text-white font-bold block uppercase text-[11px]">1ST YEAR TEAMS (40 SLOTS)</span>
                    <span className="text-neutral-400 text-[10px]">All 4 members must be currently enrolled in 1st Semester.</span>
                  </div>
                  <div className="p-2.5 bg-black/60 border border-neutral-800 rounded">
                    <span className="text-white font-bold block uppercase text-[11px]">2ND YEAR TEAMS (40 SLOTS)</span>
                    <span className="text-neutral-400 text-[10px]">All 4 members must be currently enrolled in 3rd Semester (2nd Year).</span>
                  </div>
                </div>
                <p className="text-yellow-400 font-bold text-[10px] sm:text-[11px] m-0 pt-2 border-t border-red-900/40">
                  ⚠ IMPORTANT: Mixed semester teams and senior-junior combinations are strictly prohibited. Selecting the Team Captain&apos;s semester automatically sets and locks the semester for all 4 team members.
                </p>
              </div>

              {/* SECTION 2: DRIVER 1 (CAPTAIN) */}
              <div className="space-y-4 pt-4 border-t border-red-950/40">
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-white m-0 flex items-center gap-2">
                  <span className="text-red-600">//</span> DRIVER 1 (CAPTAIN)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      FULL_NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver1.name}
                      onChange={(e) => setDriver1({ ...driver1, name: e.target.value })}
                      placeholder="ENTER FULL NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      USN (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={driver1.usn}
                      onChange={(e) => setDriver1({ ...driver1, usn: e.target.value })}
                      placeholder="ENTER USN (OPTIONAL FOR 1ST YEAR)"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      EMAIL_ADDRESS <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={driver1.email}
                      onChange={(e) => setDriver1({ ...driver1, email: e.target.value })}
                      placeholder="ENTER EMAIL ADDRESS"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      PHONE_NUMBER (10 DIGITS) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={driver1.phone}
                      onChange={(e) => setDriver1({ ...driver1, phone: e.target.value.replace(/\D/g, "") })}
                      placeholder="ENTER 10 DIGIT PHONE"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      BRANCH <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver1.branch}
                      onChange={(e) => setDriver1({ ...driver1, branch: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b} className="bg-black text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      SEMESTER <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver1.sem}
                      onChange={(e) => handleCaptainSemChange(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {SEMESTERS.map((s) => {
                        const isSemWaitlist =
                          (s.includes("1st") && isFirstSemWaitlist) ||
                          (s.includes("3rd") && isThirdSemWaitlist);
                        const isSemLocked =
                          (s.includes("1st") && isFirstSemLocked) ||
                          (s.includes("3rd") && isThirdSemLocked);
                        return (
                          <option
                            key={s}
                            value={s}
                            disabled={isSemLocked}
                            className="bg-black text-white disabled:text-neutral-600"
                          >
                            {isSemLocked
                              ? `${s} (LOCKED - FULL)`
                              : isSemWaitlist
                                ? `${s} (WAITLIST OPEN)`
                                : s}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>COLLEGE / INSTITUTION <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> VVCE EXCLUSIVE
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value="Vidya Vardhaka College Of Engineering"
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: DRIVER 2 (AERODYNAMICS) */}
              <div className="space-y-4 pt-4 border-t border-red-950/40">
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-white m-0 flex items-center gap-2">
                  <span className="text-red-600">//</span> DRIVER 2 (AERODYNAMICS)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_NAME_2 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver2.name}
                      onChange={(e) => setDriver2({ ...driver2, name: e.target.value })}
                      placeholder="ENTER FULL NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      USN_2 (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={driver2.usn}
                      onChange={(e) => setDriver2({ ...driver2, usn: e.target.value })}
                      placeholder="ENTER USN (OPTIONAL FOR 1ST YEAR)"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_EMAIL_2 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={driver2.email}
                      onChange={(e) => setDriver2({ ...driver2, email: e.target.value })}
                      placeholder="ENTER EMAIL ADDRESS"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      PHONE_2 (10 DIGITS) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={driver2.phone}
                      onChange={(e) => setDriver2({ ...driver2, phone: e.target.value.replace(/\D/g, "") })}
                      placeholder="ENTER 10 DIGIT PHONE"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      BRANCH_2 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver2.branch}
                      onChange={(e) => setDriver2({ ...driver2, branch: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b} className="bg-black text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>SEMESTER_2 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> SEMESTER LOCKED (MATCHES CAPTAIN)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={driver1.sem}
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>COLLEGE_2 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> VVCE EXCLUSIVE
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value="Vidya Vardhaka College Of Engineering"
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: DRIVER 3 (POWERTRAIN) */}
              <div className="space-y-4 pt-4 border-t border-red-950/40">
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-white m-0 flex items-center gap-2">
                  <span className="text-red-600">//</span> DRIVER 3 (POWERTRAIN)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_NAME_3 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver3.name}
                      onChange={(e) => setDriver3({ ...driver3, name: e.target.value })}
                      placeholder="ENTER FULL NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      USN_3 (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={driver3.usn}
                      onChange={(e) => setDriver3({ ...driver3, usn: e.target.value })}
                      placeholder="ENTER USN (OPTIONAL FOR 1ST YEAR)"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_EMAIL_3 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={driver3.email}
                      onChange={(e) => setDriver3({ ...driver3, email: e.target.value })}
                      placeholder="ENTER EMAIL ADDRESS"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      PHONE_3 (10 DIGITS) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={driver3.phone}
                      onChange={(e) => setDriver3({ ...driver3, phone: e.target.value.replace(/\D/g, "") })}
                      placeholder="ENTER 10 DIGIT PHONE"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      BRANCH_3 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver3.branch}
                      onChange={(e) => setDriver3({ ...driver3, branch: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b} className="bg-black text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>SEMESTER_3 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> SEMESTER LOCKED (MATCHES CAPTAIN)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={driver1.sem}
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>COLLEGE_3 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> VVCE EXCLUSIVE
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value="Vidya Vardhaka College Of Engineering"
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: DRIVER 4 (TELEMETRY) */}
              <div className="space-y-4 pt-4 border-t border-red-950/40">
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-white m-0 flex items-center gap-2">
                  <span className="text-red-600">//</span> DRIVER 4 (TELEMETRY)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_NAME_4 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver4.name}
                      onChange={(e) => setDriver4({ ...driver4, name: e.target.value })}
                      placeholder="ENTER FULL NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      USN_4 (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={driver4.usn}
                      onChange={(e) => setDriver4({ ...driver4, usn: e.target.value })}
                      placeholder="ENTER USN (OPTIONAL FOR 1ST YEAR)"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      DRIVER_EMAIL_4 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={driver4.email}
                      onChange={(e) => setDriver4({ ...driver4, email: e.target.value })}
                      placeholder="ENTER EMAIL ADDRESS"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      PHONE_4 (10 DIGITS) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={driver4.phone}
                      onChange={(e) => setDriver4({ ...driver4, phone: e.target.value.replace(/\D/g, "") })}
                      placeholder="ENTER 10 DIGIT PHONE"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      BRANCH_4 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver4.branch}
                      onChange={(e) => setDriver4({ ...driver4, branch: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b} className="bg-black text-white">
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>SEMESTER_4 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> SEMESTER LOCKED (MATCHES CAPTAIN)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value={driver1.sem}
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="flex items-center justify-between text-red-500 uppercase text-[11px] font-bold">
                      <span>COLLEGE_4 <span className="text-red-500">*</span></span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-normal">
                        <Lock size={10} className="text-red-500" /> VVCE EXCLUSIVE
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly
                      value="Vidya Vardhaka College Of Engineering"
                      className="w-full bg-[#050505] border border-neutral-800/80 text-neutral-300 font-bold p-3 rounded outline-none text-xs cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: GRAND PRIX ENTRY FEE & PAYMENT VERIFICATION (OR WAITING LIST NOTICE) */}
              {isSelectedSemWaitlist ? (
                <div className="space-y-4 pt-6 border-t-2 border-yellow-500/60 bg-yellow-950/15 p-6 sm:p-8 rounded-xl border border-yellow-500/40 font-mono">
                  <div className="flex items-start gap-3 border-b border-yellow-500/20 pb-3">
                    <AlertCircle className="text-yellow-400 mt-0.5 shrink-0" size={22} />
                    <div>
                      <h3 className="font-heading text-lg sm:text-xl text-yellow-400 uppercase m-0 tracking-wide">
                        WAITING LIST REGISTRATION ({driver1.sem.toUpperCase()})
                      </h3>
                      <p className="text-xs text-yellow-200/80 m-0 mt-1">
                        Waitlist Slot:{" "}
                        <strong className="text-white">
                          #{(driver1.sem.includes("1st") ? semCounts.firstSemCount : semCounts.thirdSemCount) - maxLimit + 1} of {waitlistLimit}
                        </strong>{" "}
                        — Payment is NOT required right now
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed m-0">
                    <strong className="text-yellow-400">Please note that registering on the waiting list does not guarantee a slot for participation.</strong> 40 team slots are full, but you can register your team where you will be placed on the waiting list. If any of the confirmed slots team is unable to participate, waiting list teams will be contacted for the payment procedure and participation.
                  </p>
                </div>
              ) : isSelectedSemLocked ? null : (
              <div className="space-y-5 pt-6 border-t-2 border-red-600/60 bg-[#080808]/90 p-4 sm:p-6 rounded-xl border border-red-900/40">
                <div className="flex items-start gap-3 border-b border-red-950/60 pb-3">
                  <CreditCard className="text-red-500 mt-1 shrink-0" size={20} />
                  <div>
                    <h3 className="font-heading text-lg sm:text-xl text-white uppercase m-0 tracking-wide">
                      GRAND PRIX ENTRY FEE: ₹400 PER TEAM
                    </h3>
                    <p className="font-mono text-xs text-neutral-400 m-0 mt-0.5">
                      SCAN OFFICIAL UPI QR CODE, ENTER 12-DIGIT UTR, AND UPLOAD PAYMENT SCREENSHOT
                    </p>
                  </div>
                </div>

                {/* ROW 1: QR CODE & RECEIVING BENEFICIARY DETAILS SIDE BY SIDE */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch font-mono text-xs">
                  {/* Left Column: QR Code & Coordinator Details */}
                  <div className="lg:col-span-5 bg-[#040404] border border-red-900/60 p-5 rounded-lg text-center flex flex-col justify-between space-y-3">
                    <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider m-0">
                      SCAN TO PAY ₹400 VIA GOOGLE PAY / PHONEPE / PAYTM
                    </p>

                    <div className="inline-block p-2 bg-white rounded border-2 border-red-600 shadow-[0_0_20px_rgba(255,0,0,0.3)] my-1 mx-auto">
                      {paymentQrDataUrl ? (
                        <Image
                          src={paymentQrDataUrl}
                          alt="Official UPI QR Code"
                          width={180}
                          height={180}
                          className="w-40 h-40 sm:w-44 sm:h-44 object-contain"
                        />
                      ) : (
                        <div className="w-40 h-40 sm:w-44 sm:h-44 bg-neutral-900 flex items-center justify-center text-neutral-500 text-[10px]">
                          Generating UPI QR...
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] text-neutral-300 font-bold m-0">
                        COORDINATOR: <span className="text-white">Monish N Kumar (+91 95917 55995)</span>
                      </p>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-neutral-800 rounded text-[10px] transition-colors"
                      >
                        {copiedUpi ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        <span>{copiedUpi ? "UPI ID COPIED" : "COPY UPI ID: 6361455193@okbizaxis"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column (Next to QR): Receiving Account Details for Participants to Confirm */}
                  <div className="lg:col-span-7 bg-[#040404] border border-red-900/60 p-5 rounded-lg flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-red-950/80 pb-2.5">
                      <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-wider text-xs">
                        <ShieldCheck size={16} />
                        <span>RECEIVING ACCOUNT CONFIRMATION</span>
                      </div>
                      <span className="text-[10px] text-green-400 border border-green-500/30 bg-green-950/30 px-2 py-0.5 rounded font-bold">
                        VERIFIED RECEIVER
                      </span>
                    </div>

                    <div className="p-2.5 bg-yellow-950/20 border border-yellow-900/40 rounded text-yellow-300/90 text-[11px] leading-relaxed">
                      ⚠ <strong>Important:</strong> Please confirm that the receiver name matches the verified beneficiary below on your UPI app (Google Pay, PhonePe, Paytm, or BHIM) before approving the payment.
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">BENEFICIARY / RECEIVER NAME:</span>
                        <span className="text-white font-bold text-xs tracking-wider">Parinitha K</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">OFFICIAL RECEIVING UPI ID:</span>
                        <span className="text-yellow-400 font-mono font-bold text-xs break-all">6361455193@okbizaxis</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">RECEIVING BANK / ACCOUNT:</span>
                        <span className="text-neutral-200 font-bold text-xs">Axis Bank (Current A/c)</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">ENTRY REGISTRATION FEE:</span>
                        <span className="text-green-400 font-black text-xs">₹400.00 (Fixed per Team)</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">PAYMENT DESK COORDINATOR:</span>
                        <span className="text-neutral-300 text-xs">Monish N Kumar (+91 95917 55995)</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-neutral-500 m-0 italic">
                      * Official QR, UPI ID and Receiving Account credentials are authenticated for Ideathon registration.
                    </p>
                  </div>
                </div>

                {/* ROW 2: TRANSACTION NUMBER ENTRY & SCREENSHOT UPLOAD (Moved Below QR) */}
                <div className="pt-6 border-t border-red-950/60 space-y-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                    <span className="text-red-500">//</span>
                    <span>SUBMIT TRANSACTION NUMBER &amp; PAYMENT PROOF</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-red-500 uppercase text-[11px] font-bold">
                        TRANSACTION_UTR_NO (12 DIGITS) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentUtr}
                        onChange={(e) => setPaymentUtr(e.target.value.trim())}
                        placeholder="ENTER 12-DIGIT UPI REFERENCE / UTR NO"
                        className="w-full bg-[#0a0a0a] border border-red-900/60 focus:border-red-500 text-white p-3.5 rounded outline-none text-xs font-mono tracking-wider placeholder:text-neutral-600"
                      />
                      <p className="text-[10px] text-neutral-500 m-0">
                        Found in your payment app under &quot;UPI Ref No.&quot; or &quot;UTR&quot;.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-red-500 uppercase text-[11px] font-bold">
                        PAYMENT_SCREENSHOT_IMAGE <span className="text-red-500">*</span>
                      </label>

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-red-900/60 hover:border-red-500 bg-[#0a0a0a] p-4 rounded-lg text-center cursor-pointer transition-all space-y-1.5 group"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/png,image/jpeg,image/jpg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleFileChange(file);
                          }}
                        />

                        {previewUrl ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative w-20 h-20 rounded border border-red-500/50 overflow-hidden">
                              <Image
                                src={previewUrl}
                                alt="Proof Preview"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <span className="text-[11px] text-green-400 font-bold flex items-center gap-1">
                              <FileCheck size={13} /> Proof Attached: {paymentFile?.name}
                            </span>
                            <span className="text-[10px] text-neutral-500 underline group-hover:text-neutral-300">
                              Click to replace
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                            <UploadCloud size={24} className="text-red-500 group-hover:scale-110 transition-transform" />
                            <p className="text-xs font-bold text-white uppercase m-0">
                              CLICK OR DRAG TO UPLOAD PAYMENT SCREENSHOT *
                            </p>
                            <p className="text-[10px] text-neutral-500 m-0">
                              Supports PNG, JPG, JPEG (Max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* SECTION 7: BOTTOM GRAND PRIX ENTRY SUMMARY & SUBMIT */}
              <div className="pt-6 border-t border-red-950/60 text-center space-y-4">
                {!isSelectedSemWaitlist && !isSelectedSemLocked && (
                  <div className="space-y-1">
                    <p className="font-mono text-xs uppercase tracking-[3px] text-neutral-400 m-0">
                      GRAND PRIX ENTRY FEE
                    </p>
                    <p className="text-4xl sm:text-5xl font-black text-white italic tracking-wider m-0">
                      ₹400
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || isSelectedSemLocked}
                  className={`w-full py-4 sm:py-5 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none disabled:cursor-not-allowed text-white font-black italic uppercase tracking-widest text-base sm:text-lg rounded transition-all cursor-pointer flex items-center justify-center gap-3 ${
                    isSelectedSemWaitlist
                      ? "bg-yellow-600 hover:bg-yellow-500 text-black shadow-[0_0_30px_rgba(234,179,8,0.4)]"
                      : "bg-red-600 hover:bg-red-500 shadow-[0_0_30px_rgba(255,0,0,0.5)]"
                  }`}
                >
                  {submitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isSelectedSemWaitlist ? "JOINING WAITING LIST..." : "LOCKING IN GRID POSITION..."}</span>
                    </>
                  ) : isAllLocked ? (
                    <>
                      <Lock size={20} />
                      <span>REGISTRATION LOCKED — ALL SLOTS FULL</span>
                    </>
                  ) : isSelectedSemLocked ? (
                    <>
                      <Lock size={20} />
                      <span>{driver1.sem.toUpperCase()} SLOTS FULL (LOCKED)</span>
                    </>
                  ) : isSelectedSemWaitlist ? (
                    <span>JOIN WAITING LIST &gt;&gt;</span>
                  ) : (
                    <span>LOCK IN GRID POSITION &gt;&gt;</span>
                  )}
                </button>

                {/* TRANSACTION VERIFICATION & CONTACT QUERIES NOTICE */}
                <div className="mt-8 p-5 sm:p-6 bg-[#080808] border border-red-900/50 rounded-xl space-y-3 font-mono text-center shadow-lg">
                  <p className="text-xs sm:text-sm text-yellow-400 font-bold tracking-wide m-0">
                    {isSelectedSemWaitlist
                      ? "Waiting list teams will be contacted for the payment procedure if any confirmed slot team is unable to participate."
                      : "Once the Transaction is verified, the login credentials will be shared to the Team Lead's email."}
                  </p>

                  <div className="pt-3 border-t border-neutral-800/80">
                    <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mb-2">
                      For any queries contact:
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs">
                      <a href="tel:+918310353103" className="text-neutral-300 hover:text-red-400 transition-colors">
                        <span className="text-white font-bold">Moksh</span> - +91 831 035 3103
                      </a>
                      <span className="text-neutral-700 hidden sm:inline">•</span>
                      <a href="tel:+916361455193" className="text-neutral-300 hover:text-red-400 transition-colors">
                        <span className="text-white font-bold">Parinitha</span> - +91 63614 55193
                      </a>
                      <span className="text-neutral-700 hidden sm:inline">•</span>
                      <a href="tel:+919591755995" className="text-neutral-300 hover:text-red-400 transition-colors">
                        <span className="text-white font-bold">Monish</span> - +91 95917 55995
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </>
        )}
      </main>

      {/* Cyberpunk Relayathon Footer with ECE Dept Affiliation */}
      <RelayathonFooter />
    </div>
  );
}

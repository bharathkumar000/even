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
  Zap,
  ShieldCheck,
  Users,
} from "lucide-react";
import { submitTeamRegistration, TeamMemberInput } from "@/app/actions/team-registration";

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
  branch: "CSE",
  sem: "5th Sem",
  college: "VVCE Mysore",
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
  "Other / Outside College",
];

const SEMESTERS = [
  "1st Semester",
  "2nd Semester",
  "3rd Semester",
  "4th Semester",
  "5th Semester",
  "6th Semester",
  "7th Semester",
  "8th Semester",
];

const DOMAINS = [
  {
    id: "CSE/AIML",
    title: "CSE / AIML Track",
    subtitle: "AI, Machine Learning, Web3, Distributed Cloud & Intelligent Systems",
  },
  {
    id: "ECE/EEE",
    title: "ECE / EEE Track",
    subtitle: "IoT, Embedded Robotics, Smart Grid, Hardware & VLSI Design",
  },
  {
    id: "MECH/CIVIL",
    title: "Mech / Civil Track",
    subtitle: "Smart Infrastructure, Clean Energy, EV Design & Automation",
  },
  {
    id: "CYBER_SECURITY",
    title: "Cyber Security & Defense",
    subtitle: "Ethical Hacking, Cryptography, Network Defense & Zero Trust",
  },
  {
    id: "OPEN_INNOVATION",
    title: "Open Innovation & FinTech",
    subtitle: "Cross-Disciplinary Technology Solutions & Novel Startups",
  },
];

const TICKER_SQUADS = [
  { name: "NEON_HUNTERS", track: "CYBER SECURITY" },
  { name: "APEX_VELOCITY", track: "CSE / AIML" },
  { name: "QUANTUM_GRID", track: "ECE / EEE" },
  { name: "TURBO_KINETIX", track: "MECH / CIVIL" },
  { name: "CYBER_DYNE", track: "OPEN INNOVATION" },
];

export default function RegisterClientView() {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ teamName: string; refId: string } | null>(null);

  // Live Squad Ticker State
  const [tickerIndex, setTickerIndex] = useState(0);
  const [registeredSquadsCount, setRegisteredSquadsCount] = useState(24);

  // Squad / Team Identity
  const [teamName, setTeamName] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("CSE/AIML");

  // Driver 1 (Captain)
  const [driver1, setDriver1] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  // Drivers 2, 3, 4
  const [driver2, setDriver2] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  const [driver3, setDriver3] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  const [driver4, setDriver4] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  // Payment
  const [paymentUtr, setPaymentUtr] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate ticker squad notifications every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % TICKER_SQUADS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Generate crisp UPI QR Code for payment
  useEffect(() => {
    // Official UPI Payment Link with amount ₹400
    const upiLink = "upi://pay?pa=6361455193@okbizaxis&pn=Parinitha%20K&am=400&cu=INR&tn=Eventra%20Circuit%20Entry%20Fee";
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

    // Validate Payment
    if (!paymentUtr.trim() || paymentUtr.trim().length < 6) {
      setErrorMsg("CIRCUIT ENTRY: Please enter a valid 12-digit UPI Reference / UTR Number.");
      return false;
    }
    if (!paymentFile) {
      setErrorMsg("CIRCUIT ENTRY: Please upload your payment screenshot proof.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          usn: driver2.usn.trim() || "N/A",
          college: driver2.college.trim(),
          branch: driver2.branch,
          sem: driver2.sem,
        },
        {
          name: driver3.name.trim(),
          email: driver3.email.trim().toLowerCase(),
          usn: driver3.usn.trim() || "N/A",
          college: driver3.college.trim(),
          branch: driver3.branch,
          sem: driver3.sem,
        },
        {
          name: driver4.name.trim(),
          email: driver4.email.trim().toLowerCase(),
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
        setSuccessData({
          teamName: teamName.trim(),
          refId: res.registrationId || "SQUAD-" + Date.now().toString().slice(-6),
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

  const activeSquad = TICKER_SQUADS[tickerIndex];

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
        {/* SUCCESS CONFIRMATION MODAL / SCREEN */}
        {successData ? (
          <div className="border-2 border-red-600 bg-[#080808] p-8 sm:p-12 rounded-xl text-center space-y-6 shadow-[0_0_50px_rgba(255,0,0,0.25)] animate-fade-in my-10">
            <div className="w-16 h-16 bg-red-600/20 text-red-500 border border-red-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,0,0,0.3)]">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs uppercase text-red-400 tracking-[3px] font-bold">
                GRID POSITION LOCKED // REGISTRATION SUBMITTED
              </span>
              <h1 className="text-3xl sm:text-4xl font-black italic uppercase text-white tracking-wide">
                WELCOME TO THE GRID, {successData.teamName}
              </h1>
              <p className="font-mono text-sm text-neutral-400 max-w-xl mx-auto">
                Your squad details, 12-digit UTR, and payment proof have been successfully registered into the Eventra database and Google Sheets.
              </p>
            </div>

            <div className="p-4 bg-black/60 border border-red-600/40 rounded-lg max-w-md mx-auto font-mono text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-neutral-500">CONSTRUCTOR SQUAD:</span>
                <span className="text-white font-bold">{successData.teamName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">REGISTRATION REF:</span>
                <span className="text-red-400 font-bold">{successData.refId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">VERIFICATION:</span>
                <span className="text-yellow-400 font-bold">Manual UTR Cross-Check In Progress</span>
              </div>
            </div>

            <p className="font-mono text-xs text-neutral-500 max-w-md mx-auto">
              Once the admin confirms receipt of your ₹400 entry fee, your team credentials and official QR Pass will be activated and emailed to your Captain ({driver1.email}).
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black italic uppercase tracking-wider text-sm rounded transition-all shadow-[0_0_20px_rgba(255,0,0,0.4)]"
              >
                PROCEED TO SQUAD LOGIN &gt;&gt;
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSuccessData(null);
                  window.location.reload();
                }}
                className="px-6 py-3 bg-transparent border border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white font-mono text-xs uppercase font-bold tracking-wider rounded transition-colors"
              >
                REGISTER ANOTHER CREW
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* HERO TITLE */}
            <div className="text-center my-8 sm:my-12 space-y-3">
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black italic tracking-wider text-white uppercase m-0 leading-none drop-shadow-[0_0_35px_rgba(255,0,0,0.3)]">
                ENTER THE GRAND PRIX
              </h1>
              <p className="font-mono text-xs sm:text-sm text-neutral-400 uppercase tracking-[3px]">
                OFFICIAL 4-DRIVER CONSTRUCTOR SQUAD REGISTRATION PORTAL
              </p>
            </div>

            {/* LIVE SQUAD INTEGRATION TICKER */}
            <div className="bg-[#080808] border border-red-900/40 rounded-xl p-4 mb-8 font-mono space-y-2 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-2 text-red-500 font-bold tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  LIVE SQUAD INTEGRATION
                </span>
                <span className="text-neutral-400 font-bold">
                  {registeredSquadsCount} / 100 CREWS INFILTRATED
                </span>
              </div>

              {/* Glowing Progress bar */}
              <div className="w-full bg-[#121212] rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(255,0,0,0.8)]"
                  style={{ width: `${Math.min(registeredSquadsCount, 100)}%` }}
                />
              </div>

              {/* Ticker status */}
              <div className="text-[11px] text-neutral-400 flex items-center gap-2 pt-0.5">
                <Zap size={13} className="text-red-500 shrink-0" />
                <span>
                  <strong className="text-white">[RECRUITED] {activeSquad.name}</strong> has declared targets for{" "}
                  <span className="text-red-400 font-bold">{activeSquad.track}</span>
                </span>
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
            <form onSubmit={handleSubmit} className="border-2 border-red-600/80 bg-[#060606] rounded-xl p-5 sm:p-8 md:p-10 shadow-[0_0_40px_rgba(255,0,0,0.15)] space-y-10">
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
                      onChange={(e) => setDriver1({ ...driver1, sem: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s} className="bg-black text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE / INSTITUTION <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver1.college}
                      onChange={(e) => setDriver1({ ...driver1, college: e.target.value })}
                      placeholder="ENTER COLLEGE NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      SEMESTER_2 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver2.sem}
                      onChange={(e) => setDriver2({ ...driver2, sem: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s} className="bg-black text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_2 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver2.college}
                      onChange={(e) => setDriver2({ ...driver2, college: e.target.value })}
                      placeholder="ENTER COLLEGE NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      SEMESTER_3 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver3.sem}
                      onChange={(e) => setDriver3({ ...driver3, sem: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s} className="bg-black text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_3 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver3.college}
                      onChange={(e) => setDriver3({ ...driver3, college: e.target.value })}
                      placeholder="ENTER COLLEGE NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      SEMESTER_4 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={driver4.sem}
                      onChange={(e) => setDriver4({ ...driver4, sem: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs"
                    >
                      {SEMESTERS.map((s) => (
                        <option key={s} value={s} className="bg-black text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_4 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver4.college}
                      onChange={(e) => setDriver4({ ...driver4, college: e.target.value })}
                      placeholder="ENTER COLLEGE NAME"
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: SELECT TARGET MISSION */}
              <div className="space-y-4 pt-4 border-t border-red-950/40">
                <h3 className="text-xl sm:text-2xl font-black italic tracking-wide uppercase text-white m-0 flex items-center gap-2">
                  <span className="text-red-600">//</span> SELECT TARGET MISSION
                </h3>

                <div className="space-y-2 font-mono">
                  <label className="block text-red-500 uppercase text-[11px] font-bold">
                    OPERATIVE_TARGET: MISSION DOMAIN <span className="text-red-500">*</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DOMAINS.map((d) => {
                      const isSelected = selectedDomain === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedDomain(d.id)}
                          className={`p-3.5 rounded border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "bg-red-950/40 border-red-500 text-white shadow-[0_0_15px_rgba(255,0,0,0.3)]"
                              : "bg-[#0a0a0a] border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs uppercase">{d.title}</span>
                            <span
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                isSelected ? "border-red-500 bg-red-600" : "border-neutral-700"
                              }`}
                            >
                              {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-500 line-clamp-2 leading-tight">
                            {d.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION 7: CIRCUIT ENTRY FEE & PAYMENT VERIFICATION */}
              <div className="space-y-5 pt-6 border-t-2 border-red-600/60 bg-[#080808]/90 p-4 sm:p-6 rounded-xl border border-red-900/40">
                <div className="flex items-start gap-3 border-b border-red-950/60 pb-3">
                  <CreditCard className="text-red-500 mt-1 shrink-0" size={20} />
                  <div>
                    <h3 className="font-heading text-lg sm:text-xl text-white uppercase m-0 tracking-wide">
                      CIRCUIT ENTRY FEE: ₹400 PER TEAM
                    </h3>
                    <p className="font-mono text-xs text-neutral-400 m-0 mt-0.5">
                      SCAN OFFICIAL UPI QR CODE, ENTER 12-DIGIT UTR, AND UPLOAD PAYMENT SCREENSHOT
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-mono text-xs">
                  {/* Left Column: QR Code & Coordinator Details */}
                  <div className="lg:col-span-5 bg-[#040404] border border-red-900/60 p-5 rounded-lg text-center space-y-3">
                    <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider m-0">
                      SCAN TO PAY ₹400 VIA GOOGLE PAY / PHONEPE / PAYTM
                    </p>

                    <div className="inline-block p-2 bg-white rounded border-2 border-red-600 shadow-[0_0_20px_rgba(255,0,0,0.3)] my-1">
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

                    <div className="space-y-1">
                      <p className="text-[11px] text-neutral-300 font-bold m-0">
                        COORDINATOR: <span className="text-white">Parinitha K (+91 6361455193)</span>
                      </p>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 border border-neutral-800 rounded text-[10px] transition-colors"
                      >
                        {copiedUpi ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        <span>{copiedUpi ? "UPI ID COPIED" : "COPY UPI ID: 6361455193@okbizaxis"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: UTR Input & Screenshot Upload */}
                  <div className="lg:col-span-7 space-y-4">
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
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-red-500 uppercase text-[11px] font-bold">
                        PAYMENT_SCREENSHOT_IMAGE <span className="text-red-500">*</span>
                      </label>

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-red-900/60 hover:border-red-500 bg-[#0a0a0a] p-5 rounded-lg text-center cursor-pointer transition-all space-y-2 group"
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
                            <div className="relative w-24 h-24 rounded border border-red-500/50 overflow-hidden">
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
                          <div className="flex flex-col items-center gap-2 text-neutral-400">
                            <UploadCloud size={28} className="text-red-500 group-hover:scale-110 transition-transform" />
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

                    <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded text-[11px] text-blue-300/90 flex items-start gap-2">
                      <span className="text-blue-400 shrink-0 font-bold">ℹ</span>
                      <span>
                        Both your 12-digit UTR and payment screenshot will be recorded in Google Sheets. Organizers will manually cross-verify and approve your squad.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 8: BOTTOM CIRCUIT ENTRY SUMMARY & SUBMIT */}
              <div className="pt-6 border-t border-red-950/60 text-center space-y-4">
                <div className="space-y-1">
                  <p className="font-mono text-xs uppercase tracking-[3px] text-neutral-400 m-0">
                    CIRCUIT ENTRY FEE
                  </p>
                  <p className="text-4xl sm:text-5xl font-black text-white italic tracking-wider m-0">
                    ₹400
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 sm:py-5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black italic uppercase tracking-widest text-base sm:text-lg rounded transition-all shadow-[0_0_30px_rgba(255,0,0,0.5)] cursor-pointer flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>LOCKING IN GRID POSITION...</span>
                    </>
                  ) : (
                    <span>LOCK IN GRID POSITION &gt;&gt;</span>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

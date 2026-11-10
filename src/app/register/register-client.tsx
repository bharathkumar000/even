"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  ShieldCheck,
  CreditCard,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  UserCheck,
  Building,
  GraduationCap,
  BookOpen,
  Phone,
  Mail,
  Hash,
  QrCode,
  FileText,
  Lock,
} from "lucide-react";
import { submitTeamRegistration, TeamMemberInput } from "@/app/actions/team-registration";

interface MemberFormState {
  name: string;
  email: string;
  usn: string;
  college: string;
  branch: string;
  sem: string;
}

const DEFAULT_MEMBER: MemberFormState = {
  name: "",
  email: "",
  usn: "",
  college: "",
  branch: "",
  sem: "5th Sem",
};

const DOMAINS = [
  {
    id: "CSE/AIML",
    title: "CSE / AIML Track",
    desc: "AI, Machine Learning, Web3, Distributed Cloud & Intelligent Systems",
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/40 text-cyan-400",
  },
  {
    id: "ECE/EEE",
    title: "ECE / EEE Track",
    desc: "IoT, Embedded Robotics, Smart Grid, Hardware & VLSI Design",
    color: "from-pink-500/20 to-purple-500/20 border-pink-500/40 text-pink-400",
  },
  {
    id: "Mech/Civil",
    title: "Mech / Civil Track",
    desc: "Smart Infrastructure, Clean Energy, EV Design & Automation",
    color: "from-amber-500/20 to-yellow-500/20 border-amber-500/40 text-amber-400",
  },
];

export default function RegisterClientView() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ teamName: string; refId: string } | null>(null);

  // Form State
  const [teamName, setTeamName] = useState("");
  const [track, setTrack] = useState("CSE/AIML");

  // Leader State
  const [leader, setLeader] = useState<MemberFormState & { phone: string }>({
    ...DEFAULT_MEMBER,
    phone: "",
    sem: "5th Sem",
  });

  // Additional 3 Members State
  const [members, setMembers] = useState<MemberFormState[]>([
    { ...DEFAULT_MEMBER, sem: "5th Sem" },
    { ...DEFAULT_MEMBER, sem: "5th Sem" },
    { ...DEFAULT_MEMBER, sem: "5th Sem" },
  ]);

  // Payment State
  const [paymentUtr, setPaymentUtr] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleMemberChange = (index: number, field: keyof MemberFormState, value: string) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("Payment proof file size must be under 10MB.");
        return;
      }
      setPaymentFile(file);
      setErrorMsg(null);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const validateStep = (currentStep: number): boolean => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!teamName.trim() || teamName.length < 3) {
        setErrorMsg("Please enter a valid Team Name (at least 3 characters).");
        return false;
      }
      if (!track) {
        setErrorMsg("Please select an event track.");
        return false;
      }
    } else if (currentStep === 2) {
      if (!leader.name.trim() || !leader.email.trim() || !leader.phone.trim() || !leader.usn.trim()) {
        setErrorMsg("All Team Leader fields (Name, Email, Phone, College, USN, Branch, Sem) are required.");
        return false;
      }
      if (!leader.email.includes("@")) {
        setErrorMsg("Please provide a valid email address for Team Leader.");
        return false;
      }
    } else if (currentStep === 3) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m.name.trim() || !m.email.trim() || !m.usn.trim() || !m.college.trim()) {
          setErrorMsg(`Please complete all fields for Member ${i + 2}. Total 4 members are required.`);
          return false;
        }
        if (!m.email.includes("@")) {
          setErrorMsg(`Please enter a valid email for Member ${i + 2}.`);
          return false;
        }
      }
    } else if (currentStep === 4) {
      if (!paymentUtr.trim() || paymentUtr.length < 6) {
        setErrorMsg("Please enter a valid Payment Reference / UTR Number.");
        return false;
      }
      if (!paymentPhone.trim()) {
        setErrorMsg("Please enter the Phone Number used to make the payment.");
        return false;
      }
      if (!paymentFile) {
        setErrorMsg("Please upload your payment screenshot proof.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5) as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(prev - 1, 1) as any);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("teamName", teamName);
      formData.append("track", track);

      // Leader
      formData.append("leaderName", leader.name);
      formData.append("leaderEmail", leader.email);
      formData.append("leaderPhone", leader.phone);
      formData.append("leaderCollege", leader.college);
      formData.append("leaderUsn", leader.usn);
      formData.append("leaderBranch", leader.branch);
      formData.append("leaderSem", leader.sem);

      // 3 Members
      formData.append("membersJson", JSON.stringify(members));

      // Payment
      formData.append("paymentUtr", paymentUtr);
      formData.append("paymentPhone", paymentPhone);
      if (paymentFile) {
        formData.append("paymentProof", paymentFile);
      }

      const res = await submitTeamRegistration(formData);

      if (res.success) {
        setSuccessData({
          teamName,
          refId: res.registrationId || "IVC-REG-" + Date.now().toString().slice(-6),
        });
      } else {
        setErrorMsg(res.message || "Failed to submit registration. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (successData) {
    return (
      <main className="min-h-screen bg-[#050508] text-text-primary flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-[#0a0a10] border border-cyan-500/30 rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden shadow-[0_0_50px_rgba(0,245,255,0.1)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-cyan-400 animate-pulse" />

          <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/40 rounded-full flex items-center justify-center mx-auto mb-6 text-cyan-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <p className="font-tech text-xs uppercase tracking-[3px] text-cyan-400 font-bold mb-2">
            Registration Submitted // Pending Verification
          </p>

          <h1 className="text-2xl sm:text-3xl font-heading text-text-primary uppercase tracking-wide mb-3">
            {successData.teamName} Registered!
          </h1>

          <div className="bg-[#050508] border border-white/10 rounded-xl p-4 my-6 text-left space-y-2">
            <div className="flex justify-between items-center text-xs font-tech">
              <span className="text-text-secondary">Application Reference:</span>
              <span className="text-cyan-400 font-bold">{successData.refId}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-tech">
              <span className="text-text-secondary">Verification Status:</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Under Manual Review
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-tech">
              <span className="text-text-secondary">Team Leader Email:</span>
              <span className="text-text-primary">{leader.email}</span>
            </div>
          </div>

          <p className="font-tech text-text-secondary text-xs sm:text-sm leading-relaxed mb-6">
            Our organizing committee will verify your payment UTR and receipt. Once verified, your team credentials and official QR Pass will be activated and emailed to your team leader.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-lg transition-all shadow-[0_0_20px_rgba(0,245,255,0.25)] flex items-center justify-center gap-2"
            >
              Go to Login Portal <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] text-text-primary flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-border-color bg-[#0a0a10]/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/ivc-logo-transparent.png"
            alt="IVC Logo"
            width={36}
            height={36}
            className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(255,0,127,0.3)]"
          />
          <div>
            <h1 className="font-heading text-sm sm:text-base tracking-[2px] uppercase text-text-primary m-0">
              Eventra 1.0 <span className="text-accent-secondary">//</span> Ideathon
            </h1>
            <p className="font-tech text-[10px] text-text-secondary tracking-widest uppercase m-0">
              Official Team Registration Portal
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="font-tech text-xs text-text-secondary hover:text-cyan-400 transition-colors flex items-center gap-1.5"
        >
          Already Registered? <span className="text-cyan-400 font-bold underline">Login</span>
        </Link>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Stepper Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative mb-4">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border-color -translate-y-1/2 z-0" />
            {[
              { num: 1, label: "Team & Track" },
              { num: 2, label: "Team Leader" },
              { num: 3, label: "3 Members" },
              { num: 4, label: "Payment Proof" },
            ].map((s) => (
              <div
                key={s.num}
                className="relative z-10 flex flex-col items-center cursor-pointer"
                onClick={() => {
                  if (s.num < step) setStep(s.num as any);
                }}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-heading text-xs transition-all ${
                    step === s.num
                      ? "bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,245,255,0.5)] scale-110"
                      : step > s.num
                      ? "bg-green-500 text-black"
                      : "bg-[#0a0a10] border border-border-color text-text-secondary"
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                </div>
                <span
                  className={`font-tech text-[10px] uppercase tracking-wider mt-1.5 hidden sm:block ${
                    step === s.num ? "text-cyan-400 font-bold" : "text-text-secondary"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-status-error/15 border border-status-error text-status-error rounded-xl flex items-center gap-3 font-tech text-xs animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: TEAM & TRACK */}
        {step === 1 && (
          <div className="space-y-6 bg-[#0a0a10] border border-border-color rounded-2xl p-6 sm:p-8 animate-fade-in shadow-xl">
            <div>
              <p className="font-tech text-xs uppercase tracking-[2px] text-cyan-400 font-bold">
                Step 1 of 4 // Squad Identity
              </p>
              <h2 className="text-xl sm:text-2xl font-heading text-text-primary uppercase tracking-wide mt-1">
                Choose Team Name & Innovation Track
              </h2>
              <p className="font-tech text-text-secondary text-xs mt-1">
                Your team name will serve as your squad handle throughout the Ideathon and on the Live Leaderboard.
              </p>
            </div>

            <div>
              <label className="block font-tech text-xs uppercase tracking-wider text-text-secondary mb-2">
                Team Name <span className="text-pink-500">*</span>
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. CyberKnights, NeuralCore, ProjectX"
                className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-4 py-3 rounded-xl font-tech text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="block font-tech text-xs uppercase tracking-wider text-text-secondary mb-2">
                Select Domain / Track <span className="text-pink-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DOMAINS.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setTrack(d.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all bg-gradient-to-b ${
                      track === d.id
                        ? `${d.color} shadow-lg ring-1 ring-cyan-400/50 scale-[1.02]`
                        : "bg-[#050508] border-border-color hover:border-white/20 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-heading text-sm uppercase">{d.title}</span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          track === d.id ? "border-cyan-400 bg-cyan-400" : "border-white/30"
                        }`}
                      >
                        {track === d.id && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </span>
                    </div>
                    <p className="font-tech text-[11px] text-text-secondary leading-relaxed">
                      {d.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.25)] flex items-center gap-2"
              >
                Next: Team Leader <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TEAM LEADER */}
        {step === 2 && (
          <div className="space-y-6 bg-[#0a0a10] border border-border-color rounded-2xl p-6 sm:p-8 animate-fade-in shadow-xl">
            <div>
              <p className="font-tech text-xs uppercase tracking-[2px] text-cyan-400 font-bold">
                Step 2 of 4 // Primary Point of Contact
              </p>
              <h2 className="text-xl sm:text-2xl font-heading text-text-primary uppercase tracking-wide mt-1">
                Team Leader (Member 1) Details
              </h2>
              <p className="font-tech text-text-secondary text-xs mt-1">
                The leader&apos;s email address will be used to generate your login credentials for the Eventra platform.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Leader Full Name <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={leader.name}
                  onChange={(e) => setLeader({ ...leader, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Leader Email Address <span className="text-pink-500">*</span>
                </label>
                <input
                  type="email"
                  value={leader.email}
                  onChange={(e) => setLeader({ ...leader, email: e.target.value })}
                  placeholder="lead@college.edu"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Leader Phone / WhatsApp <span className="text-pink-500">*</span>
                </label>
                <input
                  type="tel"
                  value={leader.phone}
                  onChange={(e) => setLeader({ ...leader, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  USN / Roll Number <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={leader.usn}
                  onChange={(e) => setLeader({ ...leader, usn: e.target.value })}
                  placeholder="e.g. 1RV22CS001"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  College / Institute Name <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={leader.college}
                  onChange={(e) => setLeader({ ...leader, college: e.target.value })}
                  placeholder="e.g. R.V. College of Engineering, Bengaluru"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Branch / Department <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={leader.branch}
                  onChange={(e) => setLeader({ ...leader, branch: e.target.value })}
                  placeholder="e.g. Computer Science, AI & ML, ECE"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Current Semester <span className="text-pink-500">*</span>
                </label>
                <select
                  value={leader.sem}
                  onChange={(e) => setLeader({ ...leader, sem: e.target.value })}
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                >
                  <option value="1st Sem">1st Semester</option>
                  <option value="2nd Sem">2nd Semester</option>
                  <option value="3rd Sem">3rd Semester</option>
                  <option value="4th Sem">4th Semester</option>
                  <option value="5th Sem">5th Semester</option>
                  <option value="6th Sem">6th Semester</option>
                  <option value="7th Sem">7th Semester</option>
                  <option value="8th Sem">8th Semester</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary font-tech uppercase tracking-wider text-xs rounded-xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.25)] flex items-center gap-2"
              >
                Next: 3 Members <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: MEMBERS 2, 3, AND 4 */}
        {step === 3 && (
          <div className="space-y-6 bg-[#0a0a10] border border-border-color rounded-2xl p-6 sm:p-8 animate-fade-in shadow-xl">
            <div>
              <p className="font-tech text-xs uppercase tracking-[2px] text-cyan-400 font-bold">
                Step 3 of 4 // Squad Roster
              </p>
              <h2 className="text-xl sm:text-2xl font-heading text-text-primary uppercase tracking-wide mt-1">
                Enter Details for Remaining 3 Members
              </h2>
              <p className="font-tech text-text-secondary text-xs mt-1">
                Every team consists of exactly 4 members (1 Leader + 3 Teammates).
              </p>
            </div>

            <div className="space-y-6">
              {members.map((m, idx) => (
                <div
                  key={idx}
                  className="bg-[#050508] border border-border-color rounded-xl p-4 sm:p-5 relative"
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-heading text-xs flex items-center justify-center">
                      {idx + 2}
                    </span>
                    <h3 className="font-heading text-sm text-text-primary uppercase tracking-wider">
                      Member {idx + 2} Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        Full Name <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => handleMemberChange(idx, "name", e.target.value)}
                        placeholder="Member Name"
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        Email Address <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={m.email}
                        onChange={(e) => handleMemberChange(idx, "email", e.target.value)}
                        placeholder="member@college.edu"
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        USN / Roll No <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={m.usn}
                        onChange={(e) => handleMemberChange(idx, "usn", e.target.value)}
                        placeholder="e.g. 1RV22CS045"
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        College Name <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={m.college}
                        onChange={(e) => handleMemberChange(idx, "college", e.target.value)}
                        placeholder="College Name"
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        Branch / Dept <span className="text-pink-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={m.branch}
                        onChange={(e) => handleMemberChange(idx, "branch", e.target.value)}
                        placeholder="Branch"
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-tech text-[11px] uppercase text-text-secondary mb-1">
                        Semester <span className="text-pink-500">*</span>
                      </label>
                      <select
                        value={m.sem}
                        onChange={(e) => handleMemberChange(idx, "sem", e.target.value)}
                        className="w-full bg-[#0a0a10] border border-border-color focus:border-cyan-400 text-text-primary px-3 py-2 rounded-lg font-tech text-xs outline-none"
                      >
                        <option value="1st Sem">1st Semester</option>
                        <option value="2nd Sem">2nd Semester</option>
                        <option value="3rd Sem">3rd Semester</option>
                        <option value="4th Sem">4th Semester</option>
                        <option value="5th Sem">5th Semester</option>
                        <option value="6th Sem">6th Semester</option>
                        <option value="7th Sem">7th Semester</option>
                        <option value="8th Sem">8th Semester</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary font-tech uppercase tracking-wider text-xs rounded-xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.25)] flex items-center gap-2"
              >
                Next: Payment Proof <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PAYMENT VERIFICATION */}
        {step === 4 && (
          <div className="space-y-6 bg-[#0a0a10] border border-border-color rounded-2xl p-6 sm:p-8 animate-fade-in shadow-xl">
            <div>
              <p className="font-tech text-xs uppercase tracking-[2px] text-pink-400 font-bold">
                Step 4 of 4 // Payment & Proof
              </p>
              <h2 className="text-xl sm:text-2xl font-heading text-text-primary uppercase tracking-wide mt-1">
                Upload Payment Proof & Submit
              </h2>
              <p className="font-tech text-text-secondary text-xs mt-1">
                Complete your registration payment via UPI, enter your transaction reference number (UTR), and upload a clear screenshot.
              </p>
            </div>

            {/* Payment Guide Card */}
            <div className="bg-[#050508] border border-cyan-500/20 rounded-xl p-5 flex flex-col md:flex-row items-center gap-6">
              <div className="w-36 h-36 bg-white p-2 rounded-xl shrink-0 flex items-center justify-center shadow-lg">
                <Image
                  src="/Vice_verse_logo.png"
                  alt="UPI QR Code"
                  width={140}
                  height={140}
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2 text-left w-full">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-tech text-[10px] font-bold uppercase rounded">
                    Official UPI Handle
                  </span>
                </div>
                <p className="font-heading text-base text-text-primary tracking-wider uppercase m-0">
                  Scan & Pay Registration Fee
                </p>
                <div className="bg-[#0a0a10] border border-white/10 px-3.5 py-2 rounded-lg font-mono text-xs text-cyan-400 flex items-center justify-between">
                  <span>ivc-ideathon@oksbi</span>
                  <span className="text-[10px] text-text-secondary uppercase">UPI ID</span>
                </div>
                <p className="font-tech text-[11px] text-text-secondary">
                  Ensure the transaction reference number (12-digit UTR) is clearly visible in the uploaded screenshot.
                </p>
              </div>
            </div>

            {/* Payment Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  12-Digit UTR / Transaction Reference Number <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentUtr}
                  onChange={(e) => setPaymentUtr(e.target.value)}
                  placeholder="e.g. 429381749201"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Phone Number Used for Payment <span className="text-pink-500">*</span>
                </label>
                <input
                  type="tel"
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-[#050508] border border-border-color focus:border-cyan-400 text-text-primary px-3.5 py-2.5 rounded-xl font-tech text-xs outline-none"
                />
              </div>

              {/* File Upload Box */}
              <div className="sm:col-span-2">
                <label className="block font-tech text-xs uppercase text-text-secondary mb-1.5">
                  Payment Proof Screenshot <span className="text-pink-500">*</span>
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-color hover:border-cyan-400/50 rounded-xl p-6 cursor-pointer bg-[#050508] transition-all group">
                  {previewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <Image
                        src={previewUrl}
                        alt="Proof Preview"
                        width={200}
                        height={120}
                        className="max-h-36 w-auto object-contain rounded-lg border border-white/20"
                      />
                      <span className="font-tech text-xs text-cyan-400 underline mt-1">
                        Click to change image
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <UploadCloud className="w-10 h-10 text-text-secondary group-hover:text-cyan-400 transition-colors mb-2" />
                      <span className="font-tech text-xs text-text-primary font-bold">
                        Click to upload payment screenshot
                      </span>
                      <span className="font-tech text-[10px] text-text-secondary mt-1">
                        PNG, JPG, WebP up to 10MB
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={prevStep}
                disabled={submitting}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-text-secondary font-tech uppercase tracking-wider text-xs rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-gradient-to-r from-cyan-400 via-pink-500 to-cyan-400 hover:opacity-90 text-black font-tech font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_25px_rgba(0,245,255,0.35)] flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    Complete Registration <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border-color py-4 text-center text-text-secondary font-tech text-xs">
        <p className="m-0">
          Eventra 1.0 // Innovators & Visionaries Club · All Team Data Protected
        </p>
      </footer>
    </main>
  );
}

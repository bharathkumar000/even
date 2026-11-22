"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
  Clock,
  ShieldAlert,
  MessageCircle,
  ExternalLink,
  Flag,
  Zap,
} from "lucide-react";
import {
  submitTeamRegistration,
  getSemesterRegistrationCounts,
  TeamMemberInput,
} from "@/app/actions/team-registration";
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
  college: "",
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

const REGISTRATION_DEADLINE_ISO = "2026-11-23T12:00:00+05:30";
const REGISTRATION_DEADLINE_MS = new Date(REGISTRATION_DEADLINE_ISO).getTime();

export default function RegisterClientView({
  initialCounts = {
    firstSemCount: 0,
    thirdSemCount: 0,
  },
}: {
  initialCounts?: {
    firstSemCount: number;
    thirdSemCount: number;
    maxLimit?: number;
    waitlistLimit?: number;
    firstSemWaitlistLimit?: number;
    thirdSemWaitlistLimit?: number;
    isClosed?: boolean;
    deadlineIso?: string;
  };
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ teamName: string; refId: string; isWaitlist?: boolean } | null>(null);

  // Live Countdown to Registration Closing (Monday, 23rd Nov 2026 @ 12:00 PM Noon IST)
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>(() => {
    const diff = REGISTRATION_DEADLINE_MS - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, isExpired: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { hours, minutes, seconds, isExpired: false };
  });

  useEffect(() => {
    const updateCountdown = () => {
      const diff = REGISTRATION_DEADLINE_MS - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live Track Registration Counts (Separate 1st and 2nd Year Tracks)
  const [semCounts, setSemCounts] = useState({
    firstSemCount: initialCounts.firstSemCount || 0,
    thirdSemCount: initialCounts.thirdSemCount || 0,
  });

  const isRegistrationClosed = timeLeft.isExpired || Boolean(initialCounts?.isClosed);
  const isFirstSemLocked = isRegistrationClosed;
  const isThirdSemLocked = isRegistrationClosed;
  const isAllLocked = isRegistrationClosed;
  const isFirstSemWaitlist = false;
  const isThirdSemWaitlist = false;
  const isSelectedSemWaitlist = false;
  const isSelectedSemLocked = isRegistrationClosed;
  const defaultAvailableSem = "1st Semester";

  // Real-time live polling every 10 seconds so waitlist and confirmed counts always reflect immediately
  useEffect(() => {
    let isMounted = true;
    const fetchLiveCounts = async () => {
      try {
        const fresh = await getSemesterRegistrationCounts();
        if (isMounted && fresh) {
          setSemCounts({
            firstSemCount: fresh.firstSemCount,
            thirdSemCount: fresh.thirdSemCount,
          });
          if (fresh.isClosed) {
            setTimeLeft((prev) => ({ ...prev, isExpired: true }));
          }
        }
      } catch (err) {
        // silent fallback
      }
    };

    fetchLiveCounts();
    const interval = setInterval(fetchLiveCounts, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Squad / Team Identity
  const [teamName, setTeamName] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("GRAND PRIX");

  // Driver 1 (Captain)
  const [driver1, setDriver1] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  // Drivers 2, 3, 4
  const [driver2, setDriver2] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  const [driver3, setDriver3] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  const [driver4, setDriver4] = useState<DriverState>({
    ...DEFAULT_DRIVER,
    sem: defaultAvailableSem,
    branch: "Computer Science & Engg (CSE)",
    college: "",
  });

  const isDriver1FirstSem = (driver1.sem || "").toLowerCase().includes("1st") || driver1.sem === "1";

  // Sync all squad members to the Captain's chosen semester
  const handleCaptainSemChange = (newSem: string) => {
    setDriver1((prev) => ({ ...prev, sem: newSem }));
    setDriver2((prev) => ({ ...prev, sem: newSem }));
    setDriver3((prev) => ({ ...prev, sem: newSem }));
    setDriver4((prev) => ({ ...prev, sem: newSem }));
  };

  // Sync Captain's college to other squad members if they were matching or empty
  const handleCaptainCollegeChange = (newCollege: string) => {
    const oldCollege = driver1.college;
    setDriver1((prev) => ({ ...prev, college: newCollege }));
    setDriver2((prev) => (prev.college === oldCollege || !prev.college ? { ...prev, college: newCollege } : prev));
    setDriver3((prev) => (prev.college === oldCollege || !prev.college ? { ...prev, college: newCollege } : prev));
    setDriver4((prev) => (prev.college === oldCollege || !prev.college ? { ...prev, college: newCollege } : prev));
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
    const upiLink = "upi://pay?pa=charan31106@oksbi&pn=Charan%20C&am=400&cu=INR&tn=Eventra%20Grand%20Prix%20Entry%20Fee";
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

  const compressImageClient = async (file: File, maxDimension = 1400, quality = 0.8): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
              const compressedFile = new File([blob], cleanName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg("Payment proof file exceeds 20MB limit.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setErrorMsg(null);

    // Compress in background to keep upload super fast and safely within payload limits
    try {
      const optimized = await compressImageClient(file);
      setPaymentFile(optimized);
    } catch {
      setPaymentFile(file);
    }
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText("charan31106@oksbi");
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
    if (!driver1.name.trim() || !driver1.email.trim() || !driver1.phone.trim() || !driver1.college.trim() || !driver1.usn.trim()) {
      setErrorMsg("// DRIVER 1 (CAPTAIN): Please complete Name, USN, Email, 10-digit Phone, and College.");
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
    if (!driver2.name.trim() || !driver2.email.trim() || !driver2.phone.trim() || !driver2.college.trim() || !driver2.usn.trim()) {
      setErrorMsg("// DRIVER 2 (AERODYNAMICS): Please complete all required member details including College and USN.");
      return false;
    }
    if (!driver2.email.includes("@")) {
      setErrorMsg("// DRIVER 2 (AERODYNAMICS): Enter a valid email address.");
      return false;
    }

    // Validate Driver 3
    if (!driver3.name.trim() || !driver3.email.trim() || !driver3.phone.trim() || !driver3.college.trim() || !driver3.usn.trim()) {
      setErrorMsg("// DRIVER 3 (POWERTRAIN): Please complete all required member details including College and USN.");
      return false;
    }
    if (!driver3.email.includes("@")) {
      setErrorMsg("// DRIVER 3 (POWERTRAIN): Enter a valid email address.");
      return false;
    }

    // Validate Driver 4
    if (!driver4.name.trim() || !driver4.email.trim() || !driver4.phone.trim() || !driver4.college.trim() || !driver4.usn.trim()) {
      setErrorMsg("// DRIVER 4 (TELEMETRY): Please complete all required member details including College and USN.");
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

    // Check if registration deadline has passed
    if (isRegistrationClosed) {
      setErrorMsg("REGISTRATION IS OFFICIALLY CLOSED: Official team registrations closed on Monday, 23rd November at 12:00 PM (Noon) IST. No further submissions are being accepted.");
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
      formData.append("leaderUsn", driver1.usn.trim().toUpperCase());
      formData.append("leaderBranch", driver1.branch);
      formData.append("leaderSem", driver1.sem);

      // Remaining 3 Drivers
      const otherMembers: TeamMemberInput[] = [
        {
          name: driver2.name.trim(),
          email: driver2.email.trim().toLowerCase(),
          phone: driver2.phone.trim(),
          usn: driver2.usn.trim().toUpperCase(),
          college: driver2.college.trim(),
          branch: driver2.branch,
          sem: driver2.sem,
        },
        {
          name: driver3.name.trim(),
          email: driver3.email.trim().toLowerCase(),
          phone: driver3.phone.trim(),
          usn: driver3.usn.trim().toUpperCase(),
          college: driver3.college.trim(),
          branch: driver3.branch,
          sem: driver3.sem,
        },
        {
          name: driver4.name.trim(),
          email: driver4.email.trim().toLowerCase(),
          phone: driver4.phone.trim(),
          usn: driver4.usn.trim().toUpperCase(),
          college: driver4.college.trim(),
          branch: driver4.branch,
          sem: driver4.sem,
        },
      ];

      formData.append("membersJson", JSON.stringify(otherMembers));
      formData.append("paymentUtr", paymentUtr.trim());
      formData.append("paymentPhone", driver1.phone.trim());

      let fileToUpload = paymentFile;
      if (fileToUpload && fileToUpload.size > 600 * 1024) {
        try {
          fileToUpload = await compressImageClient(fileToUpload);
        } catch {}
      }
      if (fileToUpload) {
        formData.append("paymentProof", fileToUpload);
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
      const rawMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(
        rawMsg && !rawMsg.includes("fetch") && !rawMsg.includes("Failed to fetch")
          ? `Submission notice: ${rawMsg}`
          : "Unexpected system error while locking grid position. Please retry."
      );
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
          <a
            href="https://relaython-ivc.vercel.app"
            className="flex items-center gap-2.5 group"
            title="Return to Relaython Circuit"
          >
            <div className="px-2.5 py-1 bg-red-600 text-black font-black uppercase text-xs italic tracking-widest rounded-sm shadow-[0_0_15px_rgba(255,0,0,0.5)] group-hover:scale-105 transition-transform">
              EVENTRA
            </div>
            <span className="font-mono text-xs uppercase tracking-widest text-red-500 font-bold group-hover:text-red-400 transition-colors">
              // RELAYATHON 2026
            </span>
          </a>

          {/* Top Right: Back to Circuit / Main Site */}
          <a
            href="https://relaython-ivc.vercel.app"
            className="text-xs font-mono text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 border border-white/10 hover:border-red-500/50 px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08]"
          >
            <span className="text-red-500 font-bold">←</span> BACK TO MAIN SITE
          </a>
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
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200 font-mono text-xs max-w-xl mx-auto leading-relaxed mt-2 text-left space-y-2">
                  <p className="m-0 text-yellow-400 font-bold">
                    ⚠️ <strong>Please Note:</strong> Registering on the waiting list does not guarantee a slot for participation.
                  </p>
                  <p className="m-0 text-yellow-100/90 leading-relaxed">
                    ✨ <strong>2nd Year Track Slot Rollover:</strong> If the 2nd Year (3rd Sem) track slots are not completed before registration closes, all remaining unfilled slots will be converted and offered to 1st Year waiting list teams in sequential order!
                  </p>
                  <p className="m-0 text-[11px] text-neutral-400">
                    If a slot becomes available, our coordinators will immediately reach out to the Team Lead via WhatsApp / Email for payment and confirmation.
                  </p>
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

            {/* MANDATORY OFFICIAL WHATSAPP GROUP CARD (CONFIRMED SLOTS ONLY — NOT FOR WAITING LIST) */}
            {!successData.isWaitlist ? (
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
                  href="https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld"
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
                    href="https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 underline hover:text-emerald-300"
                  >
                    https://chat.whatsapp.com/LNqyZOwG0R8D2IEST6KSld
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 bg-yellow-500/10 border-2 border-yellow-500/40 rounded-2xl max-w-xl mx-auto text-center space-y-2 shadow-[0_0_25px_rgba(234,179,8,0.15)]">
                <div className="inline-flex items-center gap-2 text-yellow-400 font-mono text-xs uppercase font-bold tracking-widest">
                  <span>⚠️ Waiting List Status</span>
                </div>
                <p className="font-mono text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-lg mx-auto">
                  Official WhatsApp community onboarding and credentials are strictly reserved for confirmed teams. If a confirmed team slot opens, our Race Stewards will reach out directly to your Team Lead for payment and WhatsApp onboarding.
                </p>
              </div>
            )}

            {/* Race Day Credentials & Helplines */}
            <div className="space-y-4 max-w-xl mx-auto font-mono">
              {!successData.isWaitlist && (
                <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 text-xs leading-relaxed">
                  💡 <strong>Next Steps:</strong> Once the UTR is verified by Race Control, your squad&apos;s official credentials will be dispatched to the Team Lead&apos;s email (<span className="text-white font-bold">{driver1.email}</span>).
                </div>
              )}

              <div className="pt-3 border-t border-neutral-800 text-center space-y-1.5">
                <span className="text-neutral-400 font-bold uppercase tracking-wider text-xs block">
                  Student Coordinators:
                </span>
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-sm sm:text-base font-bold text-white">
                  <a href="tel:+919945867010" className="text-red-400 hover:text-white transition-colors">
                    Preksha Dixit (+91 99458 67010)
                  </a>
                  <span className="text-neutral-600 hidden sm:inline">•</span>
                  <a href="tel:+916361455193" className="text-red-400 hover:text-white transition-colors">
                    Parinitha K (+91 63614 55193)
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

            {/* COUNTDOWN DEADLINE BANNER */}
            <div
              className={`mb-6 p-4 sm:p-5 rounded-2xl border font-mono shadow-2xl transition-all ${
                isRegistrationClosed
                  ? "bg-red-950/40 border-red-600 text-red-300"
                  : "bg-gradient-to-r from-red-950/60 via-black to-red-950/60 border-red-600/80 shadow-[0_0_35px_rgba(255,0,0,0.3)]"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 text-center md:text-left">
                  <div
                    className={`p-3 rounded-xl border ${
                      isRegistrationClosed
                        ? "bg-red-900/30 border-red-700 text-red-400"
                        : "bg-red-600/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]"
                    }`}
                  >
                    <Clock size={28} className={!isRegistrationClosed ? "animate-pulse" : ""} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isRegistrationClosed ? "bg-red-500" : "bg-green-400 animate-ping"
                        }`}
                      />
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">
                        {isRegistrationClosed ? "REGISTRATIONS ARE CLOSED" : "REGISTRATION DEADLINE COUNTDOWN"}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-neutral-300 m-0 mt-0.5">
                      {isRegistrationClosed ? (
                        <span className="text-red-400 font-bold">
                          Official team registrations closed on Monday, 23rd November at 12:00 PM (Noon) IST
                        </span>
                      ) : (
                        <>CLOSES: <strong className="text-yellow-400">MONDAY, 23RD NOVEMBER @ 12:00 PM (NOON) IST</strong> · NO TEAM CAP</>
                      )}
                    </p>
                  </div>
                </div>

                {!isRegistrationClosed ? (
                  <div className="flex items-center gap-2 sm:gap-3 text-center">
                    <div className="bg-black/80 border border-red-800/80 px-3 py-2 rounded-lg min-w-[64px] sm:min-w-[72px]">
                      <span className="text-xl sm:text-2xl font-black text-white block">
                        {String(timeLeft.hours).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider block">
                        HOURS
                      </span>
                    </div>
                    <span className="text-red-500 font-bold text-xl sm:text-2xl animate-pulse">:</span>
                    <div className="bg-black/80 border border-red-800/80 px-3 py-2 rounded-lg min-w-[64px] sm:min-w-[72px]">
                      <span className="text-xl sm:text-2xl font-black text-white block">
                        {String(timeLeft.minutes).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider block">
                        MINS
                      </span>
                    </div>
                    <span className="text-red-500 font-bold text-xl sm:text-2xl animate-pulse">:</span>
                    <div className="bg-black/80 border border-red-800/80 px-3 py-2 rounded-lg min-w-[64px] sm:min-w-[72px]">
                      <span className="text-xl sm:text-2xl font-black text-red-400 block">
                        {String(timeLeft.seconds).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase tracking-wider block">
                        SECS
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-red-600/20 border border-red-500 rounded-lg text-red-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <Lock size={14} /> REGISTRATIONS LOCKED
                  </div>
                )}
              </div>
            </div>

            {/* COMPETITION TRACK STATUS CARDS (SEPARATED AS 1ST AND 2ND YEARS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 font-mono">
              {/* Card 1: 1st Year Track (1st Semester) */}
              <div
                className={`bg-[#080808] border rounded-xl p-5 space-y-3 shadow-lg transition-all ${
                  isFirstSemLocked
                    ? "border-red-600/70 bg-red-950/10"
                    : "border-red-900/50 hover:border-red-600/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isFirstSemLocked
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          : "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-black italic tracking-wider text-white uppercase">
                      1ST SEMESTER TEAMS
                    </span>
                  </div>
                  {isFirstSemLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} /> CLOSED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      OPEN
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5 pt-1">
                  <span className="text-4xl sm:text-5xl font-black text-white italic tracking-wider">
                    {semCounts.firstSemCount}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-400 uppercase tracking-widest">
                    TEAMS REGISTERED
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 m-0 pt-0.5">
                  1st Year Track (1st Semester) · Open to all engineering colleges
                </p>
              </div>

              {/* Card 2: 2nd Year Track (3rd Semester) */}
              <div
                className={`bg-[#080808] border rounded-xl p-5 space-y-3 shadow-lg transition-all ${
                  isThirdSemLocked
                    ? "border-red-600/70 bg-red-950/10"
                    : "border-red-900/50 hover:border-red-600/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isThirdSemLocked
                          ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          : "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-black italic tracking-wider text-white uppercase">
                      3RD SEMESTER TEAMS
                    </span>
                  </div>
                  {isThirdSemLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-red-600/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} /> CLOSED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      OPEN
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5 pt-1">
                  <span className="text-4xl sm:text-5xl font-black text-white italic tracking-wider">
                    {semCounts.thirdSemCount}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-400 uppercase tracking-widest">
                    TEAMS REGISTERED
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 m-0 pt-0.5">
                  2nd Year Track (3rd Semester) · Open to all engineering colleges
                </p>
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

            {isRegistrationClosed ? (
              <div className="border-2 border-red-600/70 bg-[#080808] p-8 sm:p-14 rounded-2xl text-center space-y-6 shadow-[0_0_50px_rgba(255,0,0,0.3)] my-8 relative overflow-hidden font-mono">
                <div className="inline-flex p-4 rounded-2xl bg-red-950/60 border border-red-600/80 text-red-500 shadow-[0_0_20px_rgba(255,0,0,0.4)]">
                  <Lock size={44} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-black italic tracking-wider text-white uppercase m-0">
                    REGISTRATIONS ARE CLOSED
                  </h2>
                  <p className="text-sm sm:text-base text-neutral-300 max-w-xl mx-auto m-0 leading-relaxed">
                    Official team registrations for the Eventra Grand Prix closed on <strong className="text-yellow-400">Monday, 23rd November at 12:00 PM (Noon) IST</strong>.
                  </p>
                  <p className="text-xs text-neutral-400 max-w-lg mx-auto m-0 pt-1 leading-relaxed">
                    No further submissions, UPI payments, or squad registrations are being accepted. If your team has already submitted registration and payment, your credentials will be dispatched to the Team Leader&apos;s email upon admin verification.
                  </p>
                </div>

                <div className="pt-6 border-t border-neutral-800/80 max-w-xl mx-auto">
                  <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mb-2">
                    For any queries contact student coordinators:
                  </p>
                  <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs">
                    <a href="tel:+919945867010" className="text-neutral-300 hover:text-red-400 transition-colors">
                      <span className="text-white font-bold">Preksha Dixit</span> - +91 99458 67010
                    </a>
                    <span className="text-neutral-700 hidden sm:inline">•</span>
                    <a href="tel:+916361455193" className="text-neutral-300 hover:text-red-400 transition-colors">
                      <span className="text-white font-bold">Parinitha K</span> - +91 63614 55193
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* MAIN RED BORDERED FORM */
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
                  <span>COMPETITION TRACKS &amp; SEMESTER ELIGIBILITY POLICY</span>
                </div>
                <p className="text-neutral-300 leading-relaxed text-[11px] sm:text-xs m-0">
                  Teams are separated into two distinct competition categories based on academic year. To ensure fair competition, each 4-member squad must consist strictly of members from the same semester:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 bg-black/60 border border-neutral-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold block uppercase text-[11px]">1ST YEAR TRACK</span>
                      <span className="text-[10px] text-green-400 font-bold px-1.5 py-0.5 rounded bg-green-950/40 border border-green-500/30">
                        NO TEAM CAP
                      </span>
                    </div>
                    <span className="text-neutral-400 text-[10px] mt-1 block">
                      All 4 members must be currently enrolled in 1st Semester.
                    </span>
                  </div>
                  <div className="p-3 bg-black/60 border border-neutral-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold block uppercase text-[11px]">2ND YEAR TRACK</span>
                      <span className="text-[10px] text-green-400 font-bold px-1.5 py-0.5 rounded bg-green-950/40 border border-green-500/30">
                        NO TEAM CAP
                      </span>
                    </div>
                    <span className="text-neutral-400 text-[10px] mt-1 block">
                      All 4 members must be currently enrolled in 3rd Semester (2nd Year).
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-red-900/40 space-y-1.5">
                  <p className="text-emerald-400 font-bold text-[10px] sm:text-[11px] m-0">
                    🎓 OPEN TO ALL COLLEGES: Students from any engineering college / university can participate!
                  </p>
                  <p className="text-yellow-400 font-bold text-[10px] sm:text-[11px] m-0">
                    ⚠ TEAM RULE: Mixed semester teams and senior-junior combinations are strictly prohibited. Selecting the Team Captain&apos;s semester automatically sets and locks the semester for all 4 team members.
                  </p>
                  <p className="text-cyan-400 font-bold text-[10px] sm:text-[11px] m-0">
                    ⏰ REGISTRATION DEADLINE: Registrations officially close on <strong>Monday, 23rd November at 12:00 PM (Noon) IST</strong>. No new teams will be accepted after this deadline.
                  </p>
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
                      USN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver1.usn}
                      onChange={(e) => setDriver1({ ...driver1, usn: e.target.value })}
                      placeholder="ENTER USN (MANDATORY)"
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
                        const trackName = s.includes("1st") ? "1st Year Track" : "2nd Year Track";
                        return (
                          <option
                            key={s}
                            value={s}
                            disabled={isRegistrationClosed}
                            className="bg-black text-white disabled:text-neutral-600"
                          >
                            {isRegistrationClosed ? `${s} (${trackName} - CLOSED)` : `${s} (${trackName})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE / INSTITUTION <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER COLLEGE / INSTITUTION NAME"
                      value={driver1.college}
                      onChange={(e) => handleCaptainCollegeChange(e.target.value)}
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
                      USN_2 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver2.usn}
                      onChange={(e) => setDriver2({ ...driver2, usn: e.target.value })}
                      placeholder="ENTER USN (MANDATORY)"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_2 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER COLLEGE / INSTITUTION NAME"
                      value={driver2.college}
                      onChange={(e) => setDriver2({ ...driver2, college: e.target.value })}
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
                      USN_3 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver3.usn}
                      onChange={(e) => setDriver3({ ...driver3, usn: e.target.value })}
                      placeholder="ENTER USN (MANDATORY)"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_3 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER COLLEGE / INSTITUTION NAME"
                      value={driver3.college}
                      onChange={(e) => setDriver3({ ...driver3, college: e.target.value })}
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
                      USN_4 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driver4.usn}
                      onChange={(e) => setDriver4({ ...driver4, usn: e.target.value })}
                      placeholder="ENTER USN (MANDATORY)"
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
                    <label className="block text-red-500 uppercase text-[11px] font-bold">
                      COLLEGE_4 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ENTER COLLEGE / INSTITUTION NAME"
                      value={driver4.college}
                      onChange={(e) => setDriver4({ ...driver4, college: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-500 text-white p-3 rounded outline-none text-xs placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: GRAND PRIX ENTRY FEE & PAYMENT VERIFICATION */}
              {isRegistrationClosed ? (
                <div className="space-y-4 pt-6 border-t-2 border-red-600/60 bg-red-950/20 p-6 sm:p-8 rounded-xl border border-red-900/40 font-mono text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Lock size={32} className="text-red-500" />
                    <h3 className="font-heading text-lg sm:text-xl text-white uppercase m-0 tracking-wide">
                      REGISTRATION IS OFFICIALLY CLOSED
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-300 max-w-lg m-0">
                      The official registration window closed on <strong>Monday, 23rd November at 12:00 PM (Noon) IST</strong>. New entries and payments are no longer accepted.
                    </p>
                  </div>
                </div>
              ) : (
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

                    <div className="inline-block p-2 bg-white rounded border-2 border-red-600 shadow-[0_0_20px_rgba(255,0,0,0.3)] my-1 mx-auto max-w-[240px]">
                      <Image
                        src="/payment-qr.png"
                        alt="Official UPI QR Code - Charan C"
                        width={240}
                        height={320}
                        className="w-48 sm:w-52 h-auto object-contain rounded mx-auto"
                        priority
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="bg-red-950/30 border border-red-900/40 rounded p-2 text-center">
                        <span className="text-neutral-400 text-[10px] block uppercase font-mono tracking-wider">Official UPI ID</span>
                        <span className="text-yellow-400 font-bold font-mono text-xs select-all">charan31106@oksbi</span>
                      </div>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-300 border border-neutral-800 rounded text-[10px] transition-colors font-bold"
                      >
                        {copiedUpi ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        <span>{copiedUpi ? "UPI ID COPIED" : "COPY UPI ID: charan31106@oksbi"}</span>
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

                    <div className="p-3 bg-yellow-950/40 border-2 border-yellow-500/80 rounded-lg text-yellow-300 text-xs leading-relaxed space-y-1">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-yellow-400">
                        <span>⚠ VERIFICATION REQUIRED BEFORE PAYMENT</span>
                      </div>
                      <p className="m-0 text-[11px] text-yellow-200/90 leading-normal">
                        Please verify that the beneficiary / receiver name is shown as <strong className="text-white font-bold underline decoration-yellow-400 decoration-2 underline-offset-2">Charan C</strong> on your UPI app (Google Pay, PhonePe, Paytm, or BHIM) before completing the transaction.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">BENEFICIARY / FULL NAME:</span>
                        <span className="text-yellow-400 font-bold text-sm tracking-wider">Charan C</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">OFFICIAL RECEIVING UPI ID:</span>
                        <span className="text-white font-mono font-bold text-xs break-all">charan31106@oksbi</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">RECEIVING BANK / ACCOUNT:</span>
                        <span className="text-neutral-200 font-bold text-xs">State Bank of India (SBI)</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">ENTRY REGISTRATION FEE:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-green-400 font-black text-xs">₹400.00 (Fixed per Team)</span>
                          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">(Non-Refundable)</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-black/60 border border-neutral-800/80 rounded gap-1">
                        <span className="text-neutral-500 text-[11px]">PAYMENT DESK COORDINATORS:</span>
                        <span className="text-neutral-300 text-xs">Monish N Kumar (+91 95917 55995) · Charan C (+91 80884 36353)</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-neutral-500 m-0 italic">
                      * Official QR, UPI ID (charan31106@oksbi) and Receiver Full Name (Charan C) are authenticated for Ideathon registration.
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
                {!isRegistrationClosed && (
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
                  disabled={submitting || isRegistrationClosed}
                  className="w-full py-4 sm:py-5 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none disabled:cursor-not-allowed text-white font-black italic uppercase tracking-widest text-base sm:text-lg rounded transition-all cursor-pointer flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 shadow-[0_0_30px_rgba(255,0,0,0.5)]"
                >
                  {submitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>LOCKING IN GRID POSITION...</span>
                    </>
                  ) : isRegistrationClosed ? (
                    <>
                      <Lock size={20} />
                      <span>REGISTRATION CLOSED — DEADLINE PASSED</span>
                    </>
                  ) : (
                    <span>LOCK IN GRID POSITION &gt;&gt;</span>
                  )}
                </button>

                {!isRegistrationClosed && (
                  <p className="text-center font-mono text-[11px] sm:text-xs text-neutral-400 m-0 pt-1">
                    <span className="text-red-500 font-bold">⚠ PLEASE NOTE:</span> Registration fee is <strong className="text-red-400 uppercase tracking-wider font-bold">strictly non-refundable</strong> once paid under any circumstances.
                  </p>
                )}

                {/* TRANSACTION VERIFICATION & CONTACT QUERIES NOTICE */}
                <div className="mt-8 p-5 sm:p-6 bg-[#080808] border border-red-900/50 rounded-xl space-y-3 font-mono text-center shadow-lg">
                  <p className="text-xs sm:text-sm text-yellow-400 font-bold tracking-wide m-0">
                    Once the Transaction is verified, the login credentials will be shared to the Team Lead&apos;s email.
                  </p>

                  <div className="pt-3 border-t border-neutral-800/80">
                    <p className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold mb-2">
                      For any queries contact student coordinators:
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs">
                      <a href="tel:+919945867010" className="text-neutral-300 hover:text-red-400 transition-colors">
                        <span className="text-white font-bold">Preksha Dixit</span> - +91 99458 67010
                      </a>
                      <span className="text-neutral-700 hidden sm:inline">•</span>
                      <a href="tel:+916361455193" className="text-neutral-300 hover:text-red-400 transition-colors">
                        <span className="text-white font-bold">Parinitha K</span> - +91 63614 55193
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </form>
            )}
          </>
        )}
      </main>

      {/* Cyberpunk Relayathon Footer with ECE Dept Affiliation */}
      <RelayathonFooter />
    </div>
  );
}

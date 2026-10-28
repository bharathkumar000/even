"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getRoleRedirectUrl } from "@/lib/auth/redirect";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Gavel,
  Layers,
  Users,
} from "lucide-react";

export default function AuthPage({ isSignUp = false }: { isSignUp?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("leader");
  const [accessCode, setAccessCode] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load remembered username/email
  useEffect(() => {
    try {
      const saved = localStorage.getItem("eventra_remember_email");
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Rate-limiting security cooldown timer
  useEffect(() => {
    if (rateLimitCooldown <= 0) return;
    const timer = setInterval(() => {
      setRateLimitCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCooldown]);

  // Robust sign-in execution
  const executeSignIn = async (userEmail: string, userPass: string, preferredPortal?: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Handle remember me
    try {
      if (rememberMe) {
        localStorage.setItem("eventra_remember_email", userEmail);
      } else {
        localStorage.removeItem("eventra_remember_email");
      }
    } catch {}

    const effectivePass = userPass;
    const supabase = createClient();
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail.trim().toLowerCase(),
        password: effectivePass,
      });

      if (error) throw error;

      if (data?.user) {
        setFailedAttempts(0);
        setRateLimitCooldown(0);
        setSuccessMsg("Authenticated! Entering portal...");
        const redirectUrl = preferredPortal || (await getRoleRedirectUrl(data.user));
        // Fast client navigation & session sync
        router.push(redirectUrl);
        router.refresh();
        setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 400);
      } else {
        throw new Error("No user record returned from authentication service.");
      }
    } catch (err: unknown) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setRateLimitCooldown(30);
        setErrorMsg("Excessive failed login attempts. For security, please wait 30 seconds before retrying.");
      } else {
        const remaining = 5 - nextAttempts;
        const msg = err instanceof Error ? err.message : "Authentication failed";
        setErrorMsg(remaining <= 2 ? `${msg} (${remaining} attempts remaining before cooldown)` : msg);
      }
      setLoading(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();

    try {
      if (isSignUp) {
const normalizedEmail = email.trim();
        if (role !== "participant" && accessCode !== "0987") {
          setErrorMsg("Invalid access code for selected role.");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
            },
          },
        });

        if (error) throw error;

        if (data?.session && data?.user) {
          const redirectUrl = await getRoleRedirectUrl(data.user);
          router.push(redirectUrl);
          router.refresh();
          setTimeout(() => {
            window.location.assign(redirectUrl);
          }, 2000);
          return;
        }

        setStep("otp");
        setSuccessMsg(`A 6-digit verification code was dispatched to ${email}.`);
        setResendCooldown(60);
      } else {
        let targetEmail = email.trim();
        const targetPass = password.trim();

        // No domain auto-append needed

        if (!targetPass) {
          setErrorMsg("Password is required");
          setLoading(false);
          return;
        }

        await executeSignIn(targetEmail, targetPass);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.trim();

    if (token.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit verification code");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    const normalizedEmail = email.trim();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: "signup",
      });

      if (error) throw error;

      if (data?.user) {
        const redirectUrl = await getRoleRedirectUrl(data.user);
        router.push(redirectUrl);
        router.refresh();
        setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 2000);
      } else {
        router.push("/team");
        router.refresh();
        setTimeout(() => {
          window.location.assign("/team");
        }, 2000);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Invalid or expired verification code. Please try again."
      );
      setLoading(false);
    }
  };

const handleDemoClick = async (demoEmail: string, roleName: string, targetPath: string) => {
    // Only allow demo credentials in development environment
    if (process.env.NODE_ENV === "production") {
      setErrorMsg("Demo credentials are not available in production.");
      return;
    }
    // Demo accounts should have proper credentials set up in the auth system
    // This is a placeholder - actual demo credentials should be configured in Supabase
    setEmail(demoEmail);
    setPassword(""); // User must enter the actual demo password
    setErrorMsg(null);
    setSuccessMsg(`Demo account ${roleName} selected. Please enter the demo password.`);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg("Enter your username or email above first to receive reset instructions.");
      return;
    }
    const supabase = createClient();
    const normalizedEmail = email.trim();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/login`,
      });

      if (error) throw error;
      setSuccessMsg(`Password reset instructions sent to ${normalizedEmail}`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send reset instructions.");
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    const normalizedEmail = email.trim();

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });

      if (error) throw error;

      setSuccessMsg(`A new 6-digit code has been dispatched to ${email}`);
      setResendCooldown(60);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#000000] text-white flex flex-col relative overflow-hidden select-none selection:bg-[#ff007f] selection:text-white font-sans">
      {/* Complete pitch black background with technical grid and contour accents */}
      <div className="absolute inset-0 bg-[#000000] pointer-events-none" />

      {/* Subtle bottom-left rocky terrain / mountain texture layer */}
      <div
        className="absolute bottom-0 left-0 w-full max-w-2xl h-96 pointer-events-none opacity-20 mix-blend-screen bg-no-repeat bg-bottom bg-contain"
        style={{
          backgroundImage: `radial-gradient(ellipse at bottom left, rgba(255, 255, 255, 0.15) 0%, rgba(20, 20, 25, 0.4) 40%, transparent 75%)`,
        }}
      />

      {/* Subtle tech crosshairs, dots, and grid lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle grid lines */}
        <div className="absolute top-20 left-12 w-px h-64 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        <div className="absolute top-36 left-4 right-4 h-px bg-white/[0.04]" />
        <div className="absolute bottom-24 left-4 right-4 h-px bg-white/[0.04]" />
        <div className="absolute top-1/2 right-16 w-px h-48 bg-gradient-to-b from-transparent via-white/5 to-transparent" />

        {/* Scattered technical plus crosses */}
        <span className="absolute top-28 left-48 text-[10px] font-mono text-white/20">+</span>
        <span className="absolute top-1/3 left-1/4 text-[10px] font-mono text-white/15">+</span>
        <span className="absolute bottom-40 left-1/3 text-[10px] font-mono text-white/15">+</span>
        <span className="absolute top-24 right-1/4 text-[10px] font-mono text-white/15">+</span>
        <span className="absolute bottom-28 right-8 text-xs font-mono text-white/25">+</span>

        {/* Matrix dot clusters */}
        <div className="absolute top-1/2 left-4 -translate-y-1/2 hidden md:flex flex-col gap-1.5 opacity-20">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white" />
              <span className="w-1 h-1 rounded-full bg-white" />
            </div>
          ))}
        </div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 hidden md:flex flex-col gap-1.5 opacity-20">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white" />
              <span className="w-1 h-1 rounded-full bg-white" />
            </div>
          ))}
        </div>
      </div>

      {/* TOP HEADER ROW */}
      <header className="relative z-10 w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* Top Left: + VVCE × IVC */}
        <div className="flex items-center gap-2 font-mono text-[9px] text-[#71717a] tracking-[2px] uppercase">
          <span className="text-white/40 text-xs leading-none">+</span>
          <span className="font-semibold text-white/70">VVCE</span>
          <span className="text-white/30">×</span>
          <span className="font-semibold text-white/70">IVC</span>
        </div>

        {/* Top Right: Yellow accent + EVENTS PEOPLE IDEAS IMPACT */}
        <div className="flex items-center gap-2">
          <div className="w-[2px] h-5 bg-[#FBC815] rounded-full shadow-[0_0_6px_rgba(251,200,21,0.5)]" />
          <div className="font-mono text-[7px] leading-[1.2] text-[#71717a] tracking-[1.2px] uppercase text-left">
            <div>EVENTS</div>
            <div>PEOPLE</div>
            <div>IDEAS</div>
            <div>IMPACT</div>
          </div>
        </div>
      </header>

      {/* MAIN HERO & LOGIN SECTION */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8 overflow-hidden">
        
        {/* LEFT COLUMN: HERO & BRANDING - Condensed */}
        <div className="w-full lg:max-w-xl space-y-5 pl-4 lg:pl-8 flex-1 flex flex-col justify-center items-start">
          {/* Eventra Emblem & Typography Logo */}
          <div className="relative w-52 sm:w-64 md:w-72 max-w-full -ml-2">
            <Image
              src="/eventra-logo.png"
              alt="Eventra - A Product of IVC"
              width={340}
              height={260}
              priority
              className="w-full h-auto object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.04)]"
            />
          </div>

          {/* Headline - Condensed */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.02] uppercase">
              One portal.
              <span className="block text-[#ff007f] drop-shadow-[0_0_18px_rgba(255,0,127,0.3)]">
                Every event.
              </span>
            </h1>
            <p className="text-[#94a3b8] text-xs sm:text-sm leading-snug max-w-md font-sans">
              Secure access for administrators, judges, teams and event staff.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGIN / AUTH FORM */}
        <div className="w-full lg:max-w-md xl:max-w-[440px] flex-shrink-0">
          <div className="w-full">
            {/* Unified Background Card */}
            <div className="relative rounded-[24px] border border-white/[0.1] bg-[#08080a]/95 shadow-[0_0_40px_rgba(0,0,0,0.8),0_0_20px_rgba(255,0,127,0.06)] backdrop-blur-xl overflow-hidden">
              {/* Tech Corner Bracket Accents */}
              <div className="absolute top-3 left-3 w-2.5 h-2.5 border-t-1.5 border-l-1.5 border-white/15 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 border-b-1.5 border-r-1.5 border-white/15 pointer-events-none" />
              
              <div className="p-5 sm:p-6 lg:p-7 space-y-5">
                
                {/* Card Header */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 sm:w-28 mb-1.5">
                    <Image
                      src="/eventra-logo.png"
                      alt="Eventra"
                      width={110}
                      height={80}
                      priority
                      className="w-full h-auto object-contain mx-auto"
                    />
                  </div>

                  {step === "otp" ? (
                    <>
                      <div className="inline-flex p-2 rounded-full bg-white/5 border border-white/10 mb-1.5">
                        <KeyRound className="w-5 h-5 text-[#00F0FF] animate-pulse" />
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight m-0">
                        Verify Account
                      </h2>
                      <p className="text-[10px] text-[#94a3b8] mt-0.5 font-sans">
                        Enter the 6-digit security token dispatched to {email}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight m-0">
                        {isSignUp ? "Create Account" : "Welcome back."}
                      </h2>
                      <p className="text-[10px] text-[#94a3b8] mt-0.5 font-sans">
                        {isSignUp
                          ? "Register to access your event dashboard."
                          : "Sign in to continue to your workspace."}
                      </p>
                    </>
                  )}
                </div>

                {/* Feedback Banners */}
                {errorMsg && (
                  <div className="p-2.5 mb-3 bg-[#ff007f]/10 border border-[#ff007f]/40 text-[#ff007f] font-mono text-[10px] rounded-lg flex items-center gap-2">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-2.5 mb-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* OTP VERIFICATION STEP */}
                {step === "otp" ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                        6-Digit Security Token
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="••••••"
                        className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3.5 text-center text-white text-lg tracking-[0.35em] font-mono focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/40 outline-none transition-all"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.trim().length !== 6}
                      className="w-full py-3 px-5 bg-[#ff007f] hover:bg-[#e60072] disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-[1.2px] rounded-lg transition-all shadow-[0_0_15px_rgba(255,0,127,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{loading ? "Verifying..." : "Confirm & Enter Portal"}</span>
                      <ArrowRight size={13} />
                    </button>

                    <div className="flex items-center justify-between text-[9px] pt-2 border-t border-white/10 font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("credentials");
                          setErrorMsg(null);
                        }}
                        className="text-[#71717a] hover:text-white transition-colors flex items-center gap-1 uppercase"
                      >
                        <ArrowLeft size={11} />
                        <span>Back</span>
                      </button>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || resendLoading}
                        onClick={handleResendOtp}
                        className="text-[#ff007f] hover:underline disabled:opacity-50 uppercase font-semibold"
                      >
                        {resendCooldown > 0
                          ? `Resend (${resendCooldown}s)`
                          : resendLoading
                          ? "Sending..."
                          : "Resend Code"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCredentialsSubmit} className="space-y-3.5">
                    {isSignUp && (
                      <>
                        <div className="space-y-1">
                          <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3 text-xs sm:text-sm text-white placeholder-[#52525b] focus:border-[#ff007f] focus:ring-1 focus:ring-[#ff007f]/40 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                            Role
                          </label>
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3 text-xs sm:text-sm text-white focus:border-[#ff007f] outline-none"
                          >
                            <option value="leader">Team Leader</option>
                            <option value="participant">Participant</option>
                            <option value="judge">Judge</option>
                            <option value="staff">Ops Staff</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>

                        {role !== "participant" && (
                          <div className="space-y-1">
                            <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                              Access Code
                            </label>
                            <input
                              type="text"
                              value={accessCode}
                              onChange={(e) => setAccessCode(e.target.value)}
                              placeholder="Enter administrative code"
                              className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3 text-xs sm:text-sm text-white placeholder-[#52525b] focus:border-[#ff007f] outline-none"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Username or Email Input */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                        Username or Email
                      </label>
                      <div className="relative">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
                        <input
                          type="text"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="username or email"
                          className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3 pl-9 text-xs sm:text-sm text-white placeholder-[#52525b] focus:border-[#ff007f] focus:ring-1 focus:ring-[#ff007f]/40 outline-none transition-all font-sans"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[1.2px] text-[#a1a1aa]">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#050507] border border-white/10 rounded-lg py-2.5 px-3 pl-9 pr-9 text-xs sm:text-sm text-white placeholder-[#52525b] focus:border-[#ff007f] focus:ring-1 focus:ring-[#ff007f]/40 outline-none transition-all font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me & Forgot Password Row */}
                    {!isSignUp && (
                      <div className="flex items-center justify-between text-[10px] pt-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#94a3b8] hover:text-white transition-colors">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-3 h-3 rounded bg-[#050507] border-white/15 text-[#ff007f] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#ff007f]"
                          />
                          <span className="text-[10px]">Remember me</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-[#ff007f] hover:text-[#ff3399] font-medium transition-colors text-[10px]"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    {/* Primary SIGN IN Button */}
                    <button
                      type="submit"
                      disabled={loading || rateLimitCooldown > 0}
                      className="w-full py-3 px-5 bg-[#ff007f] hover:bg-[#e60072] disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-[1.2px] rounded-lg transition-all shadow-[0_0_18px_rgba(255,0,127,0.35)] flex items-center justify-center gap-2 mt-1 cursor-pointer active:scale-[0.99]"
                    >
                      <span>
                        {rateLimitCooldown > 0
                          ? `Rate Limited (${rateLimitCooldown}s)`
                          : loading
                          ? isSignUp
                            ? "Creating Account..."
                            : "Signing in..."
                          : isSignUp
                          ? "Sign Up"
                          : "Sign In"}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  </form>
                )}

                {/* QUICK DEMO ACCESS SECTION (Development Only) */}
                {!isSignUp && step === "credentials" && process.env.NODE_ENV !== "production" && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-center gap-2 mb-2.5">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="text-[8px] font-mono uppercase tracking-[1.5px] text-[#71717a] font-semibold">
                        Quick Demo Access (Dev Only)
                      </span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {/* ADMIN BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleDemoClick("admin@demo.com", "Admin", "/admin")}
                        className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg border border-[#ff007f]/40 hover:border-[#ff007f] bg-[#ff007f]/5 hover:bg-[#ff007f]/15 transition-all cursor-pointer group shadow-[0_0_8px_rgba(255,0,127,0.1)] hover:shadow-[0_0_12px_rgba(255,0,127,0.25)]"
                      >
                        <ShieldCheck size={12} className="text-[#ff007f] group-hover:scale-110 transition-transform" />
                        <span className="font-mono font-bold text-[9px] text-white tracking-wider">ADMIN</span>
                      </button>

                      {/* JUDGE BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleDemoClick("judge@demo.com", "Judge", "/judge")}
                        className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg border border-[#FBC815]/40 hover:border-[#FBC815] bg-[#FBC815]/5 hover:bg-[#FBC815]/15 transition-all cursor-pointer group shadow-[0_0_8px_rgba(251,200,21,0.1)] hover:shadow-[0_0_12px_rgba(251,200,21,0.25)]"
                      >
                        <Gavel size={12} className="text-[#FBC815] group-hover:scale-110 transition-transform" />
                        <span className="font-mono font-bold text-[9px] text-white tracking-wider">JUDGE</span>
                      </button>

                      {/* OPS BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleDemoClick("ops@demo.com", "Ops", "/ops/scanner")}
                        className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg border border-[#ff007f]/40 hover:border-[#ff007f] bg-[#ff007f]/5 hover:bg-[#ff007f]/15 transition-all cursor-pointer group shadow-[0_0_8px_rgba(255,0,127,0.1)] hover:shadow-[0_0_12px_rgba(255,0,127,0.25)]"
                      >
                        <Layers size={12} className="text-[#ff007f] group-hover:scale-110 transition-transform" />
                        <span className="font-mono font-bold text-[9px] text-white tracking-wider">OPS</span>
                      </button>

                      {/* TEAM BUTTON */}
                      <button
                        type="button"
                        onClick={() => handleDemoClick("team@demo.com", "Team Leader", "/team")}
                        className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg border border-[#FBC815]/40 hover:border-[#FBC815] bg-[#FBC815]/5 hover:bg-[#FBC815]/15 transition-all cursor-pointer group shadow-[0_0_8px_rgba(251,200,21,0.1)] hover:shadow-[0_0_12px_rgba(251,200,21,0.25)]"
                      >
                        <Users size={12} className="text-[#FBC815] group-hover:scale-110 transition-transform" />
                        <span className="font-mono font-bold text-[9px] text-white tracking-wider">TEAM</span>
                      </button>
                    </div>

                    <p className="text-[8px] font-mono text-[#71717a] text-center mt-2">
                      Use demo credentials to preview each role (Development Only).
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </main>

      {/* BOTTOM FOOTER ROW */}
      <footer className="relative z-10 w-full px-4 sm:px-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Bottom Left: Pink vertical accent + INNOVATORS AND VISIONARIES CLUB */}
        <div className="flex items-center gap-2">
          <div className="w-[2px] h-5 bg-[#ff007f] rounded-full shadow-[0_0_6px_rgba(255,0,127,0.5)]" />
          <div className="font-mono text-[7px] leading-[1.2] text-[#71717a] tracking-[1.2px] uppercase text-left">
            <div>INNOVATORS AND VISIONARIES CLUB</div>
            <div>VIDYAVARDHAKA COLLEGE OF ENGINEERING</div>
            <div>INUNITY</div>
          </div>
        </div>

        {/* Bottom Right: VVCE × IVC */}
        <div className="flex items-center gap-2 font-mono text-[8px] text-[#71717a] tracking-[2px] uppercase">
          <span className="text-white/40 text-xs leading-none">+</span>
          <span className="font-semibold text-white/70">VVCE</span>
          <span className="text-white/30">×</span>
          <span className="font-semibold text-white/70">IVC</span>
        </div>
      </footer>
    </div>
  );
}
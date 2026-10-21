"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getRoleRedirectUrl } from "@/lib/auth/redirect";
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export default function AuthPage({ isSignUp = false }: { isSignUp?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);


  // Robust sign-in execution
  const executeSignIn = async (userEmail: string, userPass: string, preferredPortal?: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const effectivePass = (!userPass || userPass === "123") ? "Password@123" : userPass;
    const supabase = createClient();
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail.trim().toLowerCase(),
        password: effectivePass,
      });

      // Backward‑compatible fallback for password variant if needed
      if (error && error.message.toLowerCase().includes("invalid login credentials")) {
        const altPass = userPass === "Password@123" ? "Password123!" : "Password@123";
        const retry = await supabase.auth.signInWithPassword({
          email: userEmail.trim().toLowerCase(),
          password: altPass,
        });
        if (retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }

      if (error) throw error;

      if (data?.user) {
        setSuccessMsg("Authenticated! Entering portal...");
        const redirectUrl = preferredPortal || (await getRoleRedirectUrl(data.user));
        // Delay navigation briefly to let Supabase persist the auth session cookie before full reload
        setTimeout(() => {
          // Full reload ensures the next page sees the auth state
          window.location.href = redirectUrl;
        }, 250);
      } else {
        throw new Error("No user record returned from authentication service.");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
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
        const normalizedEmail = email.includes("@") ? email.trim() : `${email.trim()}@ivc.pulse`;
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              role: "participant",
            },
          },
        });

        if (error) throw error;

        if (data?.session && data?.user) {
          const redirectUrl = await getRoleRedirectUrl(data.user);
          router.push(redirectUrl);
          router.refresh();
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 500);
          return;
        }

        setStep("otp");
        setSuccessMsg(`A 6-digit verification code was dispatched to ${email}.`);
        setResendCooldown(60);
      } else {
        // Resolve role aliases or direct emails

        let targetEmail = email.trim();
        let targetPass = password.trim() || "Password@123";


        // Resolve direct email or username
        if (!targetEmail.includes("@")) {
          targetEmail = `${targetEmail}@ivc.pulse`;
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
    const normalizedEmail = email.includes("@") ? email : `${email}@demo.com`;

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
          window.location.href = redirectUrl;
        }, 800);
      } else {
        router.push("/participants");
        router.refresh();
        setTimeout(() => {
          window.location.href = "/participants";
        }, 800);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Invalid or expired verification code. Please try again."
      );
      setLoading(false);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 3000);
    }
  };

  // Determine the correct portal URL for demo accounts based on email prefix
  const getPreferredPortal = (demoEmail: string): string => {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    if (demoEmail.includes('judge')) return `${protocol}//${host}:3001`;
    if (demoEmail.includes('ops')) return `${protocol}//${host}:3003`;
    if (demoEmail.includes('team')) return `${protocol}//${host}:3002`;
    // admin (or fallback) runs on the default port (3000)
    return `${protocol}//${host}:3000`;
  };

  const handleDemoClick = async (demoEmail: string) => {
    // Demo accounts use the default password "123" (mapped to "Password@123")
    await executeSignIn(demoEmail, "123");
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    const normalizedEmail = email.includes("@") ? email : `${email}@demo.com`;

    try {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
        });

      if (error) throw error;

      setSuccessMsg(`A new 6-digit verification code has been dispatched to ${email}`);
      setResendCooldown(60);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 border border-border-color shadow-2xl relative space-y-6">
        {/* Neon accent top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-secondary via-accent-primary to-accent-tertiary" />

        {step === "otp" ? (
          /* OTP Step Header */
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-full bg-surface-color-light border border-accent-tertiary/40 mb-2">
              <KeyRound className="w-8 h-8 text-accent-tertiary animate-pulse" />
            </div>
            <h1 className="font-heading text-2xl md:text-3xl text-text-primary uppercase m-0">
              Verify Account
            </h1>
            <p className="font-tech text-xs text-text-secondary uppercase tracking-wider">
              Enter the 6-digit verification code sent to your email
            </p>
            <p className="font-sans text-xs text-accent-tertiary font-medium">
              {email}
            </p>
          </div>
        ) : (
          /* Credentials Step Header */
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-full bg-surface-color-light border border-border-color mb-2">
              <ShieldCheck className="w-8 h-8 text-accent-secondary" />
            </div>
            <h1 className="font-heading text-2xl md:text-3xl text-text-primary uppercase m-0">
              {isSignUp ? "Create Account" : "Access Portal"}
            </h1>
            <p className="font-tech text-xs text-text-secondary uppercase tracking-wider">
              {isSignUp
                ? "Register for Vice Verse 1.0"
                : "Unified entry point for Admin, Judges, Teams & Staff"}
            </p>
          </div>
        )}

        {/* Feedback banners */}
        {errorMsg && (
          <div className="p-3 bg-status-error/15 border border-status-error text-status-error font-tech text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Demo login buttons (only on login, not sign‑up) */}
        {!isSignUp && step === "credentials" && (
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2 font-tech">Demo Login (One‑click)</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button type="button" onClick={() => handleDemoClick('admin@demo.com')} className="px-3 py-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-black font-tech font-semibold rounded">
                Demo Admin
              </button>
              <button type="button" onClick={() => handleDemoClick('judge@demo.com')} className="px-3 py-2 bg-gradient-to-r from-accent-secondary to-accent-primary text-black font-tech font-semibold rounded">
                Demo Judge
              </button>
              <button type="button" onClick={() => handleDemoClick('ops@demo.com')} className="px-3 py-2 bg-gradient-to-r from-accent-tertiary to-accent-primary text-black font-tech font-semibold rounded">
                Demo Ops
              </button>
              <button type="button" onClick={() => handleDemoClick('team@demo.com')} className="px-3 py-2 bg-gradient-to-r from-accent-secondary to-accent-tertiary text-black font-tech font-semibold rounded">
                Demo Team
              </button>
            </div>
          </div>
        )}

        {step === "otp" ? (
          /* ================= OTP VERIFICATION FORM ================= */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs uppercase text-text-secondary font-tech font-bold tracking-wider">
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
                className="w-full bg-surface-color border border-border-color p-3 text-center text-text-primary text-2xl tracking-[0.4em] font-sans rounded-none focus:border-accent-tertiary focus:shadow-[0_0_15px_rgba(0,240,255,0.25)] outline-none"
                autoFocus
              />
              <p className="text-[11px] text-text-secondary font-tech m-0">
                Check your inbox or spam folder for the one-time code.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6}
              className="w-full py-3 bg-gradient-to-r from-accent-tertiary to-accent-secondary hover:opacity-90 disabled:opacity-50 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? "Verifying Token..." : "Confirm & Enter Portal"}</span>
              <ArrowRight size={14} />
            </button>

            <div className="flex items-center justify-between text-xs font-tech text-text-secondary pt-2 border-t border-border-color/40">
              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 uppercase font-bold"
              >
                <ArrowLeft size={13} />
                <span>Change Email</span>
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0 || resendLoading}
                onClick={handleResendOtp}
                className="text-accent-tertiary hover:underline disabled:opacity-50 disabled:no-underline font-bold uppercase tracking-wider"
              >
                {resendCooldown > 0
                  ? `Resend Code (${resendCooldown}s)`
                  : resendLoading
                  ? "Sending..."
                  : "Resend Code"}
              </button>
            </div>
          </form>
        ) : (
          /* ================= CREDENTIALS FORM ================= */
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="block text-xs uppercase text-text-secondary font-tech font-bold tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-3 text-text-secondary" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-surface-color border border-border-color p-2.5 pl-9 text-text-primary text-xs font-sans tracking-normal focus:border-accent-secondary outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs uppercase text-text-secondary font-tech font-bold tracking-wider">
                 Username or Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-3 text-text-secondary" />
                <input
                   type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                   placeholder="username or email"
                  className="w-full bg-surface-color border border-border-color p-2.5 pl-9 text-text-primary text-xs font-sans tracking-normal focus:border-accent-secondary outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs uppercase text-text-secondary font-tech font-bold tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-3 text-text-secondary" />
                 <input
                   type="password"
                   required
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   placeholder="••••••••"
                   className="w-full bg-surface-color border border-border-color p-2.5 pl-9 text-text-primary text-xs font-sans tracking-normal focus:border-accent-secondary outline-none"
                 />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-accent-secondary to-accent-primary hover:opacity-90 disabled:opacity-50 text-black font-tech font-bold uppercase tracking-wider text-xs transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
            >
               <span>{loading ? "Authenticating..." : isSignUp ? "Sign Up" : "Sign In"}</span>
               <ArrowRight size={14} />
             </button>


          </form>
        )}

        <div className="pt-4 border-t border-border-color text-center font-tech text-xs text-text-secondary">
          {isSignUp ? (
            <p className="m-0">
              Already have an account?{" "}
              <Link href="/login" className="text-accent-secondary font-bold hover:underline">
                Sign In
              </Link>
            </p>
          ) : (
            <p className="m-0">
              New participant?{" "}
              <Link href="/signup" className="text-accent-tertiary font-bold hover:underline">
                Create an account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  className?: string;
  variant?: "icon" | "button" | "menu-item" | "pill";
  label?: string;
  showIcon?: boolean;
}

export default function SignOutButton({
  className = "",
  variant = "button",
  label = "Sign Out",
  showIcon = true,
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out notice:", err);
    } finally {
      // Force hard navigation to login page to wipe memory and reset all router boundaries
      setLoading(false);
      window.location.href = "/login";
    }
  };

  if (variant === "menu-item") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        title="Sign Out"
        className={`w-full flex items-center gap-2 py-2 px-3 text-xs font-tech font-bold uppercase tracking-[1px] text-status-error/80 hover:text-status-error hover:bg-status-error/10 border border-transparent hover:border-status-error/30 rounded transition-all cursor-pointer ${className}`}
      >
        {showIcon && <LogOut size={15} className={loading ? "animate-spin" : ""} />}
        <span>{loading ? "Signing Out..." : label}</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        title="Sign Out"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-status-error/10 border border-status-error/40 text-status-error hover:bg-status-error hover:text-white transition-all font-tech text-xs uppercase font-bold tracking-wider rounded cursor-pointer ${className}`}
      >
        {showIcon && <LogOut size={13} className={loading ? "animate-spin" : ""} />}
        <span>{loading ? "..." : label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      title="Sign Out of Session"
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 font-tech text-xs uppercase font-bold tracking-wider transition-all border border-status-error/40 bg-status-error/10 text-status-error hover:bg-status-error hover:text-black rounded cursor-pointer shadow-[0_0_10px_rgba(255,0,85,0.15)] ${className}`}
    >
      {showIcon && <LogOut size={14} className={loading ? "animate-spin" : ""} />}
      <span>{loading ? "Signing Out..." : label}</span>
    </button>
  );
}

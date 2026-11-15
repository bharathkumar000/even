"use client";

import { useState, useEffect } from "react";
import {
  Menu,
  X,
  QrCode,
  Search,
  Activity,
  Gavel,
  Shield,
  Layers,
  User,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  full_name: string | null;
  role: string | null;
}

export default function OpsMobileNav() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoadingProfile(false);
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        setProfile(profileData);
      } catch (err) {
        console.warn("Failed to fetch user profile in mobile nav:", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const displayName = loadingProfile
    ? "Loading..."
    : profile?.full_name || "Staff / Volunteer";

  const displayRole = loadingProfile
    ? ""
    : profile?.role === "spoc"
    ? "SPOC"
    : profile?.role === "organizer"
    ? "Organizer"
    : "Staff";

  const navItems: { href: string; icon: any; label: string; badge?: string; newTab?: boolean }[] = [
    { href: "/ops/scanner", icon: QrCode, label: "QR Scanner Desk" },
    { href: "/ops/team-lookup", icon: Search, label: "Team Lookup" },
    { href: "/ops/assigned-teams", icon: Shield, label: "My Assigned Teams", badge: "SPOC" },
    { href: "/ops/rounds", icon: Layers, label: "Rounds & Rubrics" },
    { href: "/ops/judges-roster", icon: Gavel, label: "Judges Roster" },
    { href: "/ops/scanner/live-activity", icon: Activity, label: "Live Activity", newTab: true },
  ];

  const bottomNavItems = [
    { href: "/ops/scanner", icon: QrCode, label: "Scanner" },
    { href: "/ops/team-lookup", icon: Search, label: "Lookup" },
    { href: "/ops/assigned-teams", icon: Shield, label: "Assigned" },
    { href: "/ops/rounds", icon: Layers, label: "Rounds" },
    { href: "/ops/judges-roster", icon: Gavel, label: "Jury" },
  ];

  const titleMap: Record<string, string> = {
    "/ops/scanner": "QR Scanner Desk",
    "/ops/team-lookup": "Team Lookup Desk",
    "/ops/assigned-teams": "My Assigned Teams",
    "/ops/rounds": "Rounds & Rubrics",
    "/ops/judges-roster": "Judges Roster",
    "/ops/scanner/live-activity": "Live Activity Stream",
    "/ops/activity": "Activity Feed",
  };
  const title = titleMap[pathname] ?? "Operations Desk";

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex items-center justify-between px-3.5 py-2.5 bg-[#0c0c14]/95 backdrop-blur-md border-b border-border-color md:hidden w-full sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/ivc-logo-transparent.png"
            alt="IVC"
            width={30}
            height={30}
            className="object-contain shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-heading uppercase text-text-primary tracking-wider m-0 truncate max-w-[200px] leading-tight">
              {title}
            </h1>
            <p className="font-tech text-[10px] text-accent-tertiary uppercase font-bold tracking-wider m-0 truncate">
              {displayRole ? `${displayRole} // Desk` : "Operations"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {displayRole && (
            <span className="hidden xs:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-tertiary/15 text-accent-tertiary border border-accent-tertiary/40 uppercase">
              {displayRole}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Toggle menu"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-color/80 border border-border-color text-text-primary hover:text-accent-tertiary transition-colors cursor-pointer shrink-0"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Drawer Container */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ease-in-out ${
          open ? "opacity-100 pointer-events-auto visible" : "opacity-0 pointer-events-none invisible"
        }`}
        aria-hidden={!open}
      >
        {/* Dark Backdrop Overlay */}
        <div
          className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />

        {/* Sliding Navigation Panel */}
        <aside
          className={`relative w-80 max-w-[85vw] h-full bg-[#0c0c14] border-r border-border-color overflow-y-auto p-4 custom-scrollbar flex flex-col justify-between shadow-2xl z-10 transform transition-transform duration-300 ease-in-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Header: Title on Left, Working X Button on Right */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-border-color">
              <div className="flex items-center gap-2.5 min-w-0">
                <Image
                  src="/ivc-logo-transparent.png"
                  alt="IVC"
                  width={32}
                  height={32}
                  className="object-contain shrink-0"
                />
                <div>
                  <h2 className="font-heading text-sm uppercase text-text-primary m-0 tracking-wider truncate">
                    Operations Portal
                  </h2>
                  <p className="font-tech text-[10px] text-accent-tertiary font-bold tracking-wider uppercase m-0">
                    Club Staff Hub
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-white rounded border border-border-color/80 bg-surface-color/80 hover:bg-surface-color-light transition-colors cursor-pointer shrink-0"
              >
                <X size={18} className="text-text-primary" />
              </button>
            </div>

            {/* Staff Identity Card inside Drawer */}
            <div className="mb-4 p-3 bg-surface-color/50 border border-border-color rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-tertiary/15 border border-accent-tertiary/40 flex items-center justify-center shrink-0">
                <User size={18} className="text-accent-tertiary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-xs uppercase text-text-primary m-0 truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-accent-tertiary font-mono font-bold uppercase">
                    {displayRole || "Staff"}
                  </span>
                  <span className="text-[10px] text-text-secondary">•</span>
                  <span className="text-[9px] text-status-success font-mono font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                    Live Desk
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-1.5">
              <p className="font-tech text-[10px] uppercase tracking-[1.5px] text-text-secondary pl-3 mb-1 font-bold">
                Desk Navigation
              </p>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.newTab ? "_blank" : undefined}
                    rel={item.newTab ? "noopener noreferrer" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-medium transition-all duration-200 ease-out active:scale-[0.98] ${
                      isActive
                        ? "bg-[linear-gradient(90deg,#E0026E_0%,#B8005A_26%,#5B0832_60%,#240A1B_85%,#140E17_100%)] text-white shadow-[0_4px_22px_rgba(224,2,110,0.38),inset_0_1px_1px_rgba(255,255,255,0.22)] border border-pink-500/25 font-semibold"
                        : "text-[#94A3B8] border border-transparent hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <item.icon size={17} className={isActive ? "text-white" : "text-[#94A3B8]"} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-border-color space-y-3">
            <SignOutButton variant="menu-item" label="Sign Out (Ops)" />
            <div className="text-[10px] text-text-secondary/60 font-mono tracking-wider flex items-center justify-between px-1">
              <span>IVC-PULSE Ops</span>
              <span>v2.0 Mobile</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Bottom Navigation Bar for Mobile Desks */}
      <nav
        aria-label="Mobile Desks Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c14]/95 backdrop-blur-md border-t border-border-color/80 px-1 py-1 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
      >
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-center transition-all ${
                isActive
                  ? "text-accent-primary font-bold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <item.icon
                size={18}
                className={`transition-transform ${
                  isActive ? "text-accent-primary scale-110" : "text-text-secondary"
                }`}
              />
              <span className="text-[10px] font-tech uppercase tracking-tight mt-0.5 truncate max-w-[60px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

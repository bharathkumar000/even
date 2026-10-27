"use client";

import { useState, useEffect } from "react";
import { Menu, X, QrCode, Search, Activity, Gavel, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default function OpsMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/ops/scanner", icon: QrCode, label: "QR Scanner Desk" },
    { href: "/ops/judges-roster", icon: Gavel, label: "Judges Roster" },
    { href: "/ops/scanner#manual-lookup", icon: Search, label: "Team Lookup" },
    { href: "/ops/scanner#live-activity", icon: Activity, label: "Live Activity" },
  ];

  const titleMap: Record<string, string> = {
    "/ops/scanner": "QR Scanner Desk",
    "/ops/judges-roster": "Judges Roster",
  };
  const title = titleMap[pathname] ?? "Operations Desk";

  // Automatically close drawer when navigating to a new route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0c0c14]/95 backdrop-blur-md border-b border-border-color md:hidden w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image src="/ivc-logo-transparent.png" alt="IVC" width={32} height={32} className="object-contain shrink-0" />
          <h1 className="text-xs sm:text-sm font-heading uppercase text-text-primary tracking-wider m-0 truncate max-w-[200px]">
            {title}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle menu"
          className="p-1.5 text-text-primary hover:text-accent-tertiary transition-colors cursor-pointer"
        >
          <Menu size={24} />
        </button>
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
          className={`relative w-72 max-w-[85vw] h-full bg-[#0c0c14] border-r border-border-color overflow-y-auto p-5 custom-scrollbar flex flex-col justify-between shadow-2xl z-10 transform transition-transform duration-300 ease-in-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Header: Title on Left, Working X Button on Right */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border-color">
              <div className="flex items-center gap-2.5 min-w-0">
                <Image src="/ivc-logo-transparent.png" alt="IVC" width={32} height={32} className="object-contain shrink-0" />
                <h2 className="font-heading text-base uppercase text-text-primary m-0 tracking-wider truncate">
                  Operations Desk
                </h2>
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

            {/* Navigation links */}
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3.5 py-3 px-4 rounded-2xl text-[13px] font-medium transition-all duration-300 ease-out active:scale-[0.98] ${
                      isActive
                        ? "bg-[linear-gradient(90deg,#E0026E_0%,#B8005A_26%,#5B0832_60%,#240A1B_85%,#140E17_100%)] text-white shadow-[0_4px_22px_rgba(224,2,110,0.38),inset_0_1px_1px_rgba(255,255,255,0.22)] border border-pink-500/25 animate-active-pill font-semibold"
                        : "text-[#94A3B8] border border-transparent hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <item.icon size={18} className={isActive ? "text-white" : "text-[#94A3B8]"} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Controls */}
          <div className="pt-6 border-t border-border-color space-y-3">
            <SignOutButton variant="menu-item" label="Sign Out (Ops)" />
          </div>
        </aside>
      </div>
    </>
  );
}

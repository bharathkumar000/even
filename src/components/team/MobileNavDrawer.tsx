"use client";

import { useState } from "react";
import { Menu, X, LayoutDashboard, FileUp, QrCode, Trophy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default function TeamMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/team", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/team/submission", icon: FileUp, label: "Project Deliverables" },
    { href: "/team/qr", icon: QrCode, label: "Event QR Pass" },
    { href: "/team/results", icon: Trophy, label: "Results & Standings" },
  ];

  const titleMap: Record<string, string> = {
    "/team": "Team Dashboard",
    "/team/submission": "Project Deliverables",
    "/team/qr": "Event QR Pass",
    "/team/results": "Results & Standings",
  };
  const title = titleMap[pathname] ?? "Team Portal";

  return (
    <>
      {/* Mobile Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0c0c14]/95 backdrop-blur-md border-b border-border-color md:hidden w-full">
        <div className="flex items-center gap-2.5">
          <Image src="/ivc-gear-logo.png" alt="IVC" width={32} height={32} className="object-contain shrink-0" />
          <h1 className="text-xs sm:text-sm font-heading uppercase text-text-primary tracking-wider m-0 truncate max-w-[200px]">{title}</h1>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-1.5 text-text-primary hover:text-accent-secondary transition-colors">
          <Menu size={24} className="text-text-primary" />
        </button>
      </header>

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 transform ${open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"} transition-transform duration-300 ease-in-out md:hidden`}
        aria-hidden={!open}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-pointer"
          onClick={() => setOpen(false)}
        />
        {/* Panel */}
        <aside className="relative w-72 max-w-[85vw] h-full bg-[#0c0c14] border-r border-border-color overflow-y-auto p-5 custom-scrollbar flex flex-col justify-between shadow-2xl z-10">
          <div>
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-border-color">
              <div className="flex items-center gap-2.5 min-w-0">
                <Image src="/ivc-gear-logo.png" alt="IVC" width={34} height={34} className="object-contain shrink-0" />
                <h2 className="font-heading text-base uppercase text-text-primary m-0 tracking-wider truncate">
                  Team Portal
                </h2>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                aria-label="Close menu"
                className="p-2 text-text-secondary hover:text-white rounded-lg hover:bg-surface-color-light/60 transition-colors cursor-pointer shrink-0"
              >
                <X size={22} className="text-text-primary" />
              </button>
            </div>

            <nav className="flex flex-col gap-2">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 py-2 px-3 rounded ${isActive ? "bg-gradient-to-r from-accent-secondary/20 to-transparent text-text-primary" : "text-text-secondary hover:bg-surface-color-light/40 hover:text-text-primary"}`}
                >
                  <item.icon size={20} className={isActive ? "text-accent-secondary" : ""} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            </nav>
          </div>

          {/* Footer */}
          <div className="mt-8">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 py-2 px-3 text-xs text-text-secondary hover:text-accent-secondary">
              <ArrowLeft size={16} />
              <span>Exit to Home</span>
            </Link>
            <SignOutButton variant="menu-item" label="Sign Out" />
          </div>
        </aside>
      </div>
    </>
  );
}

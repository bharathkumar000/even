"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Contact2,
  Layers,
  FileCheck2,
  Award,
  ScrollText,
  ShieldAlert,
  ArrowLeft,
  Home,
  ScanLine,
  Gavel,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

export default function AdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", icon: Users, label: "Overview" },
    { href: "/admin/users", icon: Users, label: "User Management" },
    { href: "/admin/assignments", icon: UserCheck, label: "Judge Assignments" },
    { href: "/admin/spoc", icon: Contact2, label: "SPOC Management" },
    { href: "/admin/rounds", icon: Layers, label: "Rounds & Criteria" },
    { href: "/admin/evaluations", icon: FileCheck2, label: "Evaluations & Overrides" },
    { href: "/admin/results", icon: Award, label: "Results Engine" },
    { href: "/admin/audit-logs", icon: ScrollText, label: "Audit Logs" },
    { href: "/admin/content-releases", icon: FileCheck2, label: "Content Release" },
  ];

  const [pendingHref, setPendingHref] = useState<string | null>(null);

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside className="w-full md:w-[280px] md:shrink-0 bg-surface-color md:border-r border-b md:border-b-0 border-border-color flex flex-col justify-between py-6 md:h-screen z-20 md:overflow-y-auto overscroll-contain custom-scrollbar">
      <div className="px-6 pb-6 border-b border-border-color flex flex-col items-center text-center shrink-0">
        {/* Top Center Logo */}
        <div className="mb-3.5 relative flex items-center justify-center">
          <Image
            src="/ivc-logo-transparent.png"
            alt="Innovators & Visionaries Club Logo"
            width={72}
            height={72}
            priority
            className="w-[72px] h-[72px] object-contain drop-shadow-[0_0_15px_rgba(255,0,127,0.35)] hover:scale-105 transition-transform"
          />
        </div>

        {/* Respective Portal Heading Below Logo */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-accent-secondary/15 border border-accent-secondary/40 rounded">
              <ShieldAlert className="text-accent-secondary w-4 h-4 animate-pulse" />
            </span>
            <h2 className="font-heading text-[1.4rem] tracking-[2px] m-0 text-text-primary uppercase leading-tight">
              Admin HQ
            </h2>
          </div>
          <p className="font-tech text-[11px] text-accent-primary m-0 font-bold tracking-[1.5px] uppercase mt-1">
            Mission Control
          </p>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 flex flex-col gap-1.5">
        <p className="font-tech text-xs uppercase tracking-[2px] text-text-secondary mb-3 pl-3 font-bold">
          Navigation
        </p>

        {navItems.map((item) => {
          const isCurrentActive =
            pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
          const isPending = pendingHref === item.href;
          const isActive = isCurrentActive || isPending;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => {
                if (pathname !== item.href) {
                  setPendingHref(item.href);
                }
              }}
              className={`group relative flex items-center justify-between py-3.5 px-4 rounded-2xl transition-all duration-300 ease-out active:scale-[0.98] ${
                isActive
                  ? "bg-[linear-gradient(90deg,#E0026E_0%,#B8005A_26%,#5B0832_60%,#240A1B_85%,#140E17_100%)] text-white shadow-[0_4px_22px_rgba(224,2,110,0.38),inset_0_1px_1px_rgba(255,255,255,0.22)] border border-pink-500/25 animate-active-pill"
                  : "text-[#94A3B8] border border-transparent hover:text-white hover:bg-white/[0.04] hover:translate-x-1"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <item.icon
                  size={19}
                  className={`transition-colors duration-200 shrink-0 ${
                    isActive ? "text-white" : "text-[#94A3B8] group-hover:text-white"
                  }`}
                />
                <span
                  className={`text-[14px] font-medium tracking-normal transition-colors duration-200 ${
                    isActive ? "text-white font-semibold" : "text-[#94A3B8] group-hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {isPending && !isCurrentActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#FFF] animate-ping" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="px-4 py-4 border-t border-border-color mt-auto space-y-2 shrink-0">
        <SignOutButton variant="menu-item" label="Sign Out (Admin)" />
      </div>
    </aside>
  );
}

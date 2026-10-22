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
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/users", icon: Users, label: "User Management" },
    { href: "/admin/assignments", icon: UserCheck, label: "Judge Assignments" },
    { href: "/admin/spoc", icon: Contact2, label: "SPOC Management" },
    { href: "/admin/rounds", icon: Layers, label: "Rounds & Criteria" },
    { href: "/admin/evaluations", icon: FileCheck2, label: "Evaluations & Overrides" },
    { href: "/admin/results", icon: Award, label: "Results Engine" },
    { href: "/admin/audit-logs", icon: ScrollText, label: "Audit Logs" },
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
            src="/ivc-gear-logo.png"
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

      <div className="flex-1 py-6 px-4 flex flex-col gap-2">
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
              className={`group flex items-center justify-between py-3 px-4 font-tech font-semibold uppercase tracking-[1px] transition-all duration-150 border-l-[3px] ${
                isActive
                  ? "bg-gradient-to-r from-[rgba(255,0,127,0.2)] to-transparent text-text-primary border-accent-secondary"
                  : "text-text-secondary border-transparent hover:bg-[rgba(255,255,255,0.03)] hover:text-text-primary hover:border-border-color hover:pl-5"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  size={18}
                  className={isActive ? "text-accent-secondary" : "group-hover:text-text-primary"}
                />
                <span
                  style={{
                    textShadow: isActive
                      ? "0 0 10px #FF007F, 0 0 20px rgba(255,0,127,0.5)"
                      : "none",
                  }}
                >
                  {item.label}
                </span>
              </div>
              {isPending && !isCurrentActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-accent-secondary animate-ping" />
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

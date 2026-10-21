"use client";

import { useState } from "react";
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
    "/ops/scanner": "QR Verification Desk",
    "/ops/judges-roster": "Judges Roster",
  };
  const title = titleMap[pathname] ?? "Ops Portal";

  return (
    <>
      {/* Mobile Header */}
       <header className="flex items-center justify-between px-4 py-2 bg-[#0c0c14] border-b border-border-color md:hidden z-10">
        <div className="flex items-center gap-2">
          <Image src="/ivc-gear-logo.png" alt="IVC" width={36} height={36} className="object-contain" />
          <h1 className="text-sm font-heading uppercase text-text-primary">{title}</h1>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2">
          <Menu size={24} className="text-text-primary" />
        </button>
      </header>

      {/* Drawer */}
       <div
         className={`fixed inset-0 z-50 transform ${open ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out md:hidden`}
         aria-hidden={!open}
       >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        {/* Panel */}
        <aside className="relative w-64 h-full bg-[#0c0c14] overflow-y-auto p-6 custom-scrollbar">
           <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-4 p-1 z-10" type="button">
             <X size={24} className="text-text-primary" />
           </button>

          <div className="mb-6 flex items-center gap-2">
            <Image src="/ivc-gear-logo.png" alt="IVC" width={48} height={48} className="object-contain" />
            <h2 className="font-heading text-lg uppercase text-text-primary">Operations Portal</h2>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 py-2 px-3 rounded ${isActive ? "bg-gradient-to-r from-accent-tertiary/20 to-transparent text-text-primary" : "text-text-secondary hover:bg-surface-color-light/40 hover:text-text-primary"}`}
                >
                  <item.icon size={20} className={isActive ? "text-accent-tertiary" : ""} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="mt-8">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-2 px-3 text-xs text-text-secondary hover:text-accent-tertiary"
            >
              <ArrowLeft size={16} />
              <span>Exit to Home</span>
            </Link>
            <SignOutButton variant="menu-item" label="Sign Out (Ops)" />
          </div>
        </aside>
      </div>
    </>
  );
}

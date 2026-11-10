import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Instagram, Linkedin } from "lucide-react";

export default function RelayathonFooter() {
  return (
    <footer className="bg-[#060606] text-white border-t-[3px] border-red-600 pt-16 pb-10 relative overflow-hidden mt-16">
      {/* Background Subtle Tech Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255, 215, 0, 0.015) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 215, 0, 0.015) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-14">
          {/* Column 1: Brand & Affiliations */}
          <div className="space-y-7">
            <div className="space-y-3">
              <div className="mb-2">
                <Image
                  src="/relaython_logo@2x.png"
                  alt="Relaython"
                  width={220}
                  height={42}
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-sm m-0">
                The ultimate high-octane Formula 1 innovation Grand Prix. 4-driver constructor teams navigate technical relay sprints to engineer breakthrough solutions on November 24th, 2026.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-heading text-lg text-white m-0 tracking-wider uppercase font-black italic">
                AFFILIATIONS
              </h4>

              <div className="space-y-4">
                {/* Organised By: VVCE + Dept of ECE + IVC */}
                <div>
                  <div className="text-[11px] text-neutral-400 font-mono uppercase mb-2">
                    // ORGANISED BY
                  </div>
                  <div className="inline-flex items-center gap-3 bg-white/[0.03] p-2.5 rounded-md border border-white/10">
                    <Image
                      src="/vvce_logo.png"
                      alt="VVCE Logo"
                      width={40}
                      height={40}
                      className="h-9 w-auto object-contain"
                    />
                    <div className="w-px h-6 bg-white/20" />
                    {/* ECE Department Logo replacing CS */}
                    <Image
                      src="/ece_logo.png"
                      alt="ECE Department Logo"
                      width={40}
                      height={40}
                      className="h-9 w-auto object-contain rounded"
                    />
                    <div className="w-px h-6 bg-white/20" />
                    <Image
                      src="/ivc.jpg"
                      alt="IVC Logo"
                      width={40}
                      height={40}
                      className="h-9 w-auto object-contain rounded"
                    />
                  </div>
                </div>

                {/* In Collaboration With: InUnity */}
                <div>
                  <div className="text-[11px] text-neutral-400 font-mono uppercase mb-2">
                    // IN COLLABORATION WITH
                  </div>
                  <div className="inline-flex items-center justify-center bg-black/90 px-4 py-2 rounded-md border border-white/10 shadow-sm">
                    <Image
                      src="/in.png"
                      alt="InUnity Logo"
                      width={80}
                      height={24}
                      className="h-6 w-auto object-contain brightness-110"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Navigational Grid */}
          <div>
            <h4 className="font-heading text-lg text-white mb-4 tracking-wider uppercase font-black italic">
              NAVIGATIONAL GRID
            </h4>
            <ul className="space-y-3 text-sm font-mono text-neutral-400 list-none p-0 m-0">
              <li>
                <Link href="/" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> HOME
                </Link>
              </li>
              <li>
                <Link href="/event-details" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> CIRCUIT BRIEF
                </Link>
              </li>
              <li>
                <Link href="/event-flow" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> RACE TRACKS
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> CHALLENGES
                </Link>
              </li>
              <li>
                <Link href="/schedule" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> RACE SCHEDULE
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> PODIUM LOOT
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-red-500 transition-colors flex items-center gap-2">
                  <span className="text-red-600">▸</span> RACE FAQ
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-red-500 font-bold hover:text-red-400 transition-colors flex items-center gap-2">
                  <span className="text-red-500">▸</span> REGISTER SQUAD
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hotline (Contact) */}
          <div>
            <h4 className="font-heading text-lg text-white mb-4 tracking-wider uppercase font-black italic">
              HOTLINE (CONTACT)
            </h4>
            <ul className="space-y-4 text-sm font-mono text-neutral-400 list-none p-0 m-0">
              <li>
                <div className="text-white font-bold text-xs uppercase mb-1">
                  // CREW LEADER HELPLINES
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <a href="tel:+916361455193" className="text-red-500 hover:text-red-400 transition-colors font-bold">
                    Parinitha: +91 63614 55193
                  </a>
                  <a href="tel:+918310353103" className="text-red-500 hover:text-red-400 transition-colors font-bold">
                    Moksh: +91 83103 53103
                  </a>
                  <a href="tel:+919019928883" className="text-red-500 hover:text-red-400 transition-colors font-bold">
                    Rishith: +91 90199 28883
                  </a>
                </div>
              </li>
              <li>
                <div className="text-white font-bold text-xs uppercase mb-1">
                  // SECURE INTEL EMAIL
                </div>
                <a href="mailto:ivc@vvce.ac.in" className="text-red-500 hover:text-red-400 transition-colors text-xs">
                  ivc@vvce.ac.in
                </a>
              </li>
              <li>
                <div className="text-white font-bold text-xs uppercase mb-1">
                  // CLUB INTEL HUB
                </div>
                <a
                  href="https://ivc-vvce.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:text-red-400 transition-colors text-xs"
                >
                  ivc-vvce.vercel.app
                </a>
              </li>
              <li>
                <div className="text-white font-bold text-xs uppercase mb-1">
                  // CITY COORDINATES
                </div>
                <span className="text-neutral-400 text-xs leading-relaxed">
                  VVCE Sports Complex,<br />
                  Gokulam 3rd Stage, Mysuru
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Socials */}
        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-white/10 pt-6 text-neutral-400 text-xs gap-4 font-mono">
          <div>
            © 2026 | RELAYTHON | Innovators &amp; Visionaries Club (IVC) &amp; Dept. of ECE, VVCE in collaboration with inunity. All Rights Reserved.
          </div>
          <div className="flex gap-5 items-center text-neutral-400">
            <a
              href="https://instagram.com/the.official.ivc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram (@the.official.ivc)"
              className="hover:text-red-500 transition-colors"
            >
              <Instagram size={20} />
            </a>
            <a
              href="https://www.linkedin.com/company/ivc-innovators-visionaries-club/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn (IVC - Innovators & Visionaries Club)"
              className="hover:text-red-500 transition-colors"
            >
              <Linkedin size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}


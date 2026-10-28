import Image from "next/image";

export default function PartnerLogosBar() {
  return (
    <div className="py-2.5 px-3 bg-surface-color/60 border border-border-color/80 rounded flex flex-col items-center gap-2">
      {/* Top VVCE College Emblem with Warm Amber Glow */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-md scale-110 pointer-events-none" />
        <Image
          src="/vvce-logo.png"
          alt="Vidyavardhaka College of Engineering Logo"
          width={46}
          height={46}
          className="relative object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        />
      </div>

      {/* Bottom Logos: IVC Gear Logo x InUnity */}
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-border-color/40 w-full">
        {/* IVC Gear Logo with subtle pink/crimson glow */}
        <div className="relative flex items-center justify-center shrink-0">
          <div className="absolute inset-0 rounded-full bg-accent-secondary/15 blur-sm pointer-events-none" />
          <Image
            src="/ivc-logo-transparent.png"
            alt="Innovators & Visionaries Club (IVC) Logo"
            width={34}
            height={34}
            className="relative object-contain drop-shadow-[0_0_6px_rgba(255,0,127,0.4)]"
          />
        </div>

        <span className="font-tech text-xs text-text-secondary font-bold select-none">
          ×
        </span>

        {/* InUnity Partner Logo */}
        <div className="flex items-center justify-center shrink-0">
          <Image
            src="/inunityllp_logo-removebg-preview.png"
            alt="InUnity Innovation For Community"
            width={85}
            height={22}
            className="object-contain brightness-110 drop-shadow-[0_0_6px_rgba(0,240,255,0.3)]"
          />
        </div>
      </div>
    </div>
  );
}

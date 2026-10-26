export const SITE_CONFIG = {
  name: "EVENTRA | IVC PULSE",
  shortName: "EVENTRA",
  eventName: "Vice Verse 1.0 Ideathon",
  tagline: "Central Hackathon & Multi-Portal Event Operating System",
  description:
    "Official multi-portal hackathon platform powering Vice Verse 1.0 Ideathon, organized by the Innovators and Visionaries Club (IVC) at Vidyavardhaka College of Engineering (VVCE), Mysuru in partnership with InUnity.",
  canonicalUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://eventra-ivc.vercel.app",
  organization: {
    name: "Innovators and Visionaries Club (IVC)",
    college: "Vidyavardhaka College of Engineering (VVCE)",
    collegeUrl: "https://vvce.ac.in",
    partner: "InUnity",
    city: "Mysuru",
    state: "Karnataka",
    country: "India",
    venue: "Sri H. Kempegowda Indoor Sports Complex, VVCE Campus, Gokulam 3rd Stage, Mysuru, Karnataka 570002",
  },
  keywords: [
    "EVENTRA",
    "IVC PULSE",
    "Vice Verse 1.0",
    "Vice Verse Ideathon",
    "VVCE Hackathon",
    "Innovators and Visionaries Club",
    "Vidyavardhaka College of Engineering",
    "InUnity Ideathon",
    "Mysuru Hackathon 2026",
    "Student Innovation Competition",
    "Jury Scoring Rubric",
    "Hackathon Event Management System",
  ],
  social: {
    ogImage: "/Vice_verse_logo.png",
    twitterCard: "summary_large_image",
  },
};

export function getCanonicalUrl(path: string = ""): string {
  const base = SITE_CONFIG.canonicalUrl.replace(/\/+$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base}${cleanPath}`;
}

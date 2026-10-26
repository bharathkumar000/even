import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements } from "@/app/actions/announcements";
import GatewayClient from "@/components/gateway/GatewayClient";
import { SITE_CONFIG, getCanonicalUrl } from "@/lib/seo-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EVENTRA · Central Hackathon & Event Portal | Vice Verse 1.0",
  description: SITE_CONFIG.description,
  alternates: {
    canonical: getCanonicalUrl("/"),
  },
  openGraph: {
    title: "EVENTRA · Central Hackathon & Event Portal | Vice Verse 1.0",
    description: SITE_CONFIG.description,
    url: getCanonicalUrl("/"),
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: "/Vice_verse_logo.png",
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.eventName} - ${SITE_CONFIG.organization.name}`,
      },
    ],
  },
};

export default async function HomePage() {
  let userProfile: {
    id: string;
    email?: string;
    role?: string;
    fullName?: string;
  } | null = null;

  try {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.includes("-auth-token") || c.name.startsWith("sb-"));

    if (hasAuthCookie) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .maybeSingle();

          const resolvedRole =
            profile?.role ||
            (user.user_metadata?.role as string | undefined) ||
            (user.app_metadata?.role as string | undefined) ||
            "participant";

          const resolvedName =
            profile?.full_name ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split("@")[0] ||
            "Authenticated User";

          userProfile = {
            id: user.id,
            email: user.email,
            role: resolvedRole,
            fullName: resolvedName,
          };
        } catch {
          userProfile = {
            id: user.id,
            email: user.email,
            role: (user.user_metadata?.role as string | undefined) || "participant",
            fullName: user.email?.split("@")[0],
          };
        }
      }
    }
  } catch (authErr) {
    // Graceful fallback for unauthenticated visitors or cold connection
    userProfile = null;
  }

  // Fetch real-time announcements & telemetry concurrently with bounded timeout
  let announcements: any[] = [];
  let activeRoundTitle = "Round 1: Innovation & Pitch";
  let teamsCount = 20;
  let judgesCount = 5;

  try {
    const dataFetchPromise = Promise.all([
      Promise.resolve(getActiveAnnouncements("all")).catch(() => []),
      Promise.resolve(
        supabaseAdmin
          .from("evaluation_rounds")
          .select("title")
          .eq("status", "open")
          .order("sequence_order", { ascending: true })
          .limit(1)
          .maybeSingle()
      ).catch(() => null),
      Promise.resolve(
        supabaseAdmin.from("teams").select("*", { count: "exact", head: true })
      ).catch(() => null),
      Promise.resolve(
        supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "judge")
      ).catch(() => null),
    ]);

    const [announcementsRes, roundRes, teamsRes, judgesRes] = await Promise.race([
      dataFetchPromise,
      new Promise<any[]>((resolve) =>
        setTimeout(() => resolve([[], null, null, null]), 600)
      ),
    ]);

    if (Array.isArray(announcementsRes)) {
      announcements = announcementsRes;
    }
    if (roundRes?.data?.title) {
      activeRoundTitle = roundRes.data.title;
    }
    if (typeof teamsRes?.count === "number" && teamsRes.count > 0) {
      teamsCount = teamsRes.count;
    }
    if (typeof judgesRes?.count === "number" && judgesRes.count > 0) {
      judgesCount = judgesRes.count;
    }
  } catch {
    // Default telemetry fallbacks utilized
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.canonicalUrl,
    description: SITE_CONFIG.description,
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.organization.name,
      url: SITE_CONFIG.canonicalUrl,
    },
  };

  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Hackathon",
    name: SITE_CONFIG.eventName,
    description: SITE_CONFIG.description,
    startDate: "2026-10-26T09:00:00+05:30",
    endDate: "2026-10-27T18:00:00+05:30",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: "Sri H. Kempegowda Indoor Sports Complex",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Vidyavardhaka College of Engineering Campus, Gokulam 3rd Stage",
        addressLocality: "Mysuru",
        addressRegion: "Karnataka",
        postalCode: "570002",
        addressCountry: "IN",
      },
    },
    organizer: {
      "@type": "Organization",
      name: SITE_CONFIG.organization.name,
      url: SITE_CONFIG.canonicalUrl,
    },
    sponsor: {
      "@type": "Organization",
      name: SITE_CONFIG.organization.partner,
    },
    image: [`${SITE_CONFIG.canonicalUrl}/Vice_verse_logo.png`],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <GatewayClient
        user={userProfile}
        announcements={announcements}
        stats={{
          teamsCount,
          judgesCount,
          activeRoundTitle,
        }}
      />
    </>
  );
}

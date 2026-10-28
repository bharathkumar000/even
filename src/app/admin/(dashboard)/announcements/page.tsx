import { getAnnouncementCounts, getAnnouncementsAdmin, getAnnouncementsForPortal } from "@/app/actions/announcements";
import AnnouncementsClient from "./announcements-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Announcements · Admin HQ | Eventra",
  description: "Manage system-wide announcements across all portals",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; audience?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status as any;
  const audience = params.audience as any;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 20;
  const offset = (page - 1) * 20;

  const [counts, announcementsData] = await Promise.all([
    getAnnouncementCounts(),
    getAnnouncementsAdmin({ status, audience, search, limit, offset }),
  ]);

  return (
    <AnnouncementsClient
      initialCounts={counts}
      initialAnnouncements={announcementsData.announcements}
      total={announcementsData.total}
      currentPage={page}
      totalPages={Math.ceil(announcementsData.total / 20)}
      filters={{ status, audience, search }}
    />
  );
}
import { NextResponse } from "next/server";
import { getAnnouncementsForPortal } from "@/app/actions/announcements";
import type { AnnouncementAudience } from "@/app/actions/announcements";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const audience = (searchParams.get("audience") || "all") as AnnouncementAudience;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const announcements = await getAnnouncementsForPortal(audience, limit);
    return NextResponse.json({ announcements });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
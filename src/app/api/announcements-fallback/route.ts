import { NextResponse } from "next/server";
import { getAnnouncementsForPortal } from "@/app/actions/announcements";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const audience = (searchParams.get("audience") || "all") as any;
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const announcements = await getAnnouncementsForPortal(audience, limit);
    return NextResponse.json({ announcements });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
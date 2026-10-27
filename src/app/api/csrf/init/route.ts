import { NextResponse } from "next/server";
import { getCsrfToken } from "@/lib/csrf-server";

export async function GET() {
  try {
    // This will create and set the CSRF token cookie
    const token = await getCsrfToken();
    
    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error("CSRF init error:", error);
    return NextResponse.json({ success: false, error: "Failed to initialize CSRF token" }, { status: 500 });
  }
}
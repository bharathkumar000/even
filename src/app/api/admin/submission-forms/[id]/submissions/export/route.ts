import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    // Get all submissions for this form
    const { data: submissions, error } = await supabaseAdmin
      .from("team_submission_final")
      .select(`
        id,
        team_id,
        version,
        status,
        answers,
        file_references,
        submitted_by,
        submitted_at,
        reference_number,
        created_at,
        teams (
          id,
          name,
          track,
          leader_name
        ),
        profiles!submitted_by (
          id,
          full_name,
          email
        )
      `)
      .eq("form_id", id)
      .order("submitted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build CSV content
    const headers = [
      "Reference Number",
      "Team Name",
      "Team Track",
      "Team Leader",
      "Leader Email",
      "Version",
      "Status",
      "Submitted At",
      "Submitted By",
      "Answers (JSON)",
      "Files (JSON)",
    ];

    const rows = (submissions || []).map((s: any) => {
      const teamName = s.teams?.name || "";
      const teamTrack = s.teams?.track || "";
      const teamLeader = s.teams?.leader_name || "";
      const leaderEmail = s.profiles?.email || "";

      return [
        `"${s.reference_number}"`,
        `"${teamName}"`,
        `"${teamTrack}"`,
        `"${teamLeader}"`,
        `"${leaderEmail}"`,
        s.version.toString(),
        `"${s.status}"`,
        `"${s.submitted_at}"`,
        `"${s.profiles?.full_name || ""}"`,
        `"${JSON.stringify(s.answers || {}).replace(/"/g, '""')}"`,
        `"${JSON.stringify(s.file_references || []).replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="submission-form-${id}-submissions.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Export failed" }, { status: 500 });
  }
}

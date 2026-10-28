import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";
import { checkRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Rate limiting
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(clientId, RATE_LIMITS.api.write);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter || 60) } }
    );
  }

  try {
    const body = await req.json();
    const { statementId, [CSRF_CONSTANTS.HEADER_NAME]: csrfToken } = body;

    // Validate CSRF token
    await validateCsrfToken(csrfToken || null);

    if (!statementId) {
      return NextResponse.json({ error: "Missing statementId" }, { status: 400 });
    }

    // Authenticate user from the request cookies.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // Verify user is a team leader
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError || !membership?.team_id) {
      return NextResponse.json({ error: "User not part of a team" }, { status: 403 });
    }
    if (membership.role !== "leader") {
      return NextResponse.json({ error: "Only team leaders can select a problem statement" }, { status: 403 });
    }
    const teamId = membership.team_id as string;

    // Verify the problem statement is published and selection enabled
    const { data: stmt, error: stmtError } = await supabaseAdmin
      .from('problem_statements')
      .select('id, team_limit, enable_selection, manual_lock')
      .eq('id', statementId)
      .eq('status', 'published')
      .maybeSingle();
    if (stmtError || !stmt) {
      return NextResponse.json({ error: 'Problem statement not found or not published' }, { status: 404 });
    }

    if (!stmt.enable_selection) {
      return NextResponse.json({ error: 'Team selection is disabled for this problem statement' }, { status: 400 });
    }
    if (stmt.manual_lock) {
      return NextResponse.json({ error: 'Problem statement is manually locked and cannot be selected' }, { status: 400 });
    }

    // Attempt to allocate – use insert to enforce unique team assignment.
    const { error: insertError } = await supabaseAdmin
      .from('team_problem_statement_assignments')
      .upsert(
        {
          team_id: teamId,
          problem_statement_id: stmt.id,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      );

    if (insertError) {
      // Likely capacity‑limit violation or duplicate assignment.
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    return response;


  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
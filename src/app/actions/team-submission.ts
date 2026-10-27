"use server";

import { requireTeamLeader } from "@/lib/auth/team";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  TeamSubmissionSchema,
  type TeamSubmissionInput,
} from "@/lib/validations/team";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export async function upsertTeamSubmission(data: TeamSubmissionInput & { [CSRF_CONSTANTS.HEADER_NAME]?: string }) {
  // 1. Authorize: user must be team leader of this specific team
  await requireTeamLeader(data.team_id);
  await validateCsrfToken(data[CSRF_CONSTANTS.HEADER_NAME] || null);

  // 2. Validate input format
  const validated = TeamSubmissionSchema.parse(data);

  // 3. Verify target round is active and not closed/locked, and that final hours stage is open
  const { data: round, error: roundError } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id, title, status")
    .eq("id", validated.round_id)
    .single();

  if (roundError || !round) {
    throw new Error(`Round not found: ${roundError?.message || "Invalid round ID"}`);
  }

  if (round.status === "closed" || round.status === "locked") {
    throw new Error(
      `Deliverable submissions for round "${round.title}" are locked (${round.status.toUpperCase()}).`
    );
  }

  // 4. Verify Final Hours stage is open
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('event_settings')
    .select('final_hours_open')
    .maybeSingle();
  if (settingsError) {
    throw new Error('Unable to verify event stage configuration.');
  }
  if (!settings?.final_hours_open) {
    throw new Error('Final Hours stage is not open yet. Submissions are locked.');
  }

  const { data: submission, error: subError } = await supabaseAdmin
    .from("team_submissions")
    .upsert(
      {
        team_id: validated.team_id,
        round_id: validated.round_id,
        problem_statement: validated.problem_statement,
        problem_description: validated.problem_description,
        proposed_solution: validated.proposed_solution,
        solution_description: validated.solution_description,
        ppt_url: validated.ppt_url,
        github_url: validated.github_url || null,
        pitch_deck_url: validated.pitch_deck_url || null,
        prototype_url: validated.prototype_url || null,
        additional_material_url: validated.additional_material_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,round_id" }
    )
    .select()
    .single();

  if (subError) {
    throw new Error(`Failed to save team submission: ${subError.message}`);
  }

  return { submission, success: true };
}

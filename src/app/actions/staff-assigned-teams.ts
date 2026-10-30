"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface AssignedTeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  joined_at: string;
}

export interface AssignedTeam {
  id: string;
  name: string;
  code: string | null;
  track: string | null;
  status: string;
  leader_name: string | null;
  leader_email: string | null;
  leader_phone: string | null;
  problem_statement: string | null;
  problem_description: string | null;
  proposed_solution: string | null;
  solution_description: string | null;
  ppt_url: string | null;
  github_url: string | null;
  pitch_deck_url: string | null;
  prototype_url: string | null;
  additional_material_url: string | null;
  demo_url: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  members: AssignedTeamMember[];
  assignment: {
    spoc_id: string;
    spoc_name: string;
    allotted_at: string;
  };
  event_results: {
    total_score: number | null;
    average_score: number | null;
    evaluations_count: number | null;
    rank: number | null;
    is_published: boolean;
    is_locked: boolean;
    published_at: string | null;
  } | null;
  submissions: {
    id: string;
    round_id: string;
    ppt_url: string;
    github_url: string | null;
    pitch_deck_url: string | null;
    prototype_url: string | null;
    additional_material_url: string | null;
    demo_url: string | null;
    created_at: string;
    updated_at: string;
  }[];
}

export interface StaffAssignedTeamsData {
  teams: AssignedTeam[];
  staff: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
  } | null;
  error?: string;
}

export async function getMyAssignedTeams(): Promise<StaffAssignedTeamsData> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { teams: [], staff: null, error: "Unauthorized: Authentication required" };
  }
  const user = authData.user;

  // Get staff profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, email, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { teams: [], staff: null, error: "Staff profile not found" };
  }

  if (profile.role !== "staff" && profile.role !== "organizer" && profile.role !== "spoc") {
    return { teams: [], staff: null, error: "Access denied: Staff access required" };
  }

  // Get the SPOC record linked to this staff member
  const { data: spocRow, error: spocError } = await supabaseAdmin
    .from("spocs")
    .select("id, name, email, phone, department, created_at, staff_id")
    .eq("staff_id", profile.id)
    .maybeSingle();

  if (spocError) {
    return { teams: [], staff: null, error: `Failed to load SPOC record: ${spocError.message}` };
  }

  if (!spocRow) {
    // Staff member has no linked SPOC record
    return {
      teams: [],
      staff: {
        id: profile.id,
        name: profile.full_name || "Staff Member",
        email: profile.email,
        phone: null,
        department: null,
      },
      error: "No SPOC record found for this staff member. Contact admin to create one.",
    };
  }

  // Get team assignments for this SPOC
  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from("team_spoc_assignments")
    .select("spoc_id, team_id, allotted_at")
    .eq("spoc_id", spocRow.id);

  if (assignmentsError) {
    return { teams: [], staff: null, error: `Failed to load team assignments: ${assignmentsError.message}` };
  }

  if (!assignments || assignments.length === 0) {
    return {
      teams: [],
      staff: {
        id: spocRow.id,
        name: spocRow.name,
        email: spocRow.email,
        phone: spocRow.phone,
        department: spocRow.department,
      },
    };
  }

  const teamIds = assignments.map((a) => a.team_id);
  const allottedAtMap = new Map(assignments.map((a) => [a.team_id, a.allotted_at]));

  // Get team details
  const { data: teamsData, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("*")
    .in("id", teamIds);

  if (teamsError) {
    return { teams: [], staff: null, error: `Failed to load teams: ${teamsError.message}` };
  }

  // Get team members for all assigned teams
  const { data: membersData, error: membersError } = await supabaseAdmin
    .from("team_members")
    .select("id, team_id, user_id, role, name, email, joined_at")
    .in("team_id", teamIds);

  if (membersError) {
    console.error("Failed to load team members:", membersError.message);
  }

  // Get team submissions
  const { data: submissionsData, error: submissionsError } = await supabaseAdmin
    .from("team_submissions")
    .select("*")
    .in("team_id", teamIds);

  if (submissionsError) {
    console.error("Failed to load submissions:", submissionsError.message);
  }

  // Get event results
  const { data: resultsData, error: resultsError } = await supabaseAdmin
    .from("event_results")
    .select("*")
    .in("team_id", teamIds);

  if (resultsError) {
    console.error("Failed to load event results:", resultsError.message);
  }

  // Get team leader profiles for contact info
  // const leaderProfileIds = new Set<string>();
  // for (const team of (teamsData || [])) {
  //   // Try to find team leader from team_members
  // }

  // Build member map by team
  const membersByTeam = new Map<string, AssignedTeamMember[]>();
  for (const member of (membersData || [])) {
    if (!membersByTeam.has(member.team_id)) {
      membersByTeam.set(member.team_id, []);
    }
    membersByTeam.get(member.team_id)!.push({
      id: member.id,
      name: member.name || member.email?.split("@")[0] || "Member",
      email: member.email,
      role: member.role,
      joined_at: member.joined_at,
    });
  }

  // Build submissions map by team
  const submissionsByTeam = new Map<string, typeof submissionsData>();
  for (const submission of (submissionsData || [])) {
    if (!submissionsByTeam.has(submission.team_id)) {
      submissionsByTeam.set(submission.team_id, []);
    }
    submissionsByTeam.get(submission.team_id)!.push(submission);
  }

  // Build results map by team
  const resultsByTeam = new Map<string, NonNullable<typeof resultsData>[number]>();
  for (const result of (resultsData || [])) {
    resultsByTeam.set(result.team_id, result);
  }

  // Build team leader map
  const leaderMap = new Map<string, { name: string; email: string | null; phone: string | null }>();
  for (const member of (membersData || [])) {
    if (member.role === "leader") {
      leaderMap.set(member.team_id, {
        name: member.name || member.email?.split("@")[0] || "Team Leader",
        email: member.email,
        phone: null, // phone not in team_members
      });
    }
  }

  // Build final team data
  const teams: AssignedTeam[] = (teamsData || []).map((team) => {
    const members = membersByTeam.get(team.id) || [];
    const leader = leaderMap.get(team.id) || {
      name: team.leader_name || "Not assigned",
      email: null,
      phone: null,
    };
    const submissions = submissionsByTeam.get(team.id) || [];
    const results = resultsByTeam.get(team.id) || null;
    const assignmentDate = allottedAtMap.get(team.id) || null;

    return {
      id: team.id,
      name: team.name,
      code: team.code,
      track: team.track,
      status: team.status || "active",
      leader_name: leader.name,
      leader_email: leader.email,
      leader_phone: leader.phone,
      problem_statement: team.problem_statement || null,
      problem_description: team.problem_description || null,
      proposed_solution: team.proposed_solution || null,
      solution_description: team.solution_description || null,
      ppt_url: team.ppt_url || null,
      github_url: team.github_url || null,
      pitch_deck_url: team.pitch_deck_url || null,
      prototype_url: team.prototype_url || null,
      additional_material_url: team.additional_material_url || null,
      demo_url: team.demo_url || null,
      created_at: team.created_at,
      updated_at: team.updated_at,
      member_count: members.length,
      members,
      assignment: {
        spoc_id: spocRow.id,
        spoc_name: spocRow.name || "SPOC",
        allotted_at: assignmentDate || new Date().toISOString(),
      },
      event_results: results
        ? {
            total_score: results.total_score,
            average_score: results.average_score,
            evaluations_count: results.evaluations_count,
            rank: results.rank,
            is_published: results.is_published,
            is_locked: results.is_locked,
            published_at: results.published_at,
          }
        : null,
      submissions: submissions.map((s) => ({
        id: s.id,
        round_id: s.round_id,
        ppt_url: s.ppt_url,
        github_url: s.github_url,
        pitch_deck_url: s.pitch_deck_url,
        prototype_url: s.prototype_url,
        additional_material_url: s.additional_material_url,
        demo_url: s.demo_url,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    };
  });

  return {
    teams,
    staff: {
      id: spocRow.id,
      name: spocRow.name,
      email: spocRow.email,
      phone: spocRow.phone,
      department: spocRow.department,
    },
  };
}
/**
 * Centralized TypeScript Domain Types for IVC-PULSE
 */

export type UserRole =
  | "admin"
  | "judge"
  | "staff"
  | "spoc"
  | "leader"
  | "participant";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Team {
  id: string;
  name: string;
  track: string;
  code: string;
  leader_name?: string | null;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id?: string | null;
  role: "leader" | "member";
  name: string;
  email: string;
  phone?: string | null;
}

export type RoundStatus = "draft" | "open" | "closed" | "completed";

export interface EvaluationRound {
  id: string;
  title: string;
  sequence_order: number;
  status: RoundStatus;
  max_score?: number | null;
  created_at?: string;
}

export interface EvaluationCriterion {
  id: string;
  round_id: string;
  title: string;
  max_points: number;
  weight: number;
}

export interface Evaluation {
  id: string;
  round_id: string;
  team_id: string;
  judge_id: string;
  feedback?: string | null;
  total_score: number;
  created_at?: string;
}

export interface EventResult {
  id: string;
  team_id: string;
  total_score: number;
  average_score: number;
  evaluations_count: number;
  rank?: number | null;
  is_published: boolean;
  published_at?: string | null;
}

export type ActivityActionType =
  | "check_in"
  | "kit_collected"
  | "tea_token"
  | "lunch_token"
  | "dinner_token";

export interface ActivityLog {
  id: string;
  team_id: string;
  action_type: ActivityActionType;
  performed_by: string;
  notes?: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  severity: "info" | "warning" | "critical";
  target_role: "all" | "team" | "judge" | "staff";
  is_active: boolean;
  created_at?: string;
}

export interface SpocAssignment {
  id: string;
  spoc_id: string;
  team_id: string;
  spoc_profile?: UserProfile;
  team?: Team;
}

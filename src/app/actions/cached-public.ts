"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveAnnouncements, type AnnouncementAudience } from "@/app/actions/announcements";
import { validateUuid } from "@/lib/auth/uuid";

interface CachedEvent {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
}

interface CachedSchedule {
  id: string;
  title: string;
  status: string;
  sequence_order: number;
  event_id: string;
}

interface CachedCriterion {
  id: string;
  round_id: string;
  title: string;
  description?: string | null;
  max_marks: number;
  is_required?: boolean | null;
}

interface CachedProblemStatement {
  id: string;
  reference_number?: string | null;
  title?: string | null;
  description?: string | null;
}

interface CachedPublicData {
  event: CachedEvent | null;
  schedule: CachedSchedule[];
  criteria: CachedCriterion[];
  problemStatements: CachedProblemStatement[];
  announcements: any[];
}

/**
 * Server action for cached public event data.
 * No authentication required — public data only.
 */
export async function getCachedPublicEvent(eventId: string): Promise<
  | { data: CachedEvent | null; error?: null }
  | { data: null; error: string }
> {
  if (!validateUuid(eventId, "event_id")) {
    return { data: null, error: "Invalid event ID" };
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title, description, created_at")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: data
      ? {
          id: data.id,
          title: data.title,
          description: data.description,
          created_at: data.created_at,
        }
      : null,
    error: null,
  };
}

/**
 * Server action for cached public schedule/rounds.
 */
export async function getCachedPublicSchedule(eventId: string): Promise<
  | { data: CachedSchedule[]; error?: null }
  | { data: null; error: string }
> {
  if (!validateUuid(eventId, "event_id")) {
    return { data: null, error: "Invalid event ID" };
  }

  const { data, error } = await supabaseAdmin
    .from("evaluation_rounds")
    .select("id, title, status, sequence_order, event_id")
    .eq("event_id", eventId)
    .order("sequence_order", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: (data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      sequence_order: r.sequence_order,
      event_id: r.event_id,
    })),
    error: null,
  };
}

/**
 * Server action for cached public evaluation criteria.
 */
export async function getCachedPublicCriteria(roundId: string): Promise<
  | { data: CachedCriterion[]; error?: null }
  | { data: null; error: string }
> {
  if (!validateUuid(roundId, "round_id")) {
    return { data: null, error: "Invalid round ID" };
  }

  const { data, error } = await supabaseAdmin
    .from("evaluation_criteria")
    .select("id, round_id, title, description, max_marks, is_required")
    .eq("round_id", roundId);

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: (data || []).map((c: any) => ({
      id: c.id,
      round_id: c.round_id,
      title: c.title,
      description: c.description,
      max_marks: c.max_marks,
      is_required: c.is_required,
    })),
    error: null,
  };
}

/**
 * Server action for cached public problem statements.
 */
export async function getCachedPublicProblemStatements(eventId: string): Promise<
  | { data: CachedProblemStatement[]; error?: null }
  | { data: null; error: string }
> {
  if (!validateUuid(eventId, "event_id")) {
    return { data: null, error: "Invalid event ID" };
  }

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("id, reference_number, title, description")
    .eq("event_id", eventId);

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: (data || []).map((p: any) => ({
      id: p.id,
      reference_number: p.reference_number,
      title: p.title,
      description: p.description,
    })),
    error: null,
  };
}

/**
 * Server action for cached public announcements.
 */
export async function getCachedPublicAnnouncements(audience: AnnouncementAudience | AnnouncementAudience[] = "all"): Promise<
  | { data: any[]; error?: null }
  | { data: null; error: string }
> {
  try {
    const announcements = await getActiveAnnouncements(audience);
    return { data: announcements, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

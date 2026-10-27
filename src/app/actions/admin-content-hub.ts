"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// The deployed database predates the repository migration and already uses
// problem_statements as a rich content table. The hub therefore stores its
// activity + item records in that table using namespaced JSON markers. This
// keeps existing problem statements and content_release_audit rows intact and
// avoids destructive schema changes.
const HUB_ACTIVITY_KEY = "__hub_activity";
const HUB_ITEM_KEY = "__hub_item";
const HUB_FILE_KEY = "__hub_file";
const STORAGE_BUCKET = "content-releases";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type ActivityType =
  | "problem_statements"
  | "certificates"
  | "announcements"
  | "resources"
  | "custom";

export type ContentStatus = "draft" | "published" | "unpublished";

export interface ContentActivity {
  id: string;
  title: string;
  description: string | null;
  type: ActivityType;
  status: "active" | "archived";
  built_in: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  published_count: number;
  draft_count: number;
}

export interface ContentFile {
  id: string;
  name: string;
  path: string;
  mime_type: string | null;
  size: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface ContentItem {
  id: string;
  activity_id: string;
  activity_type: ActivityType;
  item_type: string;
  title: string;
  reference_number: string | null;
  summary: string | null;
  body: string;
  domain: string | null;
  team_limit: number | null;
  enable_selection: boolean;
  manual_lock: boolean;
  selection_opening: string | null;
  selection_closing: string | null;
  status: ContentStatus;
  metadata: Record<string, unknown>;
  files: ContentFile[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  is_legacy: boolean;
}

export interface ContentHistoryEntry {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  performed_by_name: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

export interface ContentHubData {
  activities: ContentActivity[];
  items: ContentItem[];
  error?: string;
}

interface ProblemStatementRow {
  id: string;
  reference_number: string | null;
  title: string;
  domain: string | null;
  summary: string | null;
  description: string | null;
  team_limit: number | null;
  // New fields for allocation control
  enable_selection?: boolean;
  manual_lock?: boolean;
  selection_opening?: string | null;
  selection_closing?: string | null;
  resource_links: unknown;
  attachments: unknown;
  display_order: number | null;
  status: string | null;
  created_by: string | null;
  updated_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface HubActivityMarker {
  type: ActivityType;
  status: "active" | "archived";
  built_in: boolean;
}

interface HubItemMarker {
  activity_id: string;
  item_type: string;
  metadata: Record<string, unknown>;
}

interface AuditRow {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  performed_by: string | null;
  details: unknown;
  created_at: string;
}

const ACTIVITY_TYPES: ActivityType[] = [
  "problem_statements",
  "certificates",
  "announcements",
  "resources",
  "custom",
];

const BUILT_IN_ACTIVITIES: Array<{
  type: ActivityType;
  title: string;
  description: string;
}> = [
  {
    type: "problem_statements",
    title: "Problem Statements",
    description:
      "Official challenge briefs, problem definitions, and team-facing statements.",
  },
  {
    type: "certificates",
    title: "Certificate Releases",
    description:
      "Participation, winner, and special-recognition certificate releases.",
  },
  {
    type: "announcements",
    title: "Announcements",
    description:
      "Event-wide updates, deadlines, venue notices, and operational broadcasts.",
  },
  {
    type: "resources",
    title: "Resource Library",
    description:
      "Guides, templates, rulebooks, and reference material for participants.",
  },
  {
    type: "custom",
    title: "Custom Activity",
    description:
      "A flexible workspace for any additional event content or release.",
  },
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".zip",
];

function isActivityType(value: unknown): value is ActivityType {
  return (
    typeof value === "string" &&
    ACTIVITY_TYPES.includes(value as ActivityType)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeStatus(value: unknown): ContentStatus {
  if (value === "published" || value === "unpublished") return value;
  return "draft";
}

function normalizeTeamLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Team limit must be a positive whole number.");
  }
  return parsed;
}

function getActivityMarker(resourceLinks: unknown): HubActivityMarker | null {
  const root = asRecord(resourceLinks);
  const marker = root ? asRecord(root[HUB_ACTIVITY_KEY]) : null;
  if (!marker || !isActivityType(marker.type)) return null;

  return {
    type: marker.type,
    status: marker.status === "archived" ? "archived" : "active",
    built_in: marker.built_in === true,
  };
}

function getItemMarker(resourceLinks: unknown): HubItemMarker | null {
  const root = asRecord(resourceLinks);
  const marker = root ? asRecord(root[HUB_ITEM_KEY]) : null;
  if (!marker || typeof marker.activity_id !== "string") return null;

  return {
    activity_id: marker.activity_id,
    item_type:
      typeof marker.item_type === "string" ? marker.item_type : "content",
    metadata: asRecord(marker.metadata) || {},
  };
}

function getHubFiles(attachments: unknown): ContentFile[] {
  if (!Array.isArray(attachments)) return [];

  const files: ContentFile[] = [];
  for (const entry of attachments) {
    const record = asRecord(entry);
    if (!record || record[HUB_FILE_KEY] !== true) continue;
    if (typeof record.path !== "string" || typeof record.name !== "string") {
      continue;
    }

    files.push({
      id:
        typeof record.id === "string"
          ? record.id
          : `${record.path}-${record.name}`,
      name: record.name,
      path: record.path,
      mime_type:
        typeof record.mime_type === "string" ? record.mime_type : null,
      size: typeof record.size === "number" ? record.size : 0,
      uploaded_at:
        typeof record.uploaded_at === "string" ? record.uploaded_at : "",
      uploaded_by:
        typeof record.uploaded_by === "string" ? record.uploaded_by : null,
    });
  }
  return files;
}

function buildItemResourceLinks(
  existing: unknown,
  activityId: string,
  itemType: string,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const root = asRecord(existing) || {};
  return {
    ...root,
    [HUB_ITEM_KEY]: {
      activity_id: activityId,
      item_type: itemType,
      metadata,
    },
  };
}

function getItemTypeForActivity(type: ActivityType): string {
  switch (type) {
    case "problem_statements":
      return "problem_statement";
    case "certificates":
      return "certificate";
    case "announcements":
      return "announcement";
    case "resources":
      return "resource";
    default:
      return "custom";
  }
}

function buildActivity(row: ProblemStatementRow): ContentActivity {
  const marker = getActivityMarker(row.resource_links);
  return {
    id: row.id,
    title: row.title,
    description: row.summary || row.description || null,
    type: marker?.type || "custom",
    status: marker?.status || "active",
    built_in: marker?.built_in === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: 0,
    published_count: 0,
    draft_count: 0,
  };
}

function buildItem(
  row: ProblemStatementRow,
  activity: ContentActivity,
  marker: HubItemMarker | null
): ContentItem {
    return {
      id: row.id,
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: marker?.item_type || getItemTypeForActivity(activity.type),
      title: row.title,
      reference_number: row.reference_number,
      summary: row.summary,
      body: row.description || "",
      domain: row.domain,
      team_limit: typeof row.team_limit === "number" ? row.team_limit : null,
      enable_selection: row.enable_selection ?? true,
      manual_lock: row.manual_lock ?? false,
      selection_opening: row.selection_opening ?? null,
      selection_closing: row.selection_closing ?? null,
      status: normalizeStatus(row.status),
      metadata: marker?.metadata || {},
      files: getHubFiles(row.attachments),
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at,
      published_by: row.published_by,
      created_by: row.created_by,
      updated_by: row.updated_by,
      is_legacy: !marker,
    };
}

async function getActivityRow(
  activityId: string
): Promise<{ row: ProblemStatementRow; activity: ContentActivity }> {
  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("id", activityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load activity: ${error.message}`);
  }
  if (!data) {
    throw new Error("Activity not found.");
  }

  const row = data as ProblemStatementRow;
  if (!getActivityMarker(row.resource_links)) {
    throw new Error("Selected record is not a Content Hub activity.");
  }

  return { row, activity: buildActivity(row) };
}

async function findProblemStatementActivity(): Promise<ContentActivity | null> {
  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("domain", "content_hub_activity");

  if (error) {
    throw new Error(`Failed to load problem statement activity: ${error.message}`);
  }

  const rows = ((data || []) as ProblemStatementRow[]).filter(
    (row) => getActivityMarker(row.resource_links)?.type === "problem_statements"
  );
  const row =
    rows.find((candidate) => getActivityMarker(candidate.resource_links)?.built_in) ||
    rows[0];

  return row ? buildActivity(row) : null;
}

async function resolveItemActivity(
  row: ProblemStatementRow
): Promise<{ activity: ContentActivity; marker: HubItemMarker | null }> {
  const marker = getItemMarker(row.resource_links);
  if (marker) {
    const { activity } = await getActivityRow(marker.activity_id);
    return { activity, marker };
  }

  const fallback = await findProblemStatementActivity();
  if (!fallback) {
    throw new Error(
      "The Problem Statements activity is unavailable. Reload the Content Hub and try again."
    );
  }

  return { activity: fallback, marker: null };
}

async function getItemRow(itemId: string): Promise<ProblemStatementRow> {
  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load content item: ${error.message}`);
  }
  if (!data) {
    throw new Error("Content item not found.");
  }

  const row = data as ProblemStatementRow;
  if (getActivityMarker(row.resource_links)) {
    throw new Error("Activity records cannot be edited as content items.");
  }

  return row;
}

async function allocateReferenceNumber(preferred?: string): Promise<string> {
  const requested = preferred?.trim();
  if (requested) {
    const { data, error } = await supabaseAdmin
      .from("problem_statements")
      .select("id")
      .eq("reference_number", requested)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to validate reference number: ${error.message}`);
    }
    if (data) {
      throw new Error("That reference number is already in use.");
    }
    return requested;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `HUB-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;
    const { data, error } = await supabaseAdmin
      .from("problem_statements")
      .select("id")
      .eq("reference_number", candidate)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to allocate reference number: ${error.message}`);
    }
    if (!data) return candidate;
  }

  throw new Error("Could not allocate a unique reference number.");
}

async function writeAudit(params: {
  statementId: string | null;
  action:
    | "created"
    | "edited"
    | "published"
    | "unpublished"
    | "deleted"
    | "scheduled"
    | "cancelled"
    | "rescheduled";
  previousStatus: string | null;
  newStatus: string | null;
  userId: string;
  details: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("content_release_audit").insert([
    {
      statement_id: params.statementId,
      action: params.action,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      performed_by: params.userId,
      details: params.details,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.warn("Content history note:", error.message);
  }
}

function revalidateHub(itemType?: string) {
  revalidatePath("/admin/content-releases");
  if (itemType === "problem_statement") {
    revalidatePath("/team/problem-statements");
  }
}

async function ensureStorageBucket() {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
  if (bucket) return;

  const { error } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`Failed to prepare content storage: ${error.message}`);
  }
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "file";
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export async function getContentHubData(): Promise<ContentHubData> {
  const { user } = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load Content Hub:", error.message);
    return {
      activities: [],
      items: [],
      error:
        "The content store is not available. Confirm the problem_statements table and its migrations are applied.",
    };
  }

  const rows = (data || []) as ProblemStatementRow[];
  const activityRows: ProblemStatementRow[] = rows.filter(
    (row) => getActivityMarker(row.resource_links) !== null
  );

  const existingTypes = new Set(
    activityRows
      .map((row) => getActivityMarker(row.resource_links)?.type)
      .filter((type): type is ActivityType => Boolean(type))
  );

  let insertFailed = false;

  for (const definition of BUILT_IN_ACTIVITIES) {
    if (existingTypes.has(definition.type)) continue;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("problem_statements")
      .insert([
        {
          reference_number: `ACT-BUILTIN-${definition.type.toUpperCase()}`,
          title: definition.title,
          domain: "content_hub_activity",
          summary: definition.description,
          description: definition.description,
          status: "draft",
          resource_links: {
            [HUB_ACTIVITY_KEY]: {
              type: definition.type,
              status: "active",
              built_in: true,
            },
          },
          attachments: [],
          created_by: user.id,
          updated_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      insertFailed = true;
      console.warn(
        `Could not seed ${definition.title} activity:`,
        insertError.message
      );
      continue;
    }

    if (inserted) {
      activityRows.push(inserted as ProblemStatementRow);
      existingTypes.add(definition.type);
    }
  }

  if (insertFailed) {
    const { data: retryRows } = await supabaseAdmin
      .from("problem_statements")
      .select("*")
      .eq("domain", "content_hub_activity");

    if (retryRows) {
      const seen = new Set(activityRows.map((row) => row.id));
      for (const row of retryRows as ProblemStatementRow[]) {
        if (!seen.has(row.id)) activityRows.push(row);
      }
    }
  }

  const activities = activityRows
    .map(buildActivity)
    .sort((a, b) => {
      if (a.built_in !== b.built_in) return a.built_in ? -1 : 1;
      const order = ACTIVITY_TYPES.indexOf(a.type) - ACTIVITY_TYPES.indexOf(b.type);
      if (order !== 0) return order;
      return a.created_at.localeCompare(b.created_at);
    });

  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const problemStatementActivity =
    activities.find(
      (activity) => activity.type === "problem_statements" && activity.built_in
    ) || activities.find((activity) => activity.type === "problem_statements");

  const items: ContentItem[] = [];

  for (const row of rows) {
    if (getActivityMarker(row.resource_links)) continue;

    const marker = getItemMarker(row.resource_links);
    const activity = marker
      ? activityById.get(marker.activity_id)
      : problemStatementActivity;

    if (!activity) continue;

    items.push(buildItem(row, activity, marker));
  }

  for (const item of items) {
    const activity = activityById.get(item.activity_id);
    if (!activity) continue;
    activity.item_count += 1;
    if (item.status === "published") {
      activity.published_count += 1;
    } else {
      activity.draft_count += 1;
    }
  }

  return { activities, items };
}

export async function createContentActivity(input: {
  title: string;
  description?: string;
  type: ActivityType;
}) {
  const { user } = await requireAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Activity title is required.");
  if (!isActivityType(input.type)) throw new Error("Invalid activity type.");

  const referenceNumber = await allocateReferenceNumber(
    `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  );

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .insert([
      {
        reference_number: referenceNumber,
        title,
        domain: "content_hub_activity",
        summary: input.description?.trim() || null,
        description: input.description?.trim() || "",
        status: "draft",
        resource_links: {
          [HUB_ACTIVITY_KEY]: {
            type: input.type,
            status: "active",
            built_in: false,
          },
        },
        attachments: [],
        created_by: user.id,
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }

  const activity = buildActivity(data as ProblemStatementRow);
  await writeAudit({
    statementId: activity.id,
    action: "created",
    previousStatus: null,
    newStatus: "draft",
    userId: user.id,
    details: { record_kind: "activity", activity_type: activity.type, title },
  });

  revalidateHub();
  return activity;
}

export async function createContentItem(input: {
  activityId: string;
  title: string;
  referenceNumber?: string;
  summary?: string;
  body?: string;
  domain?: string;
  teamLimit?: number | null;
  enableSelection?: boolean;
  manualLock?: boolean;
  selectionOpening?: string;
  selectionClosing?: string;
  metadata?: Record<string, unknown>;
}) {
  const { user } = await requireAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Content title is required.");

  const { activity } = await getActivityRow(input.activityId);
  const itemType = getItemTypeForActivity(activity.type);
  const referenceNumber = await allocateReferenceNumber(input.referenceNumber);
  const teamLimit =
    activity.type === "problem_statements" && input.teamLimit !== undefined
      ? input.teamLimit === null
        ? null
        : normalizeTeamLimit(input.teamLimit)
      : undefined;

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
      .insert([
        {
          reference_number: referenceNumber,
          title,
          domain: input.domain?.trim() || null,
          summary: input.summary?.trim() || null,
          description: input.body || "",
          ...(teamLimit !== undefined ? { team_limit: teamLimit } : {}),
          ...(input.enableSelection !== undefined ? { enable_selection: input.enableSelection } : {}),
          ...(input.manualLock !== undefined ? { manual_lock: input.manualLock } : {}),
          ...(input.selectionOpening ? { selection_opening: input.selectionOpening } : {}),
          ...(input.selectionClosing ? { selection_closing: input.selectionClosing } : {}),
          status: "draft",
          resource_links: {
            [HUB_ITEM_KEY]: {
              activity_id: activity.id,
              item_type: itemType,
              metadata: input.metadata || {},
            },
          },
          attachments: [],
          created_by: user.id,
          updated_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create content item: ${error.message}`);
  }

  const row = data as ProblemStatementRow;
  await writeAudit({
    statementId: row.id,
    action: "created",
    previousStatus: null,
    newStatus: "draft",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: itemType,
      title,
    },
  });

  revalidateHub(itemType);
  return buildItem(
    row,
    activity,
    getItemMarker(row.resource_links)
  );
}

export async function updateContentItem(input: {
  itemId: string;
  activityId: string;
  title: string;
  referenceNumber?: string;
  summary?: string;
  body?: string;
  domain?: string;
  teamLimit?: number | null;
  metadata?: Record<string, unknown>;
  enableSelection?: boolean;
  manualLock?: boolean;
  selectionOpening?: string;
  selectionClosing?: string;
}) {
  const { user } = await requireAdmin();
  const title = input.title.trim();
  if (!title) throw new Error("Content title is required.");

  const row = await getItemRow(input.itemId);
  const { activity } = await getActivityRow(input.activityId);
  const itemType = getItemTypeForActivity(activity.type);
  const teamLimit =
    activity.type === "problem_statements" && input.teamLimit !== undefined
      ? input.teamLimit === null
        ? null
        : normalizeTeamLimit(input.teamLimit)
      : undefined;

  const nextReference = input.referenceNumber?.trim();
  if (nextReference && nextReference !== row.reference_number) {
    const { data: conflict } = await supabaseAdmin
      .from("problem_statements")
      .select("id")
      .eq("reference_number", nextReference)
      .neq("id", row.id)
      .maybeSingle();
    if (conflict) throw new Error("That reference number is already in use.");
  }

  const nextResourceLinks = buildItemResourceLinks(
    row.resource_links,
    activity.id,
    itemType,
    input.metadata || {}
  );

    const { data, error } = await supabaseAdmin
      .from("problem_statements")
      .update({
        title,
        reference_number: nextReference || row.reference_number,
        domain: input.domain?.trim() || null,
        summary: input.summary?.trim() || null,
        description: input.body || "",
        ...(teamLimit !== undefined ? { team_limit: teamLimit } : {}),
        ...(input.enableSelection !== undefined ? { enable_selection: input.enableSelection } : {}),
        ...(input.manualLock !== undefined ? { manual_lock: input.manualLock } : {}),
        ...(input.selectionOpening ? { selection_opening: input.selectionOpening } : {}),
        ...(input.selectionClosing ? { selection_closing: input.selectionClosing } : {}),
        resource_links: nextResourceLinks,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("*")
      .single();

  if (error) {
    throw new Error(`Failed to update content item: ${error.message}`);
  }

  await writeAudit({
    statementId: row.id,
    action: "edited",
    previousStatus: row.status,
    newStatus: row.status,
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: itemType,
      title,
    },
  });

  revalidateHub(itemType);
  return buildItem(
    data as ProblemStatementRow,
    activity,
    getItemMarker((data as ProblemStatementRow).resource_links)
  );
}

export async function publishContentItem(itemId: string) {
  const { user } = await requireAdmin();
  const row = await getItemRow(itemId);
  const { activity, marker } = await resolveItemActivity(row);

  const previousStatus = normalizeStatus(row.status);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .update({
      status: "published",
      published_by: user.id,
      published_at: now,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish content: ${error.message}`);
  }

  await writeAudit({
    statementId: row.id,
    action: "published",
    previousStatus,
    newStatus: "published",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: marker?.item_type || getItemTypeForActivity(activity.type),
      title: row.title,
    },
  });

  revalidateHub(marker?.item_type);
  return buildItem(
    data as ProblemStatementRow,
    activity,
    getItemMarker((data as ProblemStatementRow).resource_links)
  );
}

export async function unpublishContentItem(itemId: string) {
  const { user } = await requireAdmin();
  const row = await getItemRow(itemId);
  const { activity, marker } = await resolveItemActivity(row);

  const previousStatus = normalizeStatus(row.status);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .update({
      status: "draft",
      published_by: null,
      published_at: null,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to unpublish content: ${error.message}`);
  }

  await writeAudit({
    statementId: row.id,
    action: "unpublished",
    previousStatus,
    newStatus: "draft",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: marker?.item_type || getItemTypeForActivity(activity.type),
      title: row.title,
    },
  });

  revalidateHub(marker?.item_type);
  return buildItem(
    data as ProblemStatementRow,
    activity,
    getItemMarker((data as ProblemStatementRow).resource_links)
  );
}

export async function deleteContentItem(itemId: string) {
  const { user } = await requireAdmin();
  const row = await getItemRow(itemId);
  const marker = getItemMarker(row.resource_links);
  const files = getHubFiles(row.attachments);

  if (files.length > 0) {
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove(files.map((file) => file.path));
  }

  await writeAudit({
    statementId: null,
    action: "deleted",
    previousStatus: normalizeStatus(row.status),
    newStatus: null,
    userId: user.id,
    details: {
      item_id: row.id,
      activity_id: marker?.activity_id || null,
      item_type: marker?.item_type || "problem_statement",
      title: row.title,
    },
  });

  const { error } = await supabaseAdmin
    .from("problem_statements")
    .delete()
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed to delete content item: ${error.message}`);
  }

  revalidateHub(marker?.item_type);
  return { success: true };
}

export async function getContentItemHistory(
  itemId: string
): Promise<ContentHistoryEntry[]> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("content_release_audit")
    .select("*")
    .eq("statement_id", itemId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("Content history unavailable:", error.message);
    return [];
  }

  const rows = (data || []) as AuditRow[];
  const performerIds = Array.from(
    new Set(
      rows
        .map((row) => row.performed_by)
        .filter((id): id is string => typeof id === "string")
    )
  );

  const names = new Map<string, string>();
  if (performerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", performerIds);
    for (const profile of profiles || []) {
      names.set(
        profile.id as string,
        (profile.full_name as string | null) ||
          (profile.email as string | null) ||
          "Administrator"
      );
    }
  }

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    previous_status: row.previous_status,
    new_status: row.new_status,
    performed_by_name: row.performed_by
      ? names.get(row.performed_by) || "Administrator"
      : "System",
    created_at: row.created_at,
    details: asRecord(row.details) || {},
  }));
}

export async function prepareContentFileUpload(input: {
  itemId: string;
  fileName: string;
  mimeType?: string;
  size: number;
}) {
  await requireAdmin();
  const row = await getItemRow(input.itemId);
  const { activity } = await resolveItemActivity(row);

  if (!ALLOWED_EXTENSIONS.includes(fileExtension(input.fileName))) {
    throw new Error(
      `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
    );
  }
  if (input.size > MAX_FILE_SIZE) {
    throw new Error("File is larger than the 50MB limit.");
  }

  await ensureStorageBucket();

  const safeName = sanitizeFileName(input.fileName);
  const path = `content/${activity.id}/${row.id}/${Date.now()}-${safeName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(
      `Failed to prepare file upload: ${error?.message || "Unknown error"}`
    );
  }

  return {
    bucket: STORAGE_BUCKET,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function registerContentFile(input: {
  itemId: string;
  name: string;
  path: string;
  mimeType?: string;
  size: number;
}) {
  const { user } = await requireAdmin();
  const row = await getItemRow(input.itemId);
  const { activity, marker } = await resolveItemActivity(row);

  const expectedPrefix = `content/${activity.id}/${row.id}/`;
  if (!input.path.startsWith(expectedPrefix)) {
    throw new Error("Invalid file path for this content item.");
  }

  const existing = Array.isArray(row.attachments) ? row.attachments : [];
  const alreadyRegistered = existing.some((entry) => {
    const record = asRecord(entry);
    return record?.path === input.path;
  });
  if (alreadyRegistered) {
    throw new Error("That file is already attached to this item.");
  }

  const file = {
    id: crypto.randomUUID(),
    name: input.name,
    path: input.path,
    mime_type: input.mimeType || null,
    size: input.size,
    uploaded_at: new Date().toISOString(),
    uploaded_by: user.id,
    [HUB_FILE_KEY]: true,
  };

  const { error } = await supabaseAdmin
    .from("problem_statements")
    .update({
      attachments: [...existing, file],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed to register uploaded file: ${error.message}`);
  }

  await writeAudit({
    statementId: row.id,
    action: "edited",
    previousStatus: normalizeStatus(row.status),
    newStatus: normalizeStatus(row.status),
    userId: user.id,
    details: {
      activity_id: activity.id,
      change: "file_uploaded",
      file_name: input.name,
      file_path: input.path,
    },
  });

  revalidateHub(marker?.item_type || "problem_statement");

  return {
    id: file.id,
    name: file.name,
    path: file.path,
    mime_type: file.mime_type,
    size: file.size,
    uploaded_at: file.uploaded_at,
    uploaded_by: file.uploaded_by,
  };
}

export async function removeContentFile(input: {
  itemId: string;
  fileId: string;
}) {
  const { user } = await requireAdmin();
  const row = await getItemRow(input.itemId);
  const { activity, marker } = await resolveItemActivity(row);

  const existing = Array.isArray(row.attachments) ? row.attachments : [];
  const target = getHubFiles(row.attachments).find(
    (file) => file.id === input.fileId
  );
  if (!target) throw new Error("File not found.");

  const nextAttachments = existing.filter((entry) => {
    const record = asRecord(entry);
    if (!record || record[HUB_FILE_KEY] !== true) return true;
    return record.id !== input.fileId && record.path !== target.path;
  });

  await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([target.path]);

  const { error } = await supabaseAdmin
    .from("problem_statements")
    .update({
      attachments: nextAttachments,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) {
    throw new Error(`Failed to remove file: ${error.message}`);
  }

  await writeAudit({
    statementId: row.id,
    action: "edited",
    previousStatus: normalizeStatus(row.status),
    newStatus: normalizeStatus(row.status),
    userId: user.id,
    details: {
      activity_id: activity.id,
      change: "file_removed",
      file_name: target.name,
    },
  });

  revalidateHub(marker?.item_type || "problem_statement");
  return { success: true };
}

interface ContentScheduledPublicationRow {
  id: string;
  item_id: string;
  scheduled_at: string;
  timezone: string;
  status: string;
  created_by: string | null;
  created_at: string;
  executed_at: string | null;
  failure_reason: string | null;
}

async function claimPendingSchedules(): Promise<
  ContentScheduledPublicationRow[]
> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Failed to claim pending schedules:", error.message);
    return [];
  }

  const claimed: ContentScheduledPublicationRow[] = [];
  for (const row of (data || []) as ContentScheduledPublicationRow[]) {
    const { data: updated } = await supabaseAdmin
      .from("content_scheduled_publications")
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updated) claimed.push(updated as ContentScheduledPublicationRow);
  }

  return claimed;
}

async function releaseSchedule(
  publicationId: string,
  status: "completed" | "failed",
  failureReason?: string
) {
  const { error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .update({
      status,
      executed_at: new Date().toISOString(),
      failure_reason:
        status === "failed" ? failureReason || "Unknown scheduler error" : null,
    })
    .eq("id", publicationId);

  if (error) {
    console.error("Failed to release schedule:", error.message);
  }
}

async function publishItemWithAudit(
  itemId: string,
  activity: ContentActivity,
  marker: HubItemMarker | null
) {
  const { user } = await requireAdmin();
  const row = await getItemRow(itemId);
  const previousStatus = normalizeStatus(row.status);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .update({
      status: "published",
      published_by: user.id,
      published_at: now,
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish content: ${error.message}`);
  }

  await writeAudit({
    statementId: itemId,
    action: "published",
    previousStatus,
    newStatus: "published",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: marker?.item_type || getItemTypeForActivity(activity.type),
      title: row.title,
    },
  });

  return buildItem(
    data as ProblemStatementRow,
    activity,
    getItemMarker((data as ProblemStatementRow).resource_links)
  );
}

export async function publishAllContentItems(activityId: string) {
  const { user } = await requireAdmin();
  const { activity } = await getActivityRow(activityId);

  const { data, error } = await supabaseAdmin
    .from("problem_statements")
    .select("*")
    .eq("status", "draft");

  if (error) {
    throw new Error(`Failed to load draft items: ${error.message}`);
  }

  const activityItems = ((data || []) as ProblemStatementRow[]).filter(
    (row) => getItemMarker(row.resource_links)?.activity_id === activity.id
  );

  const eligibleItems: ProblemStatementRow[] = [];
  const skippedItems: { item: ProblemStatementRow; reason: string }[] = [];

  for (const item of activityItems) {
    const hasTitle = Boolean(item.title?.trim());
    const hasBodyOrSummary =
      Boolean(item.description?.trim()) || Boolean(item.summary?.trim());

    if (hasTitle && hasBodyOrSummary) {
      eligibleItems.push(item);
    } else {
      skippedItems.push({
        item,
        reason: !hasTitle
          ? "missing required title"
          : "missing required content",
      });
    }
  }

  const publishedIds: string[] = [];
  const publishErrors: string[] = [];

  for (const item of eligibleItems) {
    try {
      const published = await publishItemWithAudit(
        item.id,
        activity,
        getItemMarker(item.resource_links)
      );
      publishedIds.push(published.id);
    } catch (err: unknown) {
      publishErrors.push(
        `${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  await writeAudit({
    statementId: activity.id,
    action: "published",
    previousStatus: "draft",
    newStatus: "published",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      total_drafts: activityItems.length,
      published_count: publishedIds.length,
      skipped_count: skippedItems.length,
      error_count: publishErrors.length,
      published_ids: publishedIds,
      error_details: publishErrors,
    },
  });

  revalidateHub(getItemTypeForActivity(activity.type));

  return {
    publishedCount: publishedIds.length,
    skippedCount: skippedItems.length,
    errorCount: publishErrors.length,
    publishedIds,
    errorDetails: publishErrors,
    message:
      publishedIds.length > 0 || skippedItems.length > 0
        ? `Published ${publishedIds.length} item${
            publishedIds.length === 1 ? "" : "s"
          }; skipped ${skippedItems.length} item${
            skippedItems.length === 1 ? "" : "s"
          }.${
            publishErrors.length > 0
              ? ` ${publishErrors.length} item${
                  publishErrors.length === 1 ? "" : "s"
                } failed.`
              : ""
          }`
        : "No draft items are ready to publish.",
  };
}

export async function scheduleContentItem(
  itemId: string,
  scheduledAt: string,
  timezone = "UTC"
) {
  const { user } = await requireAdmin();
  const row = await getItemRow(itemId);
  const { activity, marker } = await resolveItemActivity(row);

  if (normalizeStatus(row.status) === "published") {
    throw new Error("Cannot schedule an item that is already published.");
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Enter a valid publication date and time.");
  }
  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error("Scheduled publication must be in the future.");
  }

  const { data: existingSchedule } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("id")
    .eq("item_id", itemId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingSchedule) {
    throw new Error(
      "This item is already scheduled for publication. Cancel the existing schedule first."
    );
  }

  const { data, error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .insert({
      item_id: itemId,
      scheduled_at: scheduledDate.toISOString(),
      timezone: timezone.trim() || "UTC",
      status: "pending",
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to schedule publication: ${error.message}`);
  }

  await writeAudit({
    statementId: itemId,
    action: "scheduled",
    previousStatus: normalizeStatus(row.status),
    newStatus: "scheduled",
    userId: user.id,
    details: {
      activity_id: activity.id,
      activity_type: activity.type,
      item_type: marker?.item_type || getItemTypeForActivity(activity.type),
      scheduled_at: scheduledDate.toISOString(),
      timezone: timezone.trim() || "UTC",
    },
  });

  revalidateHub(marker?.item_type || "problem_statement");
  return data as ContentScheduledPublicationRow;
}

export async function scheduleContentActivity(
  activityId: string,
  scheduledAt: string,
  timezone = "UTC"
) {
  const { user } = await requireAdmin();
  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    throw new Error("Enter a valid publication date and time.");
  }
  if (scheduledDate.getTime() <= Date.now()) {
    throw new Error("Scheduled publication must be in the future.");
  }

  const { data: rawRows, error } = await supabaseAdmin
    .from("problem_statements")
    .select("id, status, resource_links");

  if (error) {
    throw new Error(`Failed to load activity items: ${error.message}`);
  }

  const items = (rawRows || [])
    .filter((row) => {
      const marker = getItemMarker(row.resource_links);
      return marker?.activity_id === activityId;
    })
    .filter((row) => normalizeStatus(row.status) !== "published");

  let scheduledCount = 0;
  for (const item of items) {
    await supabaseAdmin
      .from("content_scheduled_publications")
      .delete()
      .eq("item_id", item.id)
      .eq("status", "pending");

    const { error: insErr } = await supabaseAdmin
      .from("content_scheduled_publications")
      .insert({
        item_id: item.id,
        scheduled_at: scheduledDate.toISOString(),
        timezone: timezone.trim() || "UTC",
        status: "pending",
        created_by: user.id,
      });

    if (!insErr) {
      scheduledCount++;
    }
  }

  await writeAudit({
    statementId: activityId,
    action: "scheduled",
    previousStatus: "draft",
    newStatus: "scheduled",
    userId: user.id,
    details: {
      activity_id: activityId,
      scheduled_at: scheduledDate.toISOString(),
      timezone: timezone.trim() || "UTC",
      scheduled_count: scheduledCount,
    },
  });

  revalidateHub();
  return {
    scheduledCount,
    scheduledAt: scheduledDate.toISOString(),
    message: `Scheduled ${scheduledCount} draft item${
      scheduledCount === 1 ? "" : "s"
    } for publication at ${scheduledDate.toLocaleString()}.`,
  };
}

export async function cancelActivitySchedule(activityId: string) {
  const { user } = await requireAdmin();
  const { data: rawRows } = await supabaseAdmin
    .from("problem_statements")
    .select("id, resource_links");

  const itemIds = (rawRows || [])
    .filter((row) => {
      const marker = getItemMarker(row.resource_links);
      return marker?.activity_id === activityId;
    })
    .map((row) => row.id);

  if (itemIds.length > 0) {
    await supabaseAdmin
      .from("content_scheduled_publications")
      .update({
        status: "cancelled",
        executed_at: new Date().toISOString(),
      })
      .in("item_id", itemIds)
      .eq("status", "pending");
  }

  await writeAudit({
    statementId: activityId,
    action: "cancelled",
    previousStatus: "scheduled",
    newStatus: "draft",
    userId: user.id,
    details: {
      activity_id: activityId,
      cancelled_items_count: itemIds.length,
    },
  });

  revalidateHub();
  return { success: true };
}

export async function cancelScheduledPublication(publicationId: string) {
  const { user } = await requireAdmin();
  const { data: schedule, error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("*")
    .eq("id", publicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load schedule: ${error.message}`);
  }
  if (!schedule) {
    throw new Error("Scheduled publication not found.");
  }
  if (schedule.status !== "pending") {
    throw new Error("Only pending schedules can be cancelled.");
  }

  const { error: updateError } = await supabaseAdmin
    .from("content_scheduled_publications")
    .update({
      status: "cancelled",
      executed_at: new Date().toISOString(),
      failure_reason: null,
    })
    .eq("id", publicationId);

  if (updateError) {
    throw new Error(`Failed to cancel schedule: ${updateError.message}`);
  }

  await writeAudit({
    statementId: schedule.item_id,
    action: "cancelled",
    previousStatus: schedule.status,
    newStatus: "cancelled",
    userId: user.id,
    details: { schedule_id: publicationId },
  });

  revalidateHub();
  return { success: true };
}

export async function retryFailedSchedule(publicationId: string) {
  const { user } = await requireAdmin();
  const { data: schedule, error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("*")
    .eq("id", publicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load schedule: ${error.message}`);
  }
  if (!schedule) {
    throw new Error("Scheduled publication not found.");
  }
  if (schedule.status !== "failed") {
    throw new Error("Only failed schedules can be retried.");
  }

  const { error: updateError } = await supabaseAdmin
    .from("content_scheduled_publications")
    .update({
      status: "pending",
      executed_at: null,
      failure_reason: null,
    })
    .eq("id", publicationId);

  if (updateError) {
    throw new Error(`Failed to reset schedule: ${updateError.message}`);
  }

  await writeAudit({
    statementId: schedule.item_id,
    action: "rescheduled",
    previousStatus: schedule.status,
    newStatus: "pending",
    userId: user.id,
    details: { schedule_id: publicationId },
  });

  revalidateHub();
  return { success: true };
}

export async function executeDueSchedules() {
  await requireAdmin();
  const schedules = await claimPendingSchedules();

  for (const schedule of schedules) {
    try {
      const itemRow = await getItemRow(schedule.item_id);
      const { activity, marker } = await resolveItemActivity(itemRow);

      if (normalizeStatus(itemRow.status) !== "draft") {
        await releaseSchedule(
          schedule.id,
          "failed",
          "Item is no longer in draft state."
        );
        continue;
      }

      await publishItemWithAudit(schedule.item_id, activity, marker);
      await releaseSchedule(schedule.id, "completed");
    } catch (err: unknown) {
      const failureMessage =
        err instanceof Error
          ? err.message
          : "Unknown error during schedule execution.";
      await releaseSchedule(schedule.id, "failed", failureMessage);
      console.error(
        `Schedule execution failed for schedule ${schedule.id}:`,
        failureMessage
      );
    }
  }

  revalidateHub();
  return { processed: schedules.length };
}

export async function getScheduledPublications(activityId?: string) {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("content_scheduled_publications")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Failed to load schedules:", error.message);
    return [];
  }

  const schedules = (data || []) as ContentScheduledPublicationRow[];
  if (!activityId) return schedules;

  const itemIds = Array.from(new Set(schedules.map((row) => row.item_id)));
  if (itemIds.length === 0) return [];

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("problem_statements")
    .select("id, resource_links")
    .in("id", itemIds);

  if (itemsError) {
    console.error("Failed to filter schedules:", itemsError.message);
    return [];
  }

  const matchingItemIds = new Set(
    ((items || []) as Array<{ id: string; resource_links: unknown }>)
      .filter(
        (item) => getItemMarker(item.resource_links)?.activity_id === activityId
      )
      .map((item) => item.id)
  );

  return schedules.filter((schedule) =>
    matchingItemIds.has(schedule.item_id)
  );
}

export async function getContentFileDownloadUrl(input: {
  itemId: string;
  fileId: string;
}) {
  await requireAdmin();
  const row = await getItemRow(input.itemId);
  const target = getHubFiles(row.attachments).find(
    (file) => file.id === input.fileId
  );
  if (!target) throw new Error("File not found.");

  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(target.path, 120);

  if (error || !data) {
    throw new Error(
      `Failed to create download link: ${error?.message || "Unknown error"}`
    );
  }

  return { url: data.signedUrl, name: target.name };
}

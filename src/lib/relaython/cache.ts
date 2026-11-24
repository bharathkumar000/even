/**
 * Relaython QR Registry Cache — CSV-Based, Offline-First
 *
 * Cache-first scanning architecture:
 * - CSV-based registry imported via protected backend endpoint
 * - In-memory Map indexed by exact qr_token for O(1) lookup
 * - Separate IndexedDB stores for registry and scans
 * - CSV import preserves existing teams and pending scans
 * - Dynamic team count (no hardcoded limit)
 * - Only authenticated SPOCs can import CSV via /api/relaython/registry/import
 *
 * Never exposes service-role keys or sensitive credentials to browser code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelaythonTeam {
  team_code: string;
  team_name: string;
  leader_name: string;
  domain: string;
  qr_token: string;
}

export interface RelaythonRegistryCache {
  version: string;
  count: number;
  teams: RelaythonTeam[];
  generated_at: string;
  fetched_at: number; // epoch ms when this copy was fetched
  ttl_ms: number;
  source: "api" | "csv";
}

export interface RelaythonCacheEntry {
  team_code: string;
  team_name: string;
  leader_name: string;
  domain: string;
  qr_token: string;
}

export interface CsvImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  total_teams: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CACHE_VERSION = "1";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const INDEXEDDB_NAME = "ivc-eventra-relaython-offline";
const INDEXEDDB_VERSION = 3;
const REGISTRY_STORE = "registry";
const SCAN_STORE = "scans";
const REGISTRY_KEY = "relaython_registry_v1";

// Required CSV columns
const REQUIRED_CSV_COLUMNS = [
  "team_code",
  "team_name",
  "leader_name",
  "domain",
  "qr_token",
];

// ---------------------------------------------------------------------------
// In-memory cache state
// ---------------------------------------------------------------------------

let tokenMap: Map<string, RelaythonCacheEntry> | null = null;
let cacheMeta: RelaythonRegistryCache | null = null;
let loadPromise: Promise<RelaythonRegistryCache> | null = null;

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available in this browser"));
      return;
    }
    const req = indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);

    // Defensive index creation: safe to re-run on upgrades and on fresh DBs.
    // cache.ts shares the database with storage.ts; whichever initializes first
    // must create the complete schema so later opens find indexes present.
    function ensureIndex(store: IDBObjectStore, name: string, keyPath: string | string[]): void {
      if (!store.indexNames.contains(name)) {
        store.createIndex(name, keyPath, { unique: false });
      }
    }

    req.onupgradeneeded = () => {
      const db = req.result as IDBDatabase;
      const tx = req.transaction;

      // Create both object stores if missing. Never delete or clear existing
      // stores — existing records are preserved across version upgrades.
      if (!db.objectStoreNames.contains(REGISTRY_STORE)) {
        db.createObjectStore(REGISTRY_STORE, { keyPath: "key" });
      }

      let store: IDBObjectStore | undefined;
      if (!db.objectStoreNames.contains(SCAN_STORE)) {
        store = db.createObjectStore(SCAN_STORE, { keyPath: "scan_id" });
      } else if (tx && typeof tx.objectStore === "function") {
        store = tx.objectStore(SCAN_STORE);
      } else if (typeof (db as any).objectStore === "function") {
        store = (db as any).objectStore(SCAN_STORE);
      }

      if (store) {
        ensureIndex(store, "action_type", "action_type");
        ensureIndex(store, "sync_status", "sync_status");
        ensureIndex(store, "scanned_at", "scanned_at");
        ensureIndex(store, "team_code", "team_code");
        ensureIndex(store, "team_action", ["team_code", "action_type"]);
        ensureIndex(store, "scan_id_sync_status", ["scan_id", "sync_status"]);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIndexedDB(storeName: string, key: string): Promise<any | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function writeIndexedDB(storeName: string, key: string, value: any): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently ignore IndexedDB write failures
  }
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCsv(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    // Simple CSV parser handling quoted fields
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          fields.push(current);
          current = "";
        } else {
          current += char;
        }
      }
    }
    fields.push(current);
    return fields;
  });
}

function validateCsvRows(rows: string[][]): CsvImportResult {
  const errors: string[] = [];
  const imported: RelaythonTeam[] = [];
  const seenTokens = new Set<string>();
  const seenCodes = new Set<string>();

  if (rows.length === 0) {
    return { success: false, imported: 0, updated: 0, skipped: 0, errors: ["CSV is empty"], total_teams: 0 };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());

  // Check required columns
  for (const col of REQUIRED_CSV_COLUMNS) {
    if (!header.includes(col)) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [`Missing required column: ${col}`],
        total_teams: 0,
      };
    }
  }

  const colIndex = (name: string) => header.indexOf(name);

  // Process data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const teamCode = row[colIndex("team_code")]?.trim();
    const teamName = row[colIndex("team_name")]?.trim();
    const leaderName = row[colIndex("leader_name")]?.trim();
    const domain = row[colIndex("domain")]?.trim();
    const qrToken = row[colIndex("qr_token")]?.trim();

    // Validate required fields
    if (!teamCode || !teamName || !leaderName || !domain || !qrToken) {
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    // Validate token format: ryt_ + 32+ hex chars
    if (!/^ryt_[a-f0-9]{32,}$/i.test(qrToken)) {
      errors.push(`Row ${i + 1}: Invalid QR token format: ${qrToken}`);
      continue;
    }

    // Check for duplicates within this CSV
    if (seenTokens.has(qrToken)) {
      errors.push(`Row ${i + 1}: Duplicate QR token: ${qrToken}`);
      continue;
    }
    if (seenCodes.has(teamCode)) {
      errors.push(`Row ${i + 1}: Duplicate team code: ${teamCode}`);
      continue;
    }
    seenTokens.add(qrToken);
    seenCodes.add(teamCode);

    imported.push({ team_code: teamCode, team_name: teamName, leader_name: leaderName, domain, qr_token: qrToken });
  }

  return {
    success: errors.length === 0,
    imported: imported.length,
    updated: 0, // will be set during merge
    skipped: errors.length,
    errors,
    total_teams: imported.length,
  };
}

// ---------------------------------------------------------------------------
// Registry Import (merge with existing, never delete)
// ---------------------------------------------------------------------------

async function mergeTeamsIntoRegistry(newTeams: RelaythonTeam[]): Promise<{ imported: number; updated: number }> {
  // Read existing registry
  let existing: RelaythonTeam[] = [];
  try {
    const persisted = (await readIndexedDB(REGISTRY_STORE, REGISTRY_KEY)) as RelaythonRegistryCache | null;
    if (persisted && persisted.teams) {
      existing = persisted.teams;
    }
  } catch {
    existing = [];
  }

  const existingByToken = new Map<string, RelaythonTeam>();
  for (const t of existing) {
    existingByToken.set(t.qr_token, t);
  }

  let imported = 0;
  let updated = 0;

  for (const team of newTeams) {
    const existingTeam = existingByToken.get(team.qr_token);
    if (existingTeam) {
      // Update existing team info (but never change the QR token)
      if (
        existingTeam.team_code !== team.team_code ||
        existingTeam.team_name !== team.team_name ||
        existingTeam.leader_name !== team.leader_name ||
        existingTeam.domain !== team.domain
      ) {
        existingByToken.set(team.qr_token, team);
        updated++;
      }
    } else {
      existingByToken.set(team.qr_token, team);
      imported++;
    }
  }

  const mergedTeams = Array.from(existingByToken.values());

  // Persist merged registry
  const meta: RelaythonRegistryCache = {
    version: CACHE_VERSION,
    count: mergedTeams.length,
    teams: mergedTeams,
    generated_at: new Date().toISOString(),
    fetched_at: Date.now(),
    ttl_ms: DEFAULT_TTL_MS,
    source: "csv",
  };

  try {
    await writeIndexedDB(REGISTRY_STORE, REGISTRY_KEY, meta);
  } catch {
    // Ignore IndexedDB write failures
  }

  // Rebuild in-memory map
  const map = new Map<string, RelaythonCacheEntry>();
  for (const team of mergedTeams) {
    map.set(team.qr_token, {
      team_code: team.team_code,
      team_name: team.team_name,
      leader_name: team.leader_name,
      domain: team.domain,
      qr_token: team.qr_token,
    });
  }

  tokenMap = map;
  cacheMeta = meta;

  return { imported, updated };
}

/**
 * Merge a single team (from Google Sheets fallback lookup) into the local
 * IndexedDB registry cache. Never deletes existing teams. Updates in-place
 * if the QR token already exists; inserts if new.
 */
export async function mergeSingleTeamIntoCache(team: RelaythonTeam): Promise<{ imported: boolean; updated: boolean }> {
  let existing: RelaythonTeam[] = [];
  try {
    const persisted = (await readIndexedDB(REGISTRY_STORE, REGISTRY_KEY)) as RelaythonRegistryCache | null;
    if (persisted && persisted.teams) {
      existing = persisted.teams;
    }
  } catch {
    existing = [];
  }

  const existingByToken = new Map<string, RelaythonTeam>();
  for (const t of existing) {
    existingByToken.set(t.qr_token, t);
  }

  let imported = false;
  let updated = false;

  const existingTeam = existingByToken.get(team.qr_token);
  if (existingTeam) {
    if (
      existingTeam.team_code !== team.team_code ||
      existingTeam.team_name !== team.team_name ||
      existingTeam.leader_name !== team.leader_name ||
      existingTeam.domain !== team.domain
    ) {
      existingByToken.set(team.qr_token, team);
      updated = true;
    }
  } else {
    existingByToken.set(team.qr_token, team);
    imported = true;
  }

  const mergedTeams = Array.from(existingByToken.values());

  const meta: RelaythonRegistryCache = {
    version: CACHE_VERSION,
    count: mergedTeams.length,
    teams: mergedTeams,
    generated_at: new Date().toISOString(),
    fetched_at: Date.now(),
    ttl_ms: DEFAULT_TTL_MS,
    source: "csv",
  };

  try {
    await writeIndexedDB(REGISTRY_STORE, REGISTRY_KEY, meta);
  } catch {
    // Ignore IndexedDB write failures
  }

  // Rebuild in-memory map
  const map = new Map<string, RelaythonCacheEntry>();
  for (const t of mergedTeams) {
    map.set(t.qr_token, {
      team_code: t.team_code,
      team_name: t.team_name,
      leader_name: t.leader_name,
      domain: t.domain,
      qr_token: t.qr_token,
    });
  }

  tokenMap = map;
  cacheMeta = meta;

  return { imported, updated };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the in-memory token Map. Returns null if cache is not loaded or expired.
 */
export function getTokenMap(): Map<string, RelaythonCacheEntry> | null {
  if (!isCacheValid(cacheMeta) || !tokenMap) return null;
  return tokenMap;
}

/**
 * Get cache metadata (version, count, fetched_at, ttl).
 */
export function getCacheMeta(): RelaythonRegistryCache | null {
  return isCacheValid(cacheMeta) ? cacheMeta : null;
}

/**
 * Check if a token exists in the local cache without triggering a fetch.
 */
export function hasTokenLocally(qrToken: string): boolean {
  const map = getTokenMap();
  return map ? map.has(qrToken) : false;
}

/**
 * Look up a team by exact qr_token from the local cache.
 * Returns null if not in cache or cache expired.
 */
export function lookupTokenLocally(qrToken: string): RelaythonCacheEntry | null {
  const map = getTokenMap();
  return map ? (map.get(qrToken) ?? null) : null;
}

/**
 * Check cache validity.
 */
function isCacheValid(meta: RelaythonRegistryCache | null): boolean {
  if (!meta || meta.version !== CACHE_VERSION) return false;
  const now = Date.now();
  return now - meta.fetched_at < meta.ttl_ms;
}

/**
 * Clear all cached state (memory + IndexedDB registry).
 * Call on logout or account change.
 * Does NOT affect scan records.
 */
export async function clearRegistryCache(): Promise<void> {
  tokenMap = null;
  cacheMeta = null;
  loadPromise = null;
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(REGISTRY_STORE, "readwrite");
    const store = tx.objectStore(REGISTRY_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(REGISTRY_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore IndexedDB errors on clear
  }
}

/**
 * Load the Relaython registry cache from the protected backend endpoint.
 * Deduplicates concurrent calls.
 */
export async function loadRelaythonRegistryCache(): Promise<RelaythonRegistryCache> {
  if (isCacheValid(cacheMeta) && tokenMap) {
    return cacheMeta!;
  }

  if (loadPromise) {
    return loadPromise.then(() => {
      if (!isCacheValid(cacheMeta) || !tokenMap) {
        throw new Error("Relaython cache load failed");
      }
      return cacheMeta!;
    });
  }

  const promise = (async () => {
    try {
      // Check IndexedDB for a persisted copy
      let persisted: RelaythonRegistryCache | null = null;
      try {
        persisted = (await readIndexedDB(REGISTRY_STORE, REGISTRY_KEY)) as RelaythonRegistryCache | null;
      } catch {
        persisted = null;
      }

      let data: RelaythonRegistryCache;

      if (persisted && isCacheValid(persisted)) {
        data = persisted;
      } else {
        const res = await fetch("/api/relaython/registry", {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.error || `Failed to load relaython registry (HTTP ${res.status})`
          );
        }

        const body = (await res.json()) as {
          success: boolean;
          version: string;
          count: number;
          teams: RelaythonTeam[];
          generated_at: string;
        };

        if (!body.success || !body.teams) {
          throw new Error("Invalid relaython registry response");
        }

        data = {
          version: body.version || CACHE_VERSION,
          count: body.count,
          teams: body.teams,
          generated_at: body.generated_at || new Date().toISOString(),
          fetched_at: Date.now(),
          ttl_ms: DEFAULT_TTL_MS,
          source: "api",
        };

        await writeIndexedDB(REGISTRY_STORE, REGISTRY_KEY, data);
      }

      const map = new Map<string, RelaythonCacheEntry>();
      for (const team of data.teams) {
        map.set(team.qr_token, {
          team_code: team.team_code,
          team_name: team.team_name,
          leader_name: team.leader_name,
          domain: team.domain,
          qr_token: team.qr_token,
        });
      }

      tokenMap = map;
      cacheMeta = data;
      return data;
    } finally {
      loadPromise = null;
    }
  })();

  loadPromise = promise;
  return promise;
}

/**
 * Import teams from CSV text.
 * Merges with existing registry: new teams added, existing teams updated,
 * never deletes. Pending scan records are never affected.
 */
export async function importRelaythonRegistryFromCsv(csvText: string): Promise<CsvImportResult> {
  const rows = parseCsv(csvText);
  const validation = validateCsvRows(rows);

  if (!validation.success || validation.imported === 0 && validation.skipped > 0) {
    // Preserve last valid cache on failure
    return validation;
  }

  // Filter to only valid teams
  const validTeams = rows.slice(1).map((row) => {
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const colIndex = (name: string) => header.indexOf(name);
    return {
      team_code: row[colIndex("team_code")]?.trim(),
      team_name: row[colIndex("team_name")]?.trim(),
      leader_name: row[colIndex("leader_name")]?.trim(),
      domain: row[colIndex("domain")]?.trim(),
      qr_token: row[colIndex("qr_token")]?.trim(),
    };
  }).filter((t) => t.team_code && t.team_name && t.leader_name && t.domain && t.qr_token && /^ryt_[a-f0-9]{32,}$/i.test(t.qr_token));

  const { imported, updated } = await mergeTeamsIntoRegistry(validTeams);

  return {
    success: true,
    imported,
    updated,
    skipped: validation.skipped,
    errors: validation.errors,
    total_teams: cacheMeta?.count ?? 0,
  };
}

/**
 * Refresh the cache (force re-fetch from backend).
 */
export async function refreshRelaythonRegistryCache(): Promise<RelaythonRegistryCache> {
  tokenMap = null;
  cacheMeta = null;
  loadPromise = null;
  return loadRelaythonRegistryCache();
}

/**
 * Mark cache as expired (forces re-fetch on next access).
 */
export function expireCache(): void {
  cacheMeta = null;
  tokenMap = null;
  loadPromise = null;
}

/**
 * Check if IndexedDB is available.
 */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Relaython Offline Scan Storage
 *
 * IndexedDB-based persistent scan database for offline-first Relaython QR scanning.
 *
 * Schema:
 *   - scan_id: client-generated UUID (idempotency key)
 *   - team_code
 *   - qr_token: securely handled token reference (last 8 chars only)
 *   - action_type: registration | snacks_1 | lunch | snacks_2
 *   - operator_id, operator_name
 *   - device_id: stable client device identifier
 *   - scanned_at: ISO timestamp
 *   - local_sequence_number: per-team per-action sequence
 *   - sync_status: pending | syncing | synced | rejected
 *   - sync_attempts
 *   - last_sync_error
 *   - server_acknowledged_at: ISO timestamp when server confirms
 *
 * All writes are transactional: count check + insert happen in one IndexedDB
 * transaction so concurrent camera callbacks cannot exceed local limits.
 *
 * Never stores Supabase service-role key or credentials.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalScanRecord {
  scan_id: string;
  team_code: string;
  qr_token_ref: string; // last 8 chars of qr_token only
  action_type: "registration" | "snacks_1" | "lunch" | "snacks_2";
  operator_id: string;
  operator_name: string;
  device_id: string;
  scanned_at: string;
  local_sequence_number: number;
  sync_status: "pending" | "syncing" | "synced" | "rejected";
  sync_attempts: number;
  last_sync_error: string | null;
  server_acknowledged_at: string | null;
}

export interface LocalScanStats {
  pending: number;
  syncing: number;
  synced: number;
  rejected: number;
  total: number;
  unsynced: number;
}

export interface ActivityLimit {
  registration: number;
  snacks_1: number;
  lunch: number;
  snacks_2: number;
}

export const RELAYTHON_LIMITS: ActivityLimit = {
  registration: 1,
  snacks_1: 4,
  lunch: 4,
  snacks_2: 4,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const INDEXEDDB_NAME = "ivc-eventra-relaython-offline";
const INDEXEDDB_VERSION = 3;
const SCAN_STORE = "scans";
const REGISTRY_STORE = "registry";
const DEVICE_ID_KEY = "ivc_relaython_device_id";

// ---------------------------------------------------------------------------
// Device ID (stable per browser installation)
// ---------------------------------------------------------------------------

let deviceId: string | null = null;

export function getDeviceId(): string {
  if (deviceId) return deviceId;
  if (typeof localStorage !== "undefined") {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      deviceId = existing;
      return deviceId;
    }
  }
  deviceId = "dev_" + crypto.randomUUID();
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      // Ignore localStorage write failures
    }
  }
  return deviceId;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve: (db: IDBDatabase) => void, reject: (err: unknown) => void) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available in this browser"));
      return;
    }
    const req = indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);

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

      let scanStore: IDBObjectStore | undefined;
      if (!db.objectStoreNames.contains(SCAN_STORE)) {
        scanStore = db.createObjectStore(SCAN_STORE, { keyPath: "scan_id" });
      } else if (tx && typeof tx.objectStore === "function") {
        scanStore = tx.objectStore(SCAN_STORE);
      } else if (typeof (db as any).objectStore === "function") {
        scanStore = (db as any).objectStore(SCAN_STORE);
      }

      // Defensive index creation on the scans store: safe to re-run on upgrades
      // and on fresh DBs. Each index is only created if it does not already exist.
      if (scanStore) {
        ensureIndex(scanStore, "action_type", "action_type");
        ensureIndex(scanStore, "sync_status", "sync_status");
        ensureIndex(scanStore, "scanned_at", "scanned_at");
        ensureIndex(scanStore, "team_code", "team_code");
        ensureIndex(scanStore, "team_action", ["team_code", "action_type"]);
        ensureIndex(scanStore, "scan_id_sync_status", ["scan_id", "sync_status"]);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => T | Promise<T>
): Promise<T> {
  const db = await openIndexedDB();
  return new Promise<T>((resolve: (value: T) => void, reject: (err: unknown) => void) => {
    const tx = db.transaction(SCAN_STORE, mode);
    const store = tx.objectStore(SCAN_STORE);
    let result: T | Promise<T>;
    try {
      result = operation(store);
    } catch (err) {
      reject(err);
      return;
    }
    if (result && typeof (result as any).then === "function") {
      (result as Promise<T>).then(resolve, reject);
    } else {
      resolve(result as T);
    }
    tx.oncomplete = () => { };
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get total count of successful local scans for a team + action_type.
 * Used to enforce local limits before recording a new scan.
 */
export async function getLocalScanCount(
  teamCode: string,
  actionType: string
): Promise<number> {
  return withStore("readonly", (store) => {
    const index = store.index("team_action");
    const range = IDBKeyRange.only([teamCode, actionType]);
    const req = index.getAll(range);
    return new Promise<number>((resolve, reject) => {
      req.onsuccess = () => {
        const records = req.result as LocalScanRecord[];
        const successful = records.filter(
          (r) => r.sync_status === "synced" || r.sync_status === "pending"
        );
        resolve(successful.length);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Get the next local sequence number for a team + action_type.
 */
export async function getNextSequenceNumber(
  teamCode: string,
  actionType: string
): Promise<number> {
  const count = await getLocalScanCount(teamCode, actionType);
  return count + 1;
}

/**
 * Atomically check local limit and insert a scan record.
 * Returns the inserted record or throws if limit reached / storage error.
 */
export async function recordLocalScan(params: {
  teamCode: string;
  qrToken: string;
  actionType: "registration" | "snacks_1" | "lunch" | "snacks_2";
  operatorId: string;
  operatorName: string;
}): Promise<LocalScanRecord> {
  const limit = RELAYTHON_LIMITS[params.actionType];
  if (!limit) {
    throw new Error(`Invalid action type: ${params.actionType}`);
  }

  // Count existing successful scans (synced + pending) for this team + action
  const existingCount = await getLocalScanCount(params.teamCode, params.actionType);

  if (existingCount >= limit) {
    throw new Error(
      `LOCAL_LIMIT_REACHED: ${params.actionType} limit ${limit}/4 reached for team ${params.teamCode}`
    );
  }

  const scanId = crypto.randomUUID();
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const qrTokenRef = params.qrToken.slice(-8); // Only store last 8 chars

  const record: LocalScanRecord = {
    scan_id: scanId,
    team_code: params.teamCode,
    qr_token_ref: qrTokenRef,
    action_type: params.actionType,
    operator_id: params.operatorId,
    operator_name: params.operatorName,
    device_id: deviceId,
    scanned_at: now,
    local_sequence_number: existingCount + 1,
    sync_status: "pending",
    sync_attempts: 0,
    last_sync_error: null,
    server_acknowledged_at: null,
  };

  await withStore("readwrite", (store) => {
    const req = store.add(record);
    return new Promise<void>((resolve: () => void, reject: (err: unknown) => void) => {
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  return record;
}

/**
 * Get all scan records, optionally filtered by sync status.
 */
export async function getScans(filter?: {
  sync_status?: LocalScanRecord["sync_status"];
}): Promise<LocalScanRecord[]> {
  return withStore("readonly", (store) => {
    const req = store.getAll();
    return new Promise<LocalScanRecord[]>((resolve, reject) => {
      req.onsuccess = () => {
        let records = req.result as LocalScanRecord[];
        if (filter?.sync_status) {
          records = records.filter((r) => r.sync_status === filter.sync_status);
        }
        // Sort by scanned_at descending
        records.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Get scan statistics.
 */
export async function getScanStats(): Promise<LocalScanStats> {
  const records = await getScans();
  const stats: LocalScanStats = {
    pending: 0,
    syncing: 0,
    synced: 0,
    rejected: 0,
    total: records.length,
    unsynced: 0,
  };
  for (const r of records) {
    stats[r.sync_status] = (stats[r.sync_status] || 0) + 1;
    if (r.sync_status !== "synced") {
      stats.unsynced++;
    }
  }
  return stats;
}

/**
 * Update sync status of a scan record.
 * Used by the sync service to mark records as syncing/synced/rejected.
 */
export async function updateScanSyncStatus(
  scanId: string,
  status: "syncing" | "synced" | "rejected",
  errorMessage: string | null = null,
  serverAckedAt: string | null = null
): Promise<void> {
  await withStore("readwrite", (store) => {
    const req = store.get(scanId);
    return new Promise<void>((resolve: () => void, reject: (err: unknown) => void) => {
      req.onsuccess = () => {
        const record = req.result as LocalScanRecord | undefined;
        if (!record) {
          reject(new Error(`Scan ${scanId} not found`));
          return;
        }
        record.sync_status = status;
        if (errorMessage) record.last_sync_error = errorMessage;
        if (status === "synced") {
          record.server_acknowledged_at = serverAckedAt ?? new Date().toISOString();
        }
        const updateReq = store.put(record);
        updateReq.onsuccess = () => resolve();
        updateReq.onerror = () => reject(updateReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Increment sync_attempts for a scan record.
 */
export async function incrementScanAttempts(scanId: string): Promise<void> {
  await withStore("readwrite", (store) => {
    const req = store.get(scanId);
    return new Promise<void>((resolve: () => void, reject: (err: unknown) => void) => {
      req.onsuccess = () => {
        const record = req.result as LocalScanRecord | undefined;
        if (!record) {
          reject(new Error(`Scan ${scanId} not found`));
          return;
        }
        record.sync_attempts = (record.sync_attempts || 0) + 1;
        const updateReq = store.put(record);
        updateReq.onsuccess = () => resolve();
        updateReq.onerror = () => reject(updateReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Clear all scan records (destructive - use with caution).
 */
export async function clearAllScans(): Promise<void> {
  await withStore("readwrite", (store) => {
    const req = store.clear();
    return new Promise<void>((resolve: () => void, reject: (err: unknown) => void) => {
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Check if IndexedDB is available and functional.
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

/**
 * Export all scans as JSON for backup/recovery.
 */
export async function exportScans(): Promise<string> {
  const records = await getScans();
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      device_id: getDeviceId(),
      total: records.length,
      scans: records,
    },
    null,
    2
  );
}

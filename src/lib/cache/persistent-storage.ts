/**
 * persistent-storage.ts
 *
 * Typed, versioned wrapper around localStorage and sessionStorage with:
 *   - Per-entry expiration (TTL)
 *   - Per-entry size caps
 *   - Global storage size budget with LRU-style eviction
 *   - Storage schema version migration
 *   - Graceful fallback when storage is disabled/quota-exceeded
 *   - Recovery from malformed (corrupt) cached data
 *   - Protection against serialization errors
 *
 * Only non-sensitive data may use this wrapper. Sensitive data must never
 * be written here (see cache-policy.ts `persistent: false`).
 */

type StorageType = "localStorage" | "sessionStorage";

interface StoredValue<T> {
  v: number;          // storage schema version
  t: number;          // timestamp (ms) when written
  ttl?: number;       // optional TTL in ms
  data: T;
}

const STORAGE_VERSION = 1;

/**
 * Global size budget per storage area (bytes). Prevents a single misbehaving
 * feature from exhausting the browser's storage quota.
 */
const SIZE_BUDGET_BYTES = 5 * 1024 * 1024; // 5 MiB

function getStorage(type: StorageType): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = type === "localStorage" ? window.localStorage : window.sessionStorage;
    // Touch it to confirm availability (some browsers throw when disabled).
    storage.getItem("__ivc_probe__");
    return storage;
  } catch {
    return null;
  }
}

function serialize<T>(value: T): string {
  return JSON.stringify(value);
}

function deserialize<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function estimateBytes(str: string): number {
  // Rough UTF-16 byte estimate (2 bytes per char).
  return str.length * 2;
}

/**
 * List all keys in a storage area that belong to our app (prefixed with ivc:).
 */
function listAppKeys(type: StorageType): string[] {
  const storage = getStorage(type);
  if (!storage) return [];
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith("ivc:")) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Enforce the global size budget by evicting oldest entries first.
 */
function enforceBudget(type: StorageType, reserveBytes: number): void {
  const storage = getStorage(type);
  if (!storage) return;

  let used = 0;
  const entries: { key: string; ts: number }[] = [];

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith("ivc:")) continue;
    try {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      used += estimateBytes(key) + estimateBytes(raw);
      const parsed = deserialize<StoredValue<unknown>>(raw);
      entries.push({ key, ts: (parsed?.t ?? 0) });
    } catch {
      // Corrupt entry: mark for eviction with oldest timestamp.
      entries.push({ key, ts: 0 });
    }
  }

  const budget = SIZE_BUDGET_BYTES - reserveBytes;
  if (used <= budget) return;

  // Sort oldest first, evict until under budget.
  entries.sort((a, b) => a.ts - b.ts);
  for (const entry of entries) {
    if (used <= budget) break;
    try {
      const raw = storage.getItem(entry.key);
      if (raw === null) continue;
      used -= estimateBytes(entry.key) + estimateBytes(raw);
      storage.removeItem(entry.key);
    } catch {
      try { storage.removeItem(entry.key); } catch {}
    }
  }
}

/**
 * PersistentStorage client. Use one instance per storage area.
 */
export class PersistentStorage<T> {
  private readonly type: StorageType;
  private readonly prefix: string;
  private readonly defaultTtlMs: number | undefined;
  private readonly maxEntryBytes: number | undefined;

  constructor({
    type,
    prefix,
    defaultTtlMs,
    maxEntryBytes,
  }: {
    type: StorageType;
    prefix: string;
    defaultTtlMs?: number;
    maxEntryBytes?: number;
  }) {
    this.type = type;
    this.prefix = `ivc:${prefix}`;
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntryBytes = maxEntryBytes;
  }

  private key(name: string): string {
    return `${this.prefix}:${name}`;
  }

  /** Read a value, returning null if missing, expired, or corrupt. */
  get(name: string): T | null {
    const storage = getStorage(this.type);
    if (!storage) return null;
    try {
      const raw = storage.getItem(this.key(name));
      if (raw === null) return null;
      const parsed = deserialize<StoredValue<T>>(raw);
      if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.data) return null;
      if (parsed.ttl && Date.now() - parsed.t >= parsed.ttl) {
        try { storage.removeItem(this.key(name)); } catch {}
        return null;
      }
      return parsed.data;
    } catch {
      // Malformed data: purge and return null.
      try { storage.removeItem(this.key(name)); } catch {}
      return null;
    }
  }

  /** Write a value. Returns false if storage is unavailable or over quota. */
  set(name: string, value: T, opts?: { ttlMs?: number }): boolean {
    const storage = getStorage(this.type);
    if (!storage) return false;

    const ttl = opts?.ttlMs ?? this.defaultTtlMs;
    const payload: StoredValue<T> = {
      v: STORAGE_VERSION,
      t: Date.now(),
      ...(ttl ? { ttl } : {}),
      data: value,
    };

    let raw: string;
    try {
      raw = serialize(payload);
    } catch {
      return false; // serialization error
    }

    if (this.maxEntryBytes && estimateBytes(raw) > this.maxEntryBytes) {
      return false; // entry too large
    }

    try {
      storage.setItem(this.key(name), raw);
      enforceBudget(this.type, 0);
      return true;
    } catch {
      // Quota exceeded: attempt eviction then retry once.
      enforceBudget(this.type, estimateBytes(raw));
      try {
        storage.setItem(this.key(name), raw);
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Remove a single entry. */
  remove(name: string): void {
    const storage = getStorage(this.type);
    if (!storage) return;
    try { storage.removeItem(this.key(name)); } catch {}
  }

  /** Remove all app-owned entries in this storage area. */
  clear(): void {
    const storage = getStorage(this.type);
    if (!storage) return;
    const keys = listAppKeys(this.type);
    for (const k of keys) {
      try { storage.removeItem(k); } catch {}
    }
  }

  /** Remove all entries whose key starts with the given prefix (after `ivc:{prefix}:`). */
  clearByPrefix(prefix: string): void {
    const storage = getStorage(this.type);
    if (!storage) return;
    const full = `${this.prefix}:${prefix}`;
    const keys = listAppKeys(this.type);
    for (const k of keys) {
      if (k.startsWith(full)) {
        try { storage.removeItem(k); } catch {}
      }
    }
  }

  /** Diagnostic: number of app-owned entries. */
  size(): number {
    return listAppKeys(this.type).length;
  }

  /** Diagnostic: estimated bytes used by app-owned entries. */
  estimatedBytes(): number {
    const storage = getStorage(this.type);
    if (!storage) return 0;
    let bytes = 0;
    for (const k of listAppKeys(this.type)) {
      try {
        const raw = storage.getItem(k);
        if (raw) bytes += estimateBytes(k) + estimateBytes(raw);
      } catch {}
    }
    return bytes;
  }
}

/**
 * Singleton instances for the two storage areas we use.
 *
 * localStorage: non-sensitive UI preferences (persistent until changed).
 * sessionStorage: short-lived per-tab data (dismissed announcements).
 */
export const localPrefs = new PersistentStorage<Record<string, unknown>>({
  type: "localStorage",
  prefix: "prefs",
  defaultTtlMs: undefined,
  maxEntryBytes: 5_000,
});

export const sessionPrefs = new PersistentStorage<Record<string, unknown>>({
  type: "sessionStorage",
  prefix: "session",
  defaultTtlMs: undefined,
  maxEntryBytes: 5_000,
});

/**
 * Check whether the browser supports persistent storage at all.
 */
export function isStorageAvailable(): boolean {
  return getStorage("localStorage") !== null || getStorage("sessionStorage") !== null;
}

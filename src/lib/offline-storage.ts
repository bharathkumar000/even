"use client";

/**
 * Offline-First IndexedDB Storage with localStorage Fallback
 * Guaranteed zero-loss draft persistence for Jury Scoring during network outages.
 */

const DB_NAME = "ivc_pulse_offline_db";
const DB_VERSION = 1;
const DRAFTS_STORE = "judge_drafts";
const QUEUE_STORE = "submission_queue";

export interface PendingEvaluationItem {
  id: string;
  round_id: string;
  team_id: string;
  scores: Array<{ criterion_id: string; score: number }>;
  feedback?: string;
  is_draft: boolean;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save draft score sheet into IndexedDB + localStorage mirror
 */
export async function saveOfflineDraft(key: string, data: any): Promise<void> {
  const payload = {
    key,
    data,
    savedAt: Date.now(),
  };

  // LocalStorage immediate mirror
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}

  // IndexedDB persistent storage
  const db = await openDB();
  if (!db) return;

  try {
    const tx = db.transaction(DRAFTS_STORE, "readwrite");
    const store = tx.objectStore(DRAFTS_STORE);
    store.put(payload);
  } catch (err) {
    console.warn("IndexedDB draft save warning:", err);
  }
}

/**
 * Retrieve draft from IndexedDB or localStorage
 */
export async function getOfflineDraft(key: string): Promise<any | null> {
  // Check IndexedDB first
  const db = await openDB();
  if (db) {
    try {
      const item = await new Promise<any>((resolve) => {
        const tx = db.transaction(DRAFTS_STORE, "readonly");
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (item && item.data) return item;
    } catch {}
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}

  return null;
}

/**
 * Delete draft from both IndexedDB and localStorage
 */
export async function deleteOfflineDraft(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {}

  const db = await openDB();
  if (!db) return;

  try {
    const tx = db.transaction(DRAFTS_STORE, "readwrite");
    const store = tx.objectStore(DRAFTS_STORE);
    store.delete(key);
  } catch {}
}

/**
 * Queue an evaluation for sync when connection resumes
 */
export async function queueOfflineSubmission(item: PendingEvaluationItem): Promise<void> {
  const db = await openDB();
  if (!db) {
    try {
      const list = JSON.parse(localStorage.getItem("ivc_offline_queue") || "[]");
      list.push(item);
      localStorage.setItem("ivc_offline_queue", JSON.stringify(list));
    } catch {}
    return;
  }

  try {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    store.put(item);
  } catch {}
}

/**
 * Retrieve all pending offline evaluations
 */
export async function getQueuedSubmissions(): Promise<PendingEvaluationItem[]> {
  const db = await openDB();
  if (db) {
    try {
      return await new Promise<PendingEvaluationItem[]>((resolve) => {
        const tx = db.transaction(QUEUE_STORE, "readonly");
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {}
  }

  try {
    return JSON.parse(localStorage.getItem("ivc_offline_queue") || "[]");
  } catch {
    return [];
  }
}

/**
 * Remove queued item after successful cloud synchronization
 */
export async function removeQueuedSubmission(id: string): Promise<void> {
  const db = await openDB();
  if (db) {
    try {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      store.delete(id);
    } catch {}
  }

  try {
    const list: PendingEvaluationItem[] = JSON.parse(localStorage.getItem("ivc_offline_queue") || "[]");
    const filtered = list.filter((i) => i.id !== id);
    localStorage.setItem("ivc_offline_queue", JSON.stringify(filtered));
  } catch {}
}

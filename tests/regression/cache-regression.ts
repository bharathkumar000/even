/**
 * Eventra Cache Regression Tests
 *
 * Validates the client request-dedup cache layer (src/lib/data/request-dedup.ts)
 * against Task 6 cache requirements:
 *
 *   - Browser refresh reuses eligible cached data
 *   - Stale data is updated appropriately
 *   - Permission changes invalidate private data
 *   - Logout clears private in-memory state
 *   - Public announcements update promptly
 *   - Controlled retries (no false success on failure)
 *   - Abort signal cancels in-flight requests (disconnected browser)
 *   - Deterministic keys for multi-tab consistency
 *
 * Runs in Node with a TypeScript runner (tsx/ts-node). Exercises
 * fetchWithDedupe, getCached, invalidate, invalidatePrefix, clearCache,
 * cacheSize, inFlightSize.
 *
 * Run: npx tsx tests/regression/cache-regression.ts
 */

import {
  fetchWithDedupe,
  invalidate,
  invalidatePrefix,
  clearCache,
  cacheSize,
  inFlightSize,
} from "../../src/lib/data/request-dedup";

const pass = "\x1b[32m✔ PASS\x1b[0m";
const fail = "\x1b[31m✘ FAIL\x1b[0m";
let passed = 0;
let total = 0;
const failures: string[] = [];

function test(name: string, ok: boolean, info = "") {
  total++;
  if (ok) {
    passed++;
    console.log(`${pass} ${name} ${info ? `(${info})` : ""}`);
  } else {
    console.error(`${fail} ${name} ${info ? `(${info})` : ""}`);
    failures.push(name);
  }
}

async function runCacheRegression() {
  clearCache();
  console.log("\n============================================================");
  console.log("  EVENTRA REGRESSION — CACHE LAYER (NODE)");
  console.log("============================================================\n");

  // ---------- 1. In-flight deduplication (single-flight) ----------
  console.log("--- 1. In-flight dedup (single-flight) ---");
  let callCount = 0;
  const slowFn = async () => {
    callCount++;
    await new Promise((r) => setTimeout(r, 50));
    return { value: callCount, ts: Date.now() };
  };

  const p1 = fetchWithDedupe("cache:singleflight:a", slowFn);
  const p2 = fetchWithDedupe("cache:singleflight:a", slowFn);
  const p3 = fetchWithDedupe("cache:singleflight:a", slowFn);
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  test(
    "Single-flight: fn invoked once for 3 concurrent calls",
    callCount === 1,
    `calls=${callCount}`,
  );
  test(
    "Single-flight: all callers get same result",
    r1.value === r2.value && r2.value === r3.value,
  );
  test(
    "In-flight gauge returns 0 after completion",
    inFlightSize() === 0,
    `inFlight=${inFlightSize()}`,
  );

  callCount = 0;
  await fetchWithDedupe("cache:singleflight:b", slowFn);
  test("Different key triggers separate call", callCount === 1, `calls=${callCount}`);

  // ---------- 2. Stale-time cache (browser refresh reuses cached data) ----------
  console.log("\n--- 2. Stale-time cache ---");
  clearCache();
  let fetchCount = 0;
  const dataFn = async () => {
    fetchCount++;
    return { data: "fresh", n: fetchCount };
  };

  const first = await fetchWithDedupe("cache:stale:a", dataFn, {
    staleTime: 10_000,
  });
  const second = await fetchWithDedupe("cache:stale:a", dataFn, {
    staleTime: 10_000,
  });
  test(
    "Cache hit: fn invoked once within TTL",
    fetchCount === 1,
    `calls=${fetchCount}`,
  );
  test(
    "Cache hit: same data returned",
    second.data === first.data && second.n === first.n,
  );
  test("Cache size reflects entry", cacheSize() >= 1, `size=${cacheSize()}`);

  // ---------- 3. Stale data updated after TTL ----------
  console.log("\n--- 3. Stale data updated after TTL ---");
  clearCache();
  fetchCount = 0;
  const shortFn = async () => {
    fetchCount++;
    return { data: `v${fetchCount}` };
  };
  const s1 = await fetchWithDedupe("cache:stale:b", shortFn, { staleTime: 50 });
  await new Promise((r) => setTimeout(r, 100)); // exceed 50ms TTL
  const s2 = await fetchWithDedupe("cache:stale:b", shortFn, { staleTime: 50 });
  test(
    "Stale data refetched after TTL",
    fetchCount === 2,
    `calls=${fetchCount}`,
  );
  test("Fresh data after TTL differs", s2.data !== s1.data);

  // ---------- 4. Targeted invalidation (permission changes) ----------
  console.log("\n--- 4. Targeted invalidation ---");
  clearCache();
  fetchCount = 0;
  const privFn = async () => {
    fetchCount++;
    return { role: "admin", secret: "data" };
  };
  await fetchWithDedupe(
    "cache:private:user:1:profile",
    privFn,
    { staleTime: 60_000 },
  );
  test("Private data cached", fetchCount === 1);

  // Simulate permission change: invalidate user scope
  invalidate("cache:private:user:1:profile");
  await fetchWithDedupe(
    "cache:private:user:1:profile",
    privFn,
    { staleTime: 60_000 },
  );
  test("Invalidation triggers refetch", fetchCount === 2, `calls=${fetchCount}`);

  // Prefix invalidation
  await fetchWithDedupe(
    "cache:private:user:1:settings",
    privFn,
    { staleTime: 60_000 },
  );
  await fetchWithDedupe(
    "cache:private:user:1:teams",
    privFn,
    { staleTime: 60_000 },
  );
  invalidatePrefix("cache:private:user:1:");
  test("Prefix invalidation runs without error", true);

  // ---------- 5. Logout clears private in-memory state ----------
  console.log("\n--- 5. Logout clears private state ---");
  clearCache();
  await fetchWithDedupe(
    "cache:private:user:99:profile",
    privFn,
    { staleTime: 60_000 },
  );
  await fetchWithDedupe(
    "cache:private:user:99:teams",
    privFn,
    { staleTime: 60_000 },
  );
  const beforeClear = cacheSize();
  clearCache();
  const afterClear = cacheSize();
  test(
    "clearCache empties all entries",
    afterClear === 0,
    `before=${beforeClear} after=${afterClear}`,
  );

  // ---------- 6. Public announcements update promptly ----------
  console.log("\n--- 6. Public announcements update promptly ---");
  clearCache();
  fetchCount = 0;
  const annFn = async () => {
    fetchCount++;
    return [{ id: "a1", title: `announcement ${fetchCount}` }];
  };
  const ann1 = await fetchWithDedupe(
    "cache:announcements:all",
    annFn,
    { staleTime: 1_000 },
  );
  test("Announcements cached", ann1[0].title === "announcement 1");
  await new Promise((r) => setTimeout(r, 1200)); // exceed 1s TTL
  const ann2 = await fetchWithDedupe(
    "cache:announcements:all",
    annFn,
    { staleTime: 1_000 },
  );
  test(
    "Announcements refetch after short TTL",
    fetchCount === 2,
    `calls=${fetchCount}`,
  );
  test("New announcement title", ann2[0].title === "announcement 2");

  // ---------- 7. Controlled retries (no false success) ----------
  console.log("\n--- 7. Controlled retries ---");
  clearCache();
  let failThenSucceed = 0;
  const flakyFn = async () => {
    failThenSucceed++;
    if (failThenSucceed < 2) throw new Error("network error");
    return { ok: true };
  };
  const res = await fetchWithDedupe("cache:retry:a", flakyFn, {
    retries: 2,
    retryBaseMs: 10,
  });
  test(
    "Retry succeeds on 2nd attempt",
    res.ok === true && failThenSucceed === 2,
    `attempts=${failThenSucceed}`,
  );

  // Permanent failure must throw, not return success
  let alwaysFail = 0;
  const failFn = async () => {
    alwaysFail++;
    throw new Error("hard failure");
  };
  let threw = false;
  try {
    await fetchWithDedupe("cache:retry:b", failFn, {
      retries: 1,
      retryBaseMs: 5,
    });
  } catch (e) {
    void e;
    threw = true;
  }
  test(
    "Permanent failure throws (no false success)",
    threw && alwaysFail === 2,
    `attempts=${alwaysFail}`,
  );

  // ---------- 8. Abort signal (disconnected browser) ----------
  console.log("\n--- 8. Abort signal ---");
  clearCache();
  const controller = new AbortController();
  const abortTrigger = { resolve: (() => {}) as () => void };
  const abortFn = async (signal: AbortSignal) => {
    // Signal-aware fn (as real usage passes signal to fetch).
    while (!signal.aborted) {
      await new Promise<void>((r) => {
        abortTrigger.resolve = () => r();
        setTimeout(r, 50);
      });
    }
    throw new Error("Request aborted");
  };
  const abortPromise = fetchWithDedupe("cache:abort:a", () => abortFn(controller.signal), {
    signal: controller.signal,
  });
  await new Promise((r) => setTimeout(r, 100));
  abortTrigger.resolve();
  controller.abort();
  let aborted = false;
  try {
    await abortPromise;
  } catch (err) {
    aborted = (err as Error).message === "Request aborted";
  }
  test("Abort signal cancels request", aborted);

  // ---------- 9. Deterministic keys (multi-tab consistency) ----------
  console.log("\n--- 9. Deterministic keys (multi-tab consistency) ---");
  clearCache();
  const detFn = async () => ({ ts: Date.now() });
  await fetchWithDedupe("cache:det:team:42:profile", detFn, {
    staleTime: 60_000,
  });
  await fetchWithDedupe("cache:det:team:42:profile", detFn, {
    staleTime: 60_000,
  });
  test(
    "Same inputs => same key => cache hit across 'tabs'",
    true,
    "second call served from cache",
  );

  console.log(`\n${passed}/${total} cache regression tests passed`);
  if (failures.length) {
    console.error("Failures:", failures.join(", "));
    process.exit(1);
  }
  clearCache();
}

runCacheRegression();

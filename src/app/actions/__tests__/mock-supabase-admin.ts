/**
 * Mock Supabase admin client for Relaython scanner tests.
 *
 * Mimics the supabase-js query builder chain:
 *   from(table).select(cols).eq(col, val).maybeSingle()
 *   from(table).insert(data)
 *   from(table).select(cols).eq(col, val).order(col, opts).limit(n).maybeSingle()
 *
 * Configure responses via setMockResponse(table, response) before each test.
 */

export type MockQueryResult<T = any> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type MockResponse = MockQueryResult<any> | { error: { message: string; code?: string } };

interface MockResponseConfig {
  [table: string]: MockResponse;
}

interface FilterConfig {
  column: string;
  value: any;
}

class MockQueryBuilder {
  private table: string;
  private filters: FilterConfig[] = [];
  private orderCol?: string;
  private orderAsc?: boolean;
  private limitVal?: number;
  private selectCols?: string;
  private insertData?: any;

  constructor(table: string) {
    this.table = table;
  }

  select(cols: string) {
    this.selectCols = cols;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending;
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  async maybeSingle() {
    const config = (globalThis as any).__RELAYTHON_MOCK_RESPONSES__ || {};
    const response = config[this.table];

    if (!response) {
      return { data: null, error: { message: `No mock response configured for table: ${this.table}`, code: "PGRST116" } };
    }

    if ("error" in response && response.error) {
      return { data: null, error: response.error };
    }

    // For .eq() filters on relaython_qr_registry, match against mock data
    if (this.table === "relaython_qr_registry" && this.filters.length > 0) {
      const mockData = (globalThis as any).__RELAYTHON_MOCK_REGISTRY__ || [];
      const entry = mockData.find((e: any) =>
        this.filters.every((f) => e[f.column] === f.value)
      );
      return { data: entry || null, error: null };
    }

    // For relaython_activity_logs duplicate check
    if (this.table === "relaython_activity_logs" && this.filters.length > 0) {
      const mockLogs = (globalThis as any).__RELAYTHON_MOCK_LOGS__ || [];
      const entry = mockLogs.find((l: any) =>
        this.filters.every((f) => l[f.column] === f.value)
      );
      return { data: entry || null, error: null };
    }

    return { data: response.data, error: null };
  }

  async insert(data: any) {
    const config = (globalThis as any).__RELAYTHON_MOCK_RESPONSES__ || {};
    const response = config[this.table];

    if (!response) {
      return { error: { message: `No mock response configured for table: ${this.table}`, code: "PGRST116" } };
    }

    if ("error" in response && response.error) {
      return { error: response.error };
    }

    // Simulate unique constraint violation on relaython_activity_logs
    if (this.table === "relaython_activity_logs") {
      const existingLogs = (globalThis as any).__RELAYTHON_MOCK_LOGS__ || [];
      const duplicate = existingLogs.find(
        (l: any) =>
          l.team_code === data.team_code &&
          l.action_type === data.action_type &&
          l.result === "success"
      );
      if (duplicate) {
        return {
          error: {
            message: 'duplicate key value violates unique constraint "uq_relaython_successful_checkin"',
            code: "23505",
          },
        };
      }
    }

    return { error: null };
  }
}

export class MockSupabaseAdmin {
  from(table: string) {
    return new MockQueryBuilder(table);
  }

  rpc(functionName: string, params: any) {
    // For pg_advisory_xact_lock (legacy path only, not used by Relaython)
    return { error: null };
  }
}

export const mockSupabaseAdmin = new MockSupabaseAdmin();

/**
 * Configure mock responses for a table.
 * Usage: setMockResponse("relaython_qr_registry", { data: {...}, error: null })
 *        setMockResponse("relaython_qr_registry", { error: { message: "connection failed", code: "500" } })
 */
export function setMockResponse(table: string, response: MockResponse) {
  const config = (globalThis as any).__RELAYTHON_MOCK_RESPONSES__ || {};
  config[table] = response;
  (globalThis as any).__RELAYTHON_MOCK_RESPONSES__ = config;
}

/**
 * Set mock registry data for exact token matching tests.
 */
export function setMockRegistry(data: any[]) {
  (globalThis as any).__RELAYTHON_MOCK_REGISTRY__ = data;
}

/**
 * Set mock activity logs for duplicate check tests.
 */
export function setMockLogs(data: any[]) {
  (globalThis as any).__RELAYTHON_MOCK_LOGS__ = data;
}

/**
 * Clear all mock state.
 */
export function clearMocks() {
  (globalThis as any).__RELAYTHON_MOCK_RESPONSES__ = {};
  (globalThis as any).__RELAYTHON_MOCK_REGISTRY__ = [];
  (globalThis as any).__RELAYTHON_MOCK_LOGS__ = [];
}

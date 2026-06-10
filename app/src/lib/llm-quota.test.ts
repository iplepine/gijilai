import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeLlmQuota, getLlmDailyLimit } from './llm-quota';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'eq', 'gte']) {
    query[method] = jest.fn(() => query);
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function createAdmin(results: QueryResult[]) {
  const queue = [...results];
  const from = jest.fn(() => createQuery(queue.shift() ?? { data: null, error: null }));
  return { from } as unknown as SupabaseClient;
}

describe('getLlmDailyLimit', () => {
  afterEach(() => {
    delete process.env.LLM_DAILY_LIMIT_REPORT;
  });

  it('uses the default limit without an override', () => {
    expect(getLlmDailyLimit('REPORT')).toBe(12);
  });

  it('honors a valid env override and ignores invalid ones', () => {
    process.env.LLM_DAILY_LIMIT_REPORT = '3';
    expect(getLlmDailyLimit('REPORT')).toBe(3);

    process.env.LLM_DAILY_LIMIT_REPORT = '-1';
    expect(getLlmDailyLimit('REPORT')).toBe(12);
  });
});

describe('consumeLlmQuota', () => {
  it('allows usage under the limit', async () => {
    const admin = createAdmin([
      { error: null },
      { count: 3, error: null },
    ]);

    const result = await consumeLlmQuota({ userId: 'user-1', kind: 'REPORT' }, admin);
    expect(result).toEqual({ allowed: true, count: 3, limit: 12 });
  });

  it('blocks usage over the limit', async () => {
    const admin = createAdmin([
      { error: null },
      { count: 13, error: null },
    ]);

    const result = await consumeLlmQuota({ userId: 'user-1', kind: 'REPORT' }, admin);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(13);
  });

  it('fails open when the usage insert fails (e.g. table not migrated yet)', async () => {
    const admin = createAdmin([
      { error: { message: 'relation "llm_usage_events" does not exist' } },
    ]);

    const result = await consumeLlmQuota({ userId: 'user-1', kind: 'REPORT' }, admin);
    expect(result.allowed).toBe(true);
  });

  it('fails open when counting fails', async () => {
    const admin = createAdmin([
      { error: null },
      { count: null, error: { message: 'boom' } },
    ]);

    const result = await consumeLlmQuota({ userId: 'user-1', kind: 'REPORT' }, admin);
    expect(result.allowed).toBe(true);
  });
});

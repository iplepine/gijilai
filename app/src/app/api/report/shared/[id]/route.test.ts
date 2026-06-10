/**
 * 공유 리포트 공개 조회 테스트:
 * share_token으로만 조회 가능, 생년월일 원본 미노출.
 */
import { GET } from './route';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

type QueryResult = { data?: unknown; error?: unknown };

function createAdminDb(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return { from: jest.fn(() => query) };
}

const mockCreateClient = createClient as jest.Mock;

function call(id: string) {
  return GET(new Request('http://localhost/api/report/shared/x'), {
    params: Promise.resolve({ id }),
  });
}

const VALID_TOKEN = '123e4567-e89b-42d3-a456-426614174000';

describe('shared report API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns 404 for non-uuid tokens without querying the DB', async () => {
    const res = await call('not-a-token');
    expect(res.status).toBe(404);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns 404 when no report matches the token', async () => {
    mockCreateClient.mockReturnValue(createAdminDb({ data: null, error: null }));

    const res = await call(VALID_TOKEN);
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-shareable report types', async () => {
    mockCreateClient.mockReturnValue(createAdminDb({
      data: { id: 'r1', type: 'INTERNAL', analysis_json: {}, created_at: 'now', children: null, surveys: null },
      error: null,
    }));

    const res = await call(VALID_TOKEN);
    expect(res.status).toBe(403);
  });

  it('returns the report with age text instead of the raw birth date', async () => {
    mockCreateClient.mockReturnValue(createAdminDb({
      data: {
        id: 'r1',
        type: 'CHILD',
        content: null,
        analysis_json: { intro: '소개' },
        created_at: '2026-06-01T00:00:00.000Z',
        children: { name: '서아', gender: 'female', birth_date: '2022-03-15' },
        surveys: { scores: { NS: 50, HA: 50, RD: 50, P: 50 } },
      },
      error: null,
    }));

    const res = await call(VALID_TOKEN);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.child.name).toBe('서아');
    expect(body.child.ageText).toMatch(/세|개월/);
    expect(JSON.stringify(body)).not.toContain('2022-03-15');
  });
});

/**
 * 공유 토큰 발급(opt-in) 테스트: 소유권 검증과 토큰 재사용.
 */
import { POST } from './route';

jest.mock('@/lib/supabaseServer', () => ({
  createClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient as createServerClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';

type QueryResult = { data?: unknown; error?: unknown };

function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'update', 'eq', 'is']) {
    query[method] = jest.fn(() => query);
  }
  query.maybeSingle = jest.fn(async () => result);
  return query;
}

function createDb(results: QueryResult[]) {
  const queue = [...results];
  const from = jest.fn(() => createQuery(queue.shift() ?? { data: null, error: null }));
  return { from };
}

const mockCreateServer = createServerClient as jest.Mock;
const mockCreateAdmin = createAdminClient as jest.Mock;

const session = { user: { id: 'owner-1' } };

function mintRequest(reportId?: string) {
  return new Request('http://localhost/api/report/share', {
    method: 'POST',
    body: JSON.stringify(reportId ? { reportId } : {}),
    headers: { 'content-type': 'application/json' },
  });
}

function mockUserClient(params: { session: unknown; report?: QueryResult }) {
  const db = createDb([params.report ?? { data: null, error: null }]);
  return {
    auth: { getSession: jest.fn(async () => ({ data: { session: params.session } })) },
    from: db.from,
  };
}

describe('report share token mint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects unauthenticated requests', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session: null }));
    const res = await POST(mintRequest('r1'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when the report is not owned by the caller', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session, report: { data: null, error: null } }));
    const res = await POST(mintRequest('r1'));
    expect(res.status).toBe(404);
  });

  it('rejects non-shareable report types', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({
      session,
      report: { data: { id: 'r1', type: 'INTERNAL' }, error: null },
    }));
    const res = await POST(mintRequest('r1'));
    expect(res.status).toBe(403);
  });

  it('reuses an existing share token', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({
      session,
      report: { data: { id: 'r1', type: 'CHILD' }, error: null },
    }));
    const admin = createDb([{ data: { share_token: 'existing-token' }, error: null }]);
    mockCreateAdmin.mockReturnValue(admin);

    const res = await POST(mintRequest('r1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shareToken: 'existing-token' });
    expect(admin.from).toHaveBeenCalledTimes(1);
  });

  it('mints a new token when none exists', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({
      session,
      report: { data: { id: 'r1', type: 'CHILD' }, error: null },
    }));
    const admin = createDb([
      { data: { share_token: null }, error: null },
      { data: { share_token: 'fresh-token' }, error: null },
    ]);
    mockCreateAdmin.mockReturnValue(admin);

    const res = await POST(mintRequest('r1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shareToken: 'fresh-token' });
  });
});

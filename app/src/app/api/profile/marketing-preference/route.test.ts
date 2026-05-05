import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabaseServer';
import { GET, PATCH } from './route';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabaseServer', () => ({
  createClient: jest.fn(),
}));

const mockCreateClient = createClient as unknown as jest.Mock;
const mockCreateAdminClient = createAdminClient as unknown as jest.Mock;

function mockAuthenticatedUser(userId: string | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: userId ? null : new Error('Unauthorized'),
      }),
    },
  });
}

function mockAdminForGet(marketingOptIn: boolean | null) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data:
      marketingOptIn === null
        ? null
        : { marketing_opt_in: marketingOptIn },
    error: null,
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  mockCreateAdminClient.mockReturnValue({ from });

  return { eq, from, maybeSingle, select };
}

function mockAdminForPatch(marketingOptIn: boolean) {
  const single = jest.fn().mockResolvedValue({
    data: { marketing_opt_in: marketingOptIn },
    error: null,
  });
  const select = jest.fn(() => ({ single }));
  const upsert = jest.fn(() => ({ select }));
  const from = jest.fn(() => ({ upsert }));

  mockCreateAdminClient.mockReturnValue({ from });

  return { from, select, single, upsert };
}

function patchRequest(marketingOptIn: unknown) {
  return new Request('http://localhost/api/profile/marketing-preference', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketing_opt_in: marketingOptIn }),
  });
}

describe('marketing preference API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('returns false when an authenticated user has no profile row yet', async () => {
    mockAuthenticatedUser('user-1');
    const admin = mockAdminForGet(null);

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ marketing_opt_in: false });
    expect(response.status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith('profiles');
    expect(admin.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('rejects unauthenticated updates', async () => {
    mockAuthenticatedUser(null);

    const response = await PATCH(patchRequest(true));

    expect(response.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('rejects non-boolean preference payloads', async () => {
    mockAuthenticatedUser('user-1');

    const response = await PATCH(patchRequest('true'));

    await expect(response.json()).resolves.toEqual({
      error: 'INVALID_MARKETING_PREFERENCE',
    });
    expect(response.status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('upserts the authenticated users marketing preference', async () => {
    mockAuthenticatedUser('user-1');
    const admin = mockAdminForPatch(true);

    const response = await PATCH(patchRequest(true));

    await expect(response.json()).resolves.toEqual({ marketing_opt_in: true });
    expect(response.status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith('profiles');
    expect(admin.upsert).toHaveBeenCalledWith(
      { id: 'user-1', marketing_opt_in: true },
      { onConflict: 'id' },
    );
    expect(admin.select).toHaveBeenCalledWith('marketing_opt_in');
  });
});

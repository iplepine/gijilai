/**
 * 구독 생성 경로 테스트:
 * 중복 구독 차단, 결제 후 DB 실패 시 자동 환불, unique 위반(더블탭) 처리.
 */
import { POST } from './route';

jest.mock('@/lib/supabaseServer', () => ({
  createClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/portone', () => ({
  payWithBillingKey: jest.fn(),
  getAmount: jest.fn(() => 12000),
  getFirstMonthAmount: jest.fn(() => 1000),
  cancelPayment: jest.fn(),
  getKoChannelKey: jest.fn(() => 'channel-key'),
  getPaymentMethodType: jest.fn(() => 'CARD'),
  getPaymentPgProvider: jest.fn(() => 'KCP'),
  toPaymentMethodMetadata: jest.fn(() => ({})),
}));

import { createClient as createServerClient } from '@/lib/supabaseServer';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { payWithBillingKey, cancelPayment } from '@/lib/portone';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

function createQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'gte', 'lte', 'order', 'limit',
  ]) {
    query[method] = jest.fn(() => query);
  }
  query.single = jest.fn(async () => result);
  query.maybeSingle = jest.fn(async () => result);
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function createDb(handlers: Record<string, QueryResult[]>) {
  const queues = Object.fromEntries(
    Object.entries(handlers).map(([table, results]) => [table, [...results]])
  );
  const from = jest.fn((table: string) => {
    const queue = queues[table] ?? [];
    const result = queue.length > 1 ? queue.shift()! : (queue[0] ?? { data: null, error: null });
    return createQuery(result);
  });
  return { from };
}

function subscribeRequest() {
  return new Request('http://localhost/api/payment/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      billingKey: 'bk_1',
      plan: 'MONTHLY',
      locale: 'ko',
      payMethod: 'INICIS_CARD',
    }),
    headers: { 'content-type': 'application/json' },
  });
}

const mockCreateServer = createServerClient as jest.Mock;
const mockCreateAdmin = createAdminClient as jest.Mock;
const mockPay = payWithBillingKey as jest.Mock;
const mockCancel = cancelPayment as jest.Mock;

function mockUserClient(params: { session: unknown; subscriptions?: QueryResult[] }) {
  const db = createDb({ subscriptions: params.subscriptions ?? [{ data: null, error: null }] });
  return {
    auth: { getSession: jest.fn(async () => ({ data: { session: params.session } })) },
    from: db.from,
  };
}

const session = { user: { id: 'user-12345678', created_at: '2026-01-01T00:00:00.000Z' } };

describe('payment subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  it('rejects unauthenticated requests', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session: null }));

    const res = await POST(subscribeRequest());
    expect(res.status).toBe(401);
    expect(mockPay).not.toHaveBeenCalled();
  });

  it('blocks a user who already has an active subscription before charging', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({
      session,
      subscriptions: [{ data: { id: 'existing-sub' }, error: null }],
    }));

    const res = await POST(subscribeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ALREADY_SUBSCRIBED' });
    expect(mockPay).not.toHaveBeenCalled();
  });

  it('creates a subscription and payment record on success', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session }));
    const admin = createDb({
      subscriptions: [
        { count: 0, error: null },
        { data: { id: 'new-sub', plan: 'MONTHLY', current_period_end: '2026-07-10T00:00:00.000Z' }, error: null },
      ],
      payments: [{ error: null }],
    });
    mockCreateAdmin.mockReturnValue(admin);
    mockPay.mockResolvedValue({ payment: { paidAt: '2026-06-10T00:00:00.000Z' } });

    const res = await POST(subscribeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.subscription.id).toBe('new-sub');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('refunds and reports ALREADY_SUBSCRIBED on a concurrent unique violation, without touching the winner subscription', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session }));
    const admin = createDb({
      subscriptions: [
        { count: 0, error: null },
        { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } },
      ],
    });
    mockCreateAdmin.mockReturnValue(admin);
    mockPay.mockResolvedValue({ payment: { paidAt: '2026-06-10T00:00:00.000Z' } });

    const res = await POST(subscribeRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ALREADY_SUBSCRIBED' });
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // 과거 구독 카운트 + 실패한 insert 두 번만 — 승자 구독을 건드리는 cleanup이 없어야 한다.
    const subscriptionCalls = (admin.from as jest.Mock).mock.calls.filter(([table]) => table === 'subscriptions');
    expect(subscriptionCalls).toHaveLength(2);
  });

  it('refunds and cleans up on other DB failures after payment', async () => {
    mockCreateServer.mockResolvedValue(mockUserClient({ session }));
    const admin = createDb({
      subscriptions: [
        { count: 0, error: null },
        { data: null, error: { code: '500', message: 'insert failed' } },
        { error: null },
      ],
    });
    mockCreateAdmin.mockReturnValue(admin);
    mockPay.mockResolvedValue({ payment: { paidAt: '2026-06-10T00:00:00.000Z' } });

    const res = await POST(subscribeRequest());
    expect(res.status).toBe(500);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    const subscriptionCalls = (admin.from as jest.Mock).mock.calls.filter(([table]) => table === 'subscriptions');
    expect(subscriptionCalls).toHaveLength(3);
  });
});

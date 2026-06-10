/**
 * PortOne 웹훅 핸들러의 돈이 걸린 경로 테스트:
 * 서명 검증(누락/실패/로테이션)과 Transaction.Paid 멱등성.
 */
import { POST } from './route';

jest.mock('@portone/server-sdk', () => ({
  Webhook: { verify: jest.fn() },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/portone', () => ({
  verifyPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));

import { Webhook } from '@portone/server-sdk';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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

function createAdminDb(handlers: Record<string, QueryResult[]>) {
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

function webhookRequest(payload: unknown) {
  return new Request('http://localhost/api/payment/webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'webhook-id': 'wh-1',
      'webhook-signature': 'sig',
      'webhook-timestamp': 'ts',
    },
  });
}

const mockVerify = Webhook.verify as jest.Mock;
const mockCreateAdmin = createAdminClient as jest.Mock;

describe('payment webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.PORTONE_WEBHOOK_SECRET = 'whsec_primary';
    delete process.env.PORTONE_WEBHOOK_SECRET_SECONDARY;
    delete process.env.PORTONE_WEBHOOK_SECRETS;
  });

  it('returns 500 when no webhook secret is configured', async () => {
    delete process.env.PORTONE_WEBHOOK_SECRET;

    const res = await POST(webhookRequest({ type: 'Transaction.Paid' }));
    expect(res.status).toBe(500);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature with 401 and touches no data', async () => {
    mockVerify.mockRejectedValue(new Error('invalid signature'));

    const res = await POST(webhookRequest({ type: 'Transaction.Paid', data: { paymentId: 'p1' } }));
    expect(res.status).toBe(401);
    expect(mockCreateAdmin).not.toHaveBeenCalled();
  });

  it('accepts a payload signed with the secondary (rotated) secret', async () => {
    process.env.PORTONE_WEBHOOK_SECRET_SECONDARY = 'whsec_secondary';
    mockVerify
      .mockRejectedValueOnce(new Error('invalid signature'))
      .mockResolvedValueOnce(undefined);

    const admin = createAdminDb({ payments: [{ data: null, error: null }] });
    mockCreateAdmin.mockReturnValue(admin);

    const res = await POST(webhookRequest({ type: 'Transaction.Failed', data: { paymentId: 'p1' } }));
    expect(res.status).toBe(200);
    expect(mockVerify).toHaveBeenCalledTimes(2);
  });

  it('ignores a duplicate Transaction.Paid for an already-PAID payment (idempotent)', async () => {
    mockVerify.mockResolvedValue(undefined);

    const admin = createAdminDb({
      payments: [
        { data: { id: 'p1', status: 'PAID', type: 'SUBSCRIPTION', metadata: {} }, error: null },
      ],
    });
    mockCreateAdmin.mockReturnValue(admin);

    const res = await POST(webhookRequest({ type: 'Transaction.Paid', data: { paymentId: 'p1' } }));
    expect(res.status).toBe(200);
    // 멱등성: 조회 1회 외에 어떤 쓰기도 없어야 한다.
    expect(admin.from).toHaveBeenCalledTimes(1);
  });

  it('marks a payment FAILED on Transaction.Failed', async () => {
    mockVerify.mockResolvedValue(undefined);

    const admin = createAdminDb({ payments: [{ data: null, error: null }] });
    mockCreateAdmin.mockReturnValue(admin);

    const res = await POST(webhookRequest({
      type: 'Transaction.Failed',
      data: { paymentId: 'p1', failReason: 'card declined' },
    }));
    expect(res.status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith('payments');
  });
});

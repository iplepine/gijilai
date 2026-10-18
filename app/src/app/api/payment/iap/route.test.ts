import { POST } from './route';
import { createClient } from '@/lib/supabaseServer';
import { recordHarmonyPurchase } from '@/lib/harmonyAccess';
import {
    IapPurchaseNotCompletedError,
    syncIapSubscription,
    verifyAppleTransaction,
    verifyGoogleProductPurchase,
} from '@/lib/iap';

jest.mock('@/lib/supabaseServer', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/harmonyAccess', () => ({ recordHarmonyPurchase: jest.fn() }));
jest.mock('@/lib/iap', () => {
    const actual = jest.requireActual('@/lib/iap');
    return {
        ...actual,
        getSupabaseAdmin: jest.fn(() => ({})),
        syncIapSubscription: jest.fn(),
        verifyAppleTransaction: jest.fn(),
        verifyGoogleProductPurchase: jest.fn(),
        verifyGoogleSubscription: jest.fn(),
    };
});

const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CHILD_ID = '22222222-2222-4222-8222-222222222222';

function request(body: Record<string, unknown>) {
    return new Request('http://localhost/api/payment/iap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function harmonyBody(overrides: Record<string, unknown> = {}) {
    return {
        platform: 'APPLE_IAP',
        receiptToken: '2000000123',
        productId: 'gijilai_harmony_report',
        childId: CHILD_ID,
        ...overrides,
    };
}

describe('POST /api/payment/iap — harmony report one-time purchase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        (createClient as jest.Mock).mockResolvedValue({
            auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }) },
        });
        (recordHarmonyPurchase as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('records the purchase for the child carried in the store transaction', async () => {
        (verifyAppleTransaction as jest.Mock).mockResolvedValue({
            platform: 'APPLE_IAP',
            productId: 'gijilai_harmony_report',
            transactionId: '2000000123',
            accountToken: OTHER_CHILD_ID,
            paymentAmount: 3900,
            paymentCurrency: 'KRW',
            revoked: false,
        });

        const res = await POST(request(harmonyBody()));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true, product: 'harmony_report', childId: OTHER_CHILD_ID });
        expect(recordHarmonyPurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            userId: 'user-1',
            childId: OTHER_CHILD_ID,
            platform: 'APPLE_IAP',
            transactionId: '2000000123',
            amount: 3900,
        }));
        expect(syncIapSubscription).not.toHaveBeenCalled();
    });

    it("falls back to the app's child id and verifies Google purchases as products", async () => {
        (verifyGoogleProductPurchase as jest.Mock).mockResolvedValue({
            platform: 'GOOGLE_PLAY',
            productId: 'gijilai_harmony_report',
            transactionId: 'google-token',
            revoked: false,
        });

        const res = await POST(request(harmonyBody({ platform: 'GOOGLE_PLAY', receiptToken: 'google-token' })));

        expect(res.status).toBe(200);
        expect(verifyGoogleProductPurchase).toHaveBeenCalledWith('gijilai_harmony_report', 'google-token');
        expect(recordHarmonyPurchase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ childId: CHILD_ID }));
    });

    it('rejects purchases without a usable child id, revoked, or not completed', async () => {
        (verifyAppleTransaction as jest.Mock).mockResolvedValue({
            productId: 'gijilai_harmony_report', transactionId: 't1', revoked: false,
        });
        const missingChild = await POST(request(harmonyBody({ childId: 'nope' })));
        expect(missingChild.status).toBe(400);

        (verifyAppleTransaction as jest.Mock).mockResolvedValue({
            productId: 'gijilai_harmony_report', transactionId: 't2', revoked: true,
        });
        const revoked = await POST(request(harmonyBody()));
        expect(revoked.status).toBe(409);

        (verifyGoogleProductPurchase as jest.Mock).mockRejectedValue(new IapPurchaseNotCompletedError(2));
        const pending = await POST(request(harmonyBody({ platform: 'GOOGLE_PLAY' })));
        expect(pending.status).toBe(409);
        await expect(pending.json()).resolves.toEqual({ error: 'PURCHASE_NOT_COMPLETED' });

        expect(recordHarmonyPurchase).not.toHaveBeenCalled();
    });
});

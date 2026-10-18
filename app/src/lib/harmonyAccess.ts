import { hasActiveSubscription } from '@/lib/access';
import {
    HARMONY_REPORT_IAP_PRODUCT_ID,
    HARMONY_REPORT_PRICE,
    HARMONY_REPORT_PRODUCT,
    type HarmonyAccessResponse,
} from '@/lib/harmonyUnlock';

type AdminClient = { from: (table: string) => unknown };

type MaybeSingle<T> = { maybeSingle: () => Promise<{ data: T | null; error: unknown }> };
type FilterChain<T> = MaybeSingle<T> & {
    eq: (column: string, value: unknown) => FilterChain<T>;
    contains: (column: string, value: unknown) => FilterChain<T>;
    limit: (count: number) => FilterChain<T>;
};
type SelectTable<T> = { select: (columns: string) => FilterChain<T> };
type InsertTable = { insert: (row: Record<string, unknown>) => Promise<{ error: unknown }> };

function table<T>(admin: AdminClient, name: string) {
    return admin.from(name) as SelectTable<T>;
}

/**
 * 아이에 접근할 수 있는(owner 또는 수락한 공동양육자) 사용자 기준으로 궁합 심층 리포트 잠금 여부를 판단한다.
 * 구독(본인, 또는 공동양육자라면 owner의 구독)이나 이 아이에 대한 단품 구매(누가 샀든)가 있으면 연다.
 * 7일 체험은 열지 않는다 — 체험 중에도 결제 화면을 만나야 단품 수요를 확인할 수 있다.
 */
export async function getHarmonyAccess(
    admin: AdminClient,
    params: { userId: string; childId: string },
): Promise<HarmonyAccessResponse | null> {
    const { data: child } = await table<{ parent_id: string }>(admin, 'children')
        .select('parent_id')
        .eq('id', params.childId)
        .maybeSingle();
    if (!child) return null;

    const isOwner = child.parent_id === params.userId;
    if (!isOwner) {
        const { data: membership } = await table<{ id: string }>(admin, 'child_co_parents')
            .select('id')
            .eq('child_id', params.childId)
            .eq('co_parent_id', params.userId)
            .eq('status', 'ACCEPTED')
            .maybeSingle();
        if (!membership) return null;
    }

    const hasSubscription = await hasActiveSubscription(admin, params.userId)
        || (!isOwner && await hasActiveSubscription(admin, child.parent_id));
    if (hasSubscription) return { unlocked: true, reason: 'subscription' };

    if (await hasHarmonyPurchase(admin, params.childId)) return { unlocked: true, reason: 'purchase' };
    return { unlocked: false, reason: null };
}

export async function hasHarmonyPurchase(admin: AdminClient, childId: string): Promise<boolean> {
    const { data } = await table<{ id: string }>(admin, 'payments')
        .select('id')
        .eq('type', 'ONE_TIME')
        .eq('status', 'PAID')
        .contains('metadata', { product: HARMONY_REPORT_PRODUCT, childId })
        .limit(1)
        .maybeSingle();
    return !!data;
}

/** 스토어 거래 ID로 멱등하게 단품 결제를 기록한다. 같은 거래가 다시 전달돼도 한 번만 남는다. */
export async function recordHarmonyPurchase(
    admin: AdminClient,
    params: {
        userId: string;
        childId: string;
        platform: 'APPLE_IAP' | 'GOOGLE_PLAY';
        transactionId: string;
        amount?: number;
        currency?: string;
    },
): Promise<void> {
    const paymentId = `iap_${params.platform.toLowerCase()}_${params.transactionId}`;
    const { data: existing, error: lookupError } = await table<{ id: string }>(admin, 'payments')
        .select('id')
        .eq('portone_payment_id', paymentId)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return;

    const { error } = await (admin.from('payments') as InsertTable).insert({
        user_id: params.userId,
        type: 'ONE_TIME',
        portone_payment_id: paymentId,
        status: 'PAID',
        currency: params.currency || HARMONY_REPORT_PRICE.currency,
        amount: Math.round(params.amount ?? HARMONY_REPORT_PRICE.amount),
        pg_provider: params.platform === 'APPLE_IAP' ? 'apple' : 'google',
        pay_method: params.platform === 'APPLE_IAP' ? 'applepay' : 'googlepay',
        paid_at: new Date().toISOString(),
        metadata: {
            product: HARMONY_REPORT_PRODUCT,
            childId: params.childId,
            productId: HARMONY_REPORT_IAP_PRODUCT_ID,
            platform: params.platform,
        },
    });
    if (error) throw error;
}

/**
 * 궁합(HARMONY) 심층 리포트 단품. 앱 인앱결제 소모성 상품으로 아이별로 한 번 산다.
 * 무료: 관계 카드·핵심 차이·잘 맞는 기질. 구매 또는 구독: 양육 원칙·상황별 대화 대본·양육 스타일 점검·오늘의 한마디.
 */
export const HARMONY_REPORT_PRODUCT = 'harmony_report';
export const HARMONY_REPORT_IAP_PRODUCT_ID = 'gijilai_harmony_report';
export const HARMONY_REPORT_PRICE = { amount: 3900, currency: 'KRW' } as const;

export const HARMONY_LOCKED_FIELDS = [
    'parentingPrinciples',
    'situationalTips',
    'parentingAudit',
    'dailyReminder',
] as const;

export type HarmonyUnlockReason = 'subscription' | 'purchase';

export type HarmonyAccessResponse = {
    unlocked: boolean;
    reason: HarmonyUnlockReason | null;
};

/** 잠긴 심층 항목을 뺀 사본. 공개 공유 응답처럼 서버에서 내보내기 전에 쓴다. */
export function stripLockedHarmonyFields<T extends object>(analysis: T): T {
    const copy = { ...analysis } as Record<string, unknown>;
    for (const field of HARMONY_LOCKED_FIELDS) delete copy[field];
    return copy as T;
}

export function hasLockedHarmonyContent(analysis: object | null | undefined): boolean {
    if (!analysis) return false;
    const record = analysis as Record<string, unknown>;
    return HARMONY_LOCKED_FIELDS.some((field) => record[field] !== undefined && record[field] !== null);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

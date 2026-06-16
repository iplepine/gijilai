'use client';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

function isAnalyticsReady() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && !!measurementId;
}

function normalizeParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );
}

export function isAnalyticsEnabled() {
  return !!measurementId;
}

/**
 * 모든 이벤트에 자동으로 병합되는 공통 컨텍스트 (platform, auth_state 등).
 * FirebaseAnalytics가 setAnalyticsContext로 주입한다. 이게 있어야 GA 탐색에서
 * 웹/앱·게스트/회원으로 funnel을 세그먼트할 수 있다 (call site마다 안 붙여도 됨).
 */
let ambientContext: AnalyticsParams = {};

export function setAnalyticsContext(context: AnalyticsParams) {
  ambientContext = { ...ambientContext, ...context };
}

function emit(eventName: string, params: AnalyticsParams = {}) {
  if (!isAnalyticsReady()) return;
  // 명시 파라미터가 공통 컨텍스트를 덮어쓴다.
  window.gtag!('event', eventName, normalizeParams({ ...ambientContext, ...params }));
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  emit(eventName, params);
}

export function trackPageView(path: string) {
  emit('page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
  });
}

/**
 * GA4 표준 매출 이벤트. 커스텀 'payment_completed' funnel 이벤트와 별개로,
 * GA "총수익"을 채우려면 value/currency를 가진 표준 'purchase' 이벤트가 필요하다
 * — 커스텀 이벤트의 금액 파라미터(final_amount)는 GA 매출로 집계되지 않는다.
 * value는 주 통화 단위(예: USD는 달러, 센트 아님)로 넘긴다.
 */
export function trackPurchase(params: {
  value: number;
  currency?: string;
  transactionId?: string;
  [key: string]: AnalyticsValue;
}) {
  const { value, currency = 'KRW', transactionId, ...rest } = params;
  emit('purchase', { ...rest, value, currency, transaction_id: transactionId });
}

export function setAnalyticsUser(userId: string | null) {
  if (!isAnalyticsReady()) return;

  window.gtag!('config', measurementId!, {
    user_id: userId ?? undefined,
  });
}

/**
 * GA4 user properties (코호트 분석용 — 북극성 지표 클러스터 A1)
 * - plan: 현재 구독 플랜 ('FREE' | 'MONTHLY' | 'YEARLY' 등)
 * - first_paid_at: 첫 결제 일자 (YYYY-MM-DD) — 코호트 슬라이싱
 * - child_count: 등록 자녀 수
 * - signup_cohort: 가입 월 (YYYY-MM) — 코호트 슬라이싱
 */
export type AnalyticsUserProperties = {
  plan?: 'FREE' | 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'FAMILY_MONTHLY' | 'FAMILY_YEARLY' | null;
  first_paid_at?: string | null;
  child_count?: number;
  signup_cohort?: string | null;
};

export function setAnalyticsUserProperties(properties: AnalyticsUserProperties) {
  if (!isAnalyticsReady()) return;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    sanitized[key] = value;
  }
  if (Object.keys(sanitized).length === 0) return;

  window.gtag!('set', 'user_properties', sanitized);
}

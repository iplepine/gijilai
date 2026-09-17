'use client';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __gijilaiAnalyticsMeasurementId?: string;
  }
}

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

// Keep route identifiers and arbitrary URL text out of Analytics. New public
// routes should be added here together with their bounded attribution values.
const PUBLIC_AND_APP_PATHS = new Set([
  '/', '/preview', '/login', '/intake', '/survey', '/survey/intro',
  '/survey/child', '/survey/parent', '/survey/parenting-style', '/report',
  '/consult', '/consult/self', '/consult/self/records', '/consultations',
  '/practices', '/observations', '/notifications', '/translate', '/share',
  '/pricing', '/pricing/complete', '/payment', '/payment/success', '/install-app',
  '/settings/profile', '/settings/profile/edit', '/settings/child/new',
  '/settings/notifications', '/settings/subscription', '/auth/auth-code-error',
  '/legal/about', '/legal/privacy', '/legal/terms', '/legal/refund', '/legal/support',
]);

const SAFE_QUERY_VALUES: Record<string, readonly string[]> = {
  source: ['landing', 'home', 'report', 'consult', 'practices', 'subscription_settings',
    'pricing_complete', 'payment', 'legacy_payment', 'direct', 'home_sos', 'followup',
    'shared', 'share', 'preview'],
  flow: ['quick', 'full'],
  tab: ['child', 'parent', 'harmony'],
  report_tab: ['child', 'parent', 'harmony'],
  report_kind: ['child', 'parent', 'harmony'],
  child_only: ['true', 'false'],
  scenario: ['transition', 'separation', 'tantrum'],
  utm_source: ['google', 'naver', 'kakao', 'instagram', 'facebook', 'youtube', 'newsletter'],
  utm_medium: ['organic', 'social', 'referral', 'email', 'cpc', 'paid_social', 'share'],
};

export function sanitizeAnalyticsPath(value: string) {
  let url: URL;
  try {
    url = new URL(value, 'https://gijilai.com');
  } catch {
    return '/other';
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  let path = PUBLIC_AND_APP_PATHS.has(pathname) ? pathname : '/other';
  if (/^\/shared\/[^/]+$/.test(pathname)) path = '/shared/[token]';
  if (/^\/invite\/[^/]+$/.test(pathname)) path = '/invite/[token]';
  if (/^\/consultations\/[^/]+$/.test(pathname)) path = '/consultations/[id]';
  if (/^\/settings\/child\/[^/]+$/.test(pathname) && pathname !== '/settings/child/new') {
    path = '/settings/child/[id]';
  }

  const query = new URLSearchParams();
  for (const [key, allowedValues] of Object.entries(SAFE_QUERY_VALUES)) {
    const value = url.searchParams.get(key);
    if (value && allowedValues.includes(value)) query.set(key, value);
  }
  return query.size ? `${path}?${query.toString()}` : path;
}

function getPageParams(path = window.location.href) {
  const pagePath = sanitizeAnalyticsPath(path);
  let referrer = '';
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      // Referrer paths and queries can contain another site's personal data.
      referrer = new URL(document.referrer).origin;
    } catch { /* Invalid referrers are omitted. */ }
  }
  return {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    // Shared report metadata may contain a child's name, so don't use document.title.
    page_title: '기질아이',
    page_referrer: referrer,
  };
}

function getAnalyticsTag() {
  if (typeof window === 'undefined' || !measurementId) return null;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    // Google's command queue works before the remote gtag script has loaded.
    window.gtag = function () {
      // gtag consumes the arguments object, not a nested array of commands.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
  const tag = window.gtag;
  if (window.__gijilaiAnalyticsMeasurementId !== measurementId) {
    window.__gijilaiAnalyticsMeasurementId = measurementId;
    tag('js', new Date());
    // Global page defaults remain updateable by set after client-side navigation;
    // putting them in config would take precedence over later set commands.
    tag('set', getPageParams());
    tag('config', measurementId, { send_page_view: false });
  }
  return tag;
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
  const tag = getAnalyticsTag();
  if (!tag) return;
  // 명시 파라미터가 공통 컨텍스트를 덮어쓴다.
  tag('event', eventName, normalizeParams({ ...ambientContext, ...params, ...getPageParams() }));
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  emit(eventName, params);
}

export function trackPageView(path: string) {
  const tag = getAnalyticsTag();
  if (!tag) return;
  const pageParams = getPageParams(path);
  // Keep automatic tag events on the same sanitized page context after navigation.
  tag('set', pageParams);
  tag('event', 'page_view', normalizeParams({ ...ambientContext, ...pageParams }));
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
  const tag = getAnalyticsTag();
  if (!tag) return;
  // Re-running config can emit an implicit page_view. null explicitly clears logout.
  tag('set', { user_id: userId });
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
  const tag = getAnalyticsTag();
  if (!tag) return;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    sanitized[key] = value;
  }
  if (Object.keys(sanitized).length === 0) return;

  tag('set', 'user_properties', sanitized);
}

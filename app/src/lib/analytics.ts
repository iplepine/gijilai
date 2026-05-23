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

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!isAnalyticsReady()) return;

  window.gtag!('event', eventName, normalizeParams(params));
}

export function trackPageView(path: string) {
  if (!isAnalyticsReady()) return;

  window.gtag!('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
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

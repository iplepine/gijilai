'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  isAnalyticsEnabled,
  setAnalyticsContext,
  setAnalyticsUser,
  setAnalyticsUserProperties,
  trackPageView,
  type AnalyticsUserProperties,
} from '@/lib/analytics';
import { getRuntimeAppInfo } from '@/lib/appInfo';

function FirebaseAnalyticsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // platform(web/ios/android)을 공통 컨텍스트로 1회 주입 — 모든 이벤트의 웹/앱 세그먼트 기준.
  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    setAnalyticsContext({ platform: getRuntimeAppInfo().platform });
  }, []);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;

    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    // auth_state를 공통 컨텍스트로 — 게스트/회원 funnel 세그먼트 기준.
    setAnalyticsContext({ auth_state: user?.id ? 'authed' : 'guest' });
    setAnalyticsUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/cohort');
        if (!res.ok) return;
        const data = (await res.json()) as AnalyticsUserProperties;
        if (cancelled) return;
        setAnalyticsUserProperties(data);
      } catch {
        // 분석은 보조 신호이므로 실패는 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}

export function FirebaseAnalytics() {
  return (
    <Suspense fallback={null}>
      <FirebaseAnalyticsContent />
    </Suspense>
  );
}

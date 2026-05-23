'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  isAnalyticsEnabled,
  setAnalyticsUser,
  setAnalyticsUserProperties,
  trackPageView,
  type AnalyticsUserProperties,
} from '@/lib/analytics';

function FirebaseAnalyticsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;

    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    trackPageView(path);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
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

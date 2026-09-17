'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  isAnalyticsEnabled,
  sanitizeAnalyticsPath,
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
  const lastTrackedPath = useRef<string | null>(null);

  // Set both dimensions before the page-view effect, including the first visit.
  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    setAnalyticsContext({
      platform: getRuntimeAppInfo().platform,
      auth_state: user?.id ? 'authed' : 'guest',
    });
    setAnalyticsUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;

    const query = searchParams.toString();
    const path = sanitizeAnalyticsPath(query ? `${pathname}?${query}` : pathname);
    if (lastTrackedPath.current === path) return;
    lastTrackedPath.current = path;
    trackPageView(path);
  }, [pathname, searchParams]);

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

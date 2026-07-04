'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage from '@/components/landing/LandingPage';
import { HomeLoadingScreen } from '@/components/home/HomeLoadingScreen';
import { isAppWebView } from '@/lib/practiceReminder';

const noopSubscribe = () => () => {};

/**
 * 미인증 사용자용 홈. 서버에서 세션이 없을 때 렌더된다.
 *
 * - 웹 크롤러/방문자: 랜딩을 그대로 렌더 → 랜딩 콘텐츠가 초기 SSR HTML에 포함된다
 *   (네이버/Bing 등 JS 미실행 크롤러 대응).
 * - 앱 WebView: 소개 화면 대신 로그인으로 보낸다(기존 정책 유지).
 *
 * WebView 여부는 `useSyncExternalStore`의 서버 스냅샷을 false로 둬서
 * SSR 출력은 언제나 랜딩(= 크롤러가 본문을 본다)이고, 클라이언트에서만 판별해
 * hydration 불일치 없이 앱에서는 랜딩 노출 없이 로그인으로 전환한다.
 */
export function UnauthedHome() {
  const router = useRouter();
  const appWebView = useSyncExternalStore(
    noopSubscribe,
    () => isAppWebView(),
    () => false,
  );

  useEffect(() => {
    if (appWebView) {
      router.replace('/login');
    }
  }, [appWebView, router]);

  if (appWebView) {
    return <HomeLoadingScreen />;
  }

  return <LandingPage />;
}

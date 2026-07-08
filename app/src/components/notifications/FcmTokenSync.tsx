'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

type FcmTokenDetail = { token?: string; platform?: string };

declare global {
    interface Window {
        __gijilaiFcmToken?: FcmTokenDetail;
    }
}

// 네이티브 앱(WebView)이 획득한 FCM 토큰을 로그인 세션 사용자에 매핑해 등록한다.
// 네이티브엔 user id가 없고 인증이 WebView 세션에만 있으므로, 토큰 저장은 세션을 가진 웹이 맡는다.
//
// 계약(네이티브 → 웹):
//   window.__gijilaiFcmToken = { token, platform }   (늦게 로드된 웹도 읽을 수 있게 상태로 보관)
//   window.dispatchEvent(new CustomEvent('gijilai:fcmToken', { detail: { token, platform } }))
export function FcmTokenSync() {
    const { user } = useAuth();
    const lastRegistered = useRef<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const register = (detail?: FcmTokenDetail) => {
            const token = detail?.token?.trim();
            const platform = (detail?.platform || 'android').toLowerCase();
            if (!token || lastRegistered.current === token) return;
            lastRegistered.current = token;
            fetch('/api/notifications/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, platform }),
            }).catch(() => {
                lastRegistered.current = null; // 실패 시 다음 이벤트에서 재시도 허용
            });
        };

        // 네이티브가 이미 주입해둔 토큰이 있으면 즉시 등록
        if (typeof window !== 'undefined' && window.__gijilaiFcmToken) {
            register(window.__gijilaiFcmToken);
        }

        const onToken = (e: Event) => register((e as CustomEvent<FcmTokenDetail>).detail);
        window.addEventListener('gijilai:fcmToken', onToken as EventListener);
        return () => window.removeEventListener('gijilai:fcmToken', onToken as EventListener);
    }, [user]);

    return null;
}

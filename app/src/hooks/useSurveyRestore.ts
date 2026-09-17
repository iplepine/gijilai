'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { db } from '@/lib/db';
import { isSurveyRestoreExcludedPath, resolveSurveyResponses } from '@/lib/surveyEntry';

/**
 * 인증 사용자와 선택 아이별로 DB 응답을 복원한다.
 * 설문/접수/리포트 화면은 자체 복원과 저장을 처리하므로 전역 복원을 하지 않는다.
 */
export function useSurveyRestore() {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const restoreSurveyFromDB = useAppStore((s) => s.restoreSurveyFromDB);
    const selectedChildId = useAppStore((s) => s.selectedChildId);
    const restoredScope = useRef<string | null>(null);

    useEffect(() => {
        if (!user) {
            restoredScope.current = null;
            return;
        }
        if (loading || isSurveyRestoreExcludedPath(pathname)) return;
        const scope = `${user.id}:${selectedChildId ?? ''}`;
        if (restoredScope.current === scope) return;
        restoredScope.current = scope;
        let cancelled = false;
        let completed = false;

        (async () => {
            try {
                const surveys = await db.getSurveys(user.id);
                if (cancelled || useAppStore.getState().selectedChildId !== selectedChildId) return;
                restoreSurveyFromDB(resolveSurveyResponses(surveys, user.id, selectedChildId));
                completed = true;
            } catch {
                if (!cancelled && restoredScope.current === scope) restoredScope.current = null;
            }
        })();
        return () => {
            cancelled = true;
            if (!completed && restoredScope.current === scope) restoredScope.current = null;
        };
    }, [user, loading, pathname, selectedChildId, restoreSurveyFromDB]);
}

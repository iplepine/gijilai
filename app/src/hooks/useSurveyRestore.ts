'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { db } from '@/lib/db';

/**
 * 로그인 시 Supabase에서 설문 응답을 불러와 스토어에 복원하는 훅.
 * - 로컬에 데이터가 이미 있으면 더 많은 쪽을 채택
 * - 한 번만 실행
 */
export function useSurveyRestore() {
    const { user, loading } = useAuth();
    const restoreSurveyFromDB = useAppStore((s) => s.restoreSurveyFromDB);
    const cbqResponses = useAppStore((s) => s.cbqResponses);
    const atqResponses = useAppStore((s) => s.atqResponses);
    const parentingResponses = useAppStore((s) => s.parentingResponses);
    const restoredRef = useRef(false);

    useEffect(() => {
        if (loading || !user || restoredRef.current) return;
        restoredRef.current = true;

        (async () => {
            try {
                const latest = await db.getLatestSurveyResponses(user.id);

                const restore: {
                    cbqResponses?: Record<string, number>;
                    atqResponses?: Record<string, number>;
                    parentingResponses?: Record<string, number>;
                } = {};

                // CHILD
                const dbChild = latest['CHILD'];
                if (dbChild?.answers) {
                    const dbAnswers = dbChild.answers as Record<string, number>;
                    if (Object.keys(dbAnswers).length > Object.keys(cbqResponses).length) {
                        restore.cbqResponses = dbAnswers;
                    }
                }

                // PARENT
                const dbParent = latest['PARENT'];
                if (dbParent?.answers) {
                    const dbAnswers = dbParent.answers as Record<string, number>;
                    if (Object.keys(dbAnswers).length > Object.keys(atqResponses).length) {
                        restore.atqResponses = dbAnswers;
                    }
                }

                // PARENTING_STYLE
                const dbParenting = latest['PARENTING_STYLE'];
                if (dbParenting?.answers) {
                    const dbAnswers = dbParenting.answers as Record<string, number>;
                    if (Object.keys(dbAnswers).length > Object.keys(parentingResponses).length) {
                        restore.parentingResponses = dbAnswers;
                    }
                }

                if (Object.keys(restore).length > 0) {
                    restoreSurveyFromDB(restore);
                }
            } catch (e) {
                console.warn('Survey restore failed:', e);
            }
        })();
    }, [user, loading, restoreSurveyFromDB, cbqResponses, atqResponses, parentingResponses]);
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { db } from '@/lib/db';
import { PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';
import { getChildAssessmentResult } from '@/lib/childAssessmentResult';

/**
 * 설문 응답을 Supabase에 자동 동기화하는 훅.
 * - 응답 변경 시 2초 debounce로 서버에 저장
 * - 비로그인 시 건너뜀 (localStorage만 사용)
 */
export function useSurveySync(options: { childAssessmentMode?: 'phased' | 'legacy' } = {}) {
    const { childAssessmentMode } = options;
    const { user } = useAuth();
    const cbqResponses = useAppStore((s) => s.cbqResponses);
    const atqResponses = useAppStore((s) => s.atqResponses);
    const parentingResponses = useAppStore((s) => s.parentingResponses);
    const selectedChildId = useAppStore((s) => s.selectedChildId);
    const birthDate = useAppStore((s) => s.intake.birthDate);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevRef = useRef<string>('');
    const latestSyncRef = useRef<() => Promise<void>>(async () => undefined);

    const syncToServer = useCallback(async () => {
        if (!user) return;

        const saves: Promise<void>[] = [];

        if (Object.keys(cbqResponses).length > 0) {
            saves.push(
                db.saveSurveyResponses(user.id, 'CHILD', cbqResponses,
                    getChildAssessmentResult(cbqResponses, { mode: childAssessmentMode, birthDate }).status,
                    selectedChildId)
            );
        }
        if (Object.keys(atqResponses).length > 0) {
            saves.push(
                db.saveSurveyResponses(user.id, 'PARENT', atqResponses,
                    Object.keys(atqResponses).length >= PARENT_QUESTIONS.length ? 'COMPLETED' : 'IN_PROGRESS')
            );
        }
        if (Object.keys(parentingResponses).length > 0) {
            saves.push(
                db.saveSurveyResponses(user.id, 'PARENTING_STYLE', parentingResponses,
                    Object.keys(parentingResponses).length >= PARENTING_STYLE_QUESTIONS.length ? 'COMPLETED' : 'IN_PROGRESS',
                    selectedChildId)
            );
        }

        try {
            await Promise.all(saves);
        } catch (e) {
            console.warn('Survey sync failed (will retry on next change):', e);
        }
    }, [user, cbqResponses, atqResponses, parentingResponses, selectedChildId, childAssessmentMode, birthDate]);

    useEffect(() => {
        latestSyncRef.current = syncToServer;
    }, [syncToServer]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                void latestSyncRef.current();
            }
        };
    }, []);

    useEffect(() => {
        if (!user) return;

        const fingerprint = JSON.stringify({
            childId: selectedChildId,
            childAssessmentMode,
            c: sortResponses(cbqResponses),
            a: sortResponses(atqResponses),
            p: sortResponses(parentingResponses),
        });

        if (fingerprint === prevRef.current) return;
        prevRef.current = fingerprint;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void latestSyncRef.current();
        }, 2000);
    }, [user, cbqResponses, atqResponses, parentingResponses, selectedChildId, childAssessmentMode]);
}

function sortResponses(responses: Record<string, number>) {
    return Object.fromEntries(
        Object.entries(responses).sort(([a], [b]) => a.localeCompare(b))
    );
}

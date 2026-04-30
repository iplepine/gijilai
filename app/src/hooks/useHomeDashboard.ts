'use client';

import { useEffect, useState } from 'react';
import { db, UserProfile, ChildProfile, ReportData, SurveyData, PracticeItemData, PracticeLogData, SubscriptionData } from '@/lib/db';
import { createPerfTracker } from '@/lib/perf';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { extractMagicWord, type HomeMagicWord } from '@/lib/home';

type ConsultationPreviewRow = Pick<
    Database['public']['Tables']['consultations']['Row'],
    'id' | 'ai_prescription' | 'created_at' | 'child_id'
>;

type DashboardPractices = {
    activeCount: number;
    uncheckedCount: number;
    uncheckedItems: PracticeItemData[];
};

type HomeDashboardState = {
    profile: UserProfile | null;
    children: ChildProfile[];
    reports: ReportData[];
    surveys: SurveyData[];
    practices: DashboardPractices;
    showConsultCTA: boolean;
    allMagicWords: HomeMagicWord[];
    subscription: SubscriptionData | null;
    loading: boolean;
};

const INITIAL_PRACTICES: DashboardPractices = { activeCount: 0, uncheckedCount: 0, uncheckedItems: [] };

const INITIAL_STATE: HomeDashboardState = {
    profile: null,
    children: [],
    reports: [],
    surveys: [],
    practices: INITIAL_PRACTICES,
    showConsultCTA: false,
    allMagicWords: [],
    subscription: null,
    loading: true,
};

export function useHomeDashboard(params: { userId?: string; authLoading: boolean }) {
    const { userId, authLoading } = params;
    const [state, setState] = useState<HomeDashboardState>(INITIAL_STATE);

    useEffect(() => {
        let isActive = true;

        async function fetchDashboardData(currentUserId: string) {
            const perf = createPerfTracker('HomeDashboard', { userId: currentUserId });

            try {
                setState((previous) => ({ ...previous, loading: true }));

                const [data, activePractices, todayLogs, subscription] = await Promise.all([
                    db.getDashboardData(currentUserId),
                    db.getActivePracticeItems(currentUserId).catch(() => [] as PracticeItemData[]),
                    db.getTodayPracticeLogs(currentUserId).catch(() => [] as PracticeLogData[]),
                    db.getActiveSubscription(currentUserId).catch(() => null),
                ]);
                perf.mark('initial_queries', {
                    children: data.children.length,
                    reports: data.reports.length,
                    surveys: data.surveys.length,
                    activePractices: activePractices.length,
                    todayLogs: todayLogs.length,
                    hasSubscription: !!subscription,
                });

                const checkedPracticeIds = new Set(todayLogs.map((log) => log.practice_id));
                const uncheckedItems = activePractices.filter((practice) => !checkedPracticeIds.has(practice.id));
                const hasActivePractices = activePractices.length > 0;

                let showConsultCTA = false;
                if (!hasActivePractices) {
                    const { count } = await supabase
                        .from('consultation_sessions')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', currentUserId);
                    showConsultCTA = !count || count === 0;
                }
                perf.mark('consult_cta_check', { showConsultCTA });

                let allMagicWords: HomeMagicWord[] = [];
                const activeConsultationIds = [...new Set(activePractices.map((practice) => practice.consultation_id))];
                if (activeConsultationIds.length > 0) {
                    const { data: activeConsults } = await supabase
                        .from('consultations')
                        .select('id, ai_prescription, created_at, child_id')
                        .in('id', activeConsultationIds)
                        .eq('status', 'COMPLETED');

                    const childNameMap = new Map(data.children.map((child) => [child.id, child.name]));
                    allMagicWords = ((activeConsults ?? []) as ConsultationPreviewRow[]).flatMap((consultation) => {
                        const magicWord = extractMagicWord(consultation.ai_prescription);
                        if (!magicWord) return [];

                        return [{
                            word: magicWord,
                            date: consultation.created_at,
                            childId: consultation.child_id ?? undefined,
                            childName: consultation.child_id ? childNameMap.get(consultation.child_id) : undefined,
                        }];
                    });
                }
                perf.mark('magic_words_query', { magicWords: allMagicWords.length });

                if (!isActive) return;
                setState({
                    profile: data.profile,
                    children: data.children,
                    reports: data.reports,
                    surveys: data.surveys,
                    practices: {
                        activeCount: activePractices.length,
                        uncheckedCount: uncheckedItems.length,
                        uncheckedItems,
                    },
                    showConsultCTA,
                    allMagicWords,
                    subscription,
                    loading: false,
                });
                perf.mark('state_committed');
            } catch (error) {
                perf.fail(error);
                console.error('Failed to fetch dashboard data:', error);
                if (!isActive) return;
                setState((previous) => ({ ...previous, loading: false }));
            }
        }

        if (authLoading) return;
        if (userId) {
            void fetchDashboardData(userId);
        }

        return () => {
            isActive = false;
        };
    }, [authLoading, userId]);

    if (!userId) {
        return { ...INITIAL_STATE, loading: false };
    }

    return state;
}

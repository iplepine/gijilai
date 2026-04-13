'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';
import { db, ChildProfile, PracticeItemData, PracticeLogData, SessionData } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { PracticeCheckModal } from '@/components/practices/PracticeCheckModal';
import { PracticeReviewModal } from '@/components/practices/PracticeReviewModal';
import { useLocale } from '@/i18n/LocaleProvider';
import { getFeatureAccess } from '@/lib/access';

interface PracticeWithSession extends PracticeItemData {
    consultation_sessions: SessionData;
}

interface GroupedPractices {
    session: SessionData;
    practices: PracticeItemData[];
}

export default function PracticesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLocale();
    const [practices, setPractices] = useState<PracticeWithSession[]>([]);
    const [allLogs, setAllLogs] = useState<PracticeLogData[]>([]);
    const [todayLogs, setTodayLogs] = useState<PracticeLogData[]>([]);
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | 'ALL'>('ALL');
    const [isLoading, setIsLoading] = useState(true);
    const [hasFullAccess, setHasFullAccess] = useState(false);

    // 모달 상태
    const [checkModal, setCheckModal] = useState<{ practice: PracticeItemData; existingLog?: PracticeLogData; recentFailCount?: number; sessionId?: string } | null>(null);
    const [reviewModal, setReviewModal] = useState<{ practice: PracticeItemData; doneDays: number; sessionId?: string } | null>(null);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [childrenData, practicesData, todayLogsData, subscription] = await Promise.all([
                db.getChildren(user.id),
                db.getActivePracticeItems(user.id),
                db.getTodayPracticeLogs(user.id),
                db.getActiveSubscription(user.id).catch(() => null),
            ]);
            const access = getFeatureAccess({ userCreatedAt: user.created_at, hasSubscription: !!subscription });
            setHasFullAccess(access.hasFullAccess);
            setChildren(childrenData);
            const sortedPractices = [...(practicesData as PracticeWithSession[])].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            const visiblePractices = access.visiblePracticeCount
                ? sortedPractices.slice(0, access.visiblePracticeCount)
                : sortedPractices;
            setPractices(visiblePractices);
            setTodayLogs(todayLogsData);

            // 각 practice의 전체 로그 가져오기
            const practiceIds = practicesData.map(p => p.id);
            if (practiceIds.length > 0) {
                const { data: logsData } = await supabase
                    .from('practice_logs')
                    .select('*')
                    .in('practice_id', practiceIds)
                    .eq('done', true);
                setAllLogs((logsData || []) as PracticeLogData[]);
            }
        } catch (e) {
            console.error('Failed to fetch practices:', e);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading) {
            if (user) {
                void fetchData();
            } else {
                setIsLoading(false);
            }
        }
    }, [authLoading, fetchData, user]);

    const today = new Date().toISOString().split('T')[0];

    const filteredPractices = useMemo(() => (
        selectedChildId === 'ALL'
            ? practices
            : practices.filter((practice) => practice.consultation_sessions?.child_id === selectedChildId)
    ), [practices, selectedChildId]);

    const grouped = useMemo(() => {
        const groupedMap = new Map<string, GroupedPractices>();

        for (const practice of filteredPractices) {
            const session = practice.consultation_sessions;
            if (!session) continue;

            const existing = groupedMap.get(session.id);
            if (existing) {
                existing.practices.push(practice);
                continue;
            }

            groupedMap.set(session.id, {
                session,
                practices: [practice],
            });
        }

        return [...groupedMap.values()].sort((a, b) => {
            const aHasUnchecked = a.practices.some((practice) => !todayLogs.find((log) => log.practice_id === practice.id));
            const bHasUnchecked = b.practices.some((practice) => !todayLogs.find((log) => log.practice_id === practice.id));
            if (aHasUnchecked && !bHasUnchecked) return -1;
            if (!aHasUnchecked && bHasUnchecked) return 1;
            return 0;
        });
    }, [filteredPractices, todayLogs]);

    const getTodayLog = (practiceId: string) => todayLogs.find(l => l.practice_id === practiceId);

    const getDoneDays = (practiceId: string) => allLogs.filter(l => l.practice_id === practiceId && l.done).length;
    const getRecentFailCount = (practiceId: string) => {
        const logs = allLogs.filter(l => l.practice_id === practiceId).sort((a, b) => b.date.localeCompare(a.date));
        let count = 0;
        for (const log of logs) {
            if (!log.done) count++;
            else break;
        }
        return count;
    };

    const handleCheckSave = useCallback(async (done: boolean, memo: string | null) => {
        if (!user || !checkModal) return;
        await db.createPracticeLog({
            practice_id: checkModal.practice.id,
            user_id: user.id,
            date: today,
            done,
            memo,
        });
        await fetchData();
    }, [checkModal, fetchData, today, user]);

    const handleReviewSave = useCallback(async (content: string) => {
        if (!user || !reviewModal) return;
        await db.createPracticeReview({
            practice_id: reviewModal.practice.id,
            user_id: user.id,
            content,
        });
        await db.updatePracticeItem(reviewModal.practice.id, { status: 'COMPLETED' });
        await fetchData();
    }, [fetchData, reviewModal, user]);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={t('nav.practices')} />

                <main className="flex-1 overflow-y-auto px-6 py-6 pb-36 space-y-6">
                    {/* 아이별 필터 */}
                    {children.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedChildId('ALL')}
                                className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                                    selectedChildId === 'ALL'
                                        ? 'bg-primary text-white shadow-sm'
                                        : 'bg-white dark:bg-surface-dark text-text-sub border border-primary/10'
                                }`}
                            >
                                {t('common.all')}
                            </button>
                            {children.map(child => (
                                <button
                                    key={child.id}
                                    onClick={() => setSelectedChildId(child.id)}
                                    className={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-all ${
                                        selectedChildId === child.id
                                            ? 'bg-primary text-white shadow-sm'
                                            : 'bg-white dark:bg-surface-dark text-text-sub border border-primary/10'
                                    }`}
                                >
                                    {child.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {!isLoading && !hasFullAccess && practices.length > 0 && (
                        <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[12px] font-bold text-text-main dark:text-white">{t('practices.lockedTitle')}</p>
                                <p className="text-[11px] text-text-sub dark:text-gray-400">{t('practices.lockedDesc')}</p>
                            </div>
                            <Button variant="primary" size="sm" onClick={() => router.push('/pricing')} className="shrink-0 rounded-xl px-4">
                                {t('consult.subscribeCta')}
                            </Button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium text-text-sub">{t('practices.loadingRecords')}</p>
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-5xl text-primary/40">self_improvement</span>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-text-main dark:text-white text-lg">{t('practices.noPractices')}</p>
                                <p className="text-text-sub text-sm leading-relaxed break-keep px-6">
                                    {t('practices.noPracticesDesc')}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/consult')}
                                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-[15px] shadow-xl shadow-primary/20 flex items-center gap-2 active:scale-[0.98] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                                {t('practices.startConsult')}
                            </button>
                        </div>
                    ) : (
                        grouped.map(({ session, practices: sessionPractices }, gi) => (
                            <div key={`${session.id}-${gi}`} className="space-y-3">
                                {/* 세션 헤더 */}
                                <button
                                    onClick={() => router.push(`/consultations/${session.id}`)}
                                    className="flex items-center gap-2 group"
                                >
                                    <div className="w-1 h-4 bg-secondary rounded-full" />
                                    <h3 className="text-[14px] font-bold text-text-main dark:text-white group-hover:text-secondary transition-colors">{session.title}</h3>
                                    <span className="material-symbols-outlined text-[14px] text-text-sub/50">chevron_right</span>
                                </button>

                                {/* 실천 카드들 */}
                                {[...sessionPractices].sort((a, b) => {
                                    const aLog = getTodayLog(a.id);
                                    const bLog = getTodayLog(b.id);
                                    const aOrder = !aLog ? 0 : aLog.done ? 2 : 1;
                                    const bOrder = !bLog ? 0 : bLog.done ? 2 : 1;
                                    return aOrder - bOrder;
                                }).map(practice => {
                                    const todayLog = getTodayLog(practice.id);
                                    const doneDays = getDoneDays(practice.id);
                                    const overdue = doneDays >= practice.duration;
                                    const progress = Math.min(doneDays / practice.duration, 1);

                                    return (
                                        <div key={practice.id} className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-primary/10 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-[14px] font-bold text-text-main dark:text-white">{practice.title}</p>
                                                    <p className="text-[12px] text-text-sub mt-1 leading-relaxed">{practice.description}</p>
                                                </div>
                                            </div>

                                            {/* 진행률 */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all"
                                                        style={{ width: `${Math.round(progress * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-bold text-primary">
                                                    {doneDays}/{practice.duration}{t('common.days')}
                                                </span>
                                            </div>

                                            {/* 응원 메시지 */}
                                            {practice.encouragement && (
                                                <p className="text-[11px] text-secondary font-medium">{practice.encouragement}</p>
                                            )}

                                            {/* 오늘 체크 / 회고 버튼 */}
                                            {overdue ? (
                                                <button
                                                    onClick={() => setReviewModal({ practice, doneDays, sessionId: practice.session_id })}
                                                    className="w-full py-3 rounded-xl bg-secondary/10 text-secondary font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">rate_review</span>
                                                    {t('practices.periodComplete')}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setCheckModal({ practice, existingLog: todayLog, recentFailCount: getRecentFailCount(practice.id), sessionId: practice.session_id })}
                                                    className={`w-full py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                                                        todayLog
                                                            ? todayLog.done
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'bg-orange-50 text-orange-600'
                                                            : 'bg-primary text-white shadow-sm shadow-primary/20'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {todayLog ? (todayLog.done ? 'check_circle' : 'schedule') : 'edit_note'}
                                                    </span>
                                                    {todayLog
                                                        ? todayLog.done ? t('practices.doneToday') : t('practices.failedToday')
                                                        : t('practices.recordToday')
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </main>

                <BottomNav />
            </div>

            {/* 체크 모달 */}
            {checkModal && (
                <PracticeCheckModal
                    practiceTitle={checkModal.practice.title}
                    existingDone={checkModal.existingLog?.done}
                    existingMemo={checkModal.existingLog?.memo}
                    recentFailCount={checkModal.recentFailCount}
                    sessionId={checkModal.sessionId}
                    onSave={handleCheckSave}
                    onClose={() => setCheckModal(null)}
                />
            )}

            {/* 회고 모달 */}
            {reviewModal && (
                <PracticeReviewModal
                    practiceTitle={reviewModal.practice.title}
                    doneDays={reviewModal.doneDays}
                    totalDays={reviewModal.practice.duration}
                    sessionId={reviewModal.sessionId}
                    onSave={handleReviewSave}
                    onClose={() => setReviewModal(null)}
                />
            )}
        </div>
    );
}

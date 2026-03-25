'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';
import { db, PracticeItemData, PracticeLogData, SessionData } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { PracticeCheckModal } from '@/components/practices/PracticeCheckModal';
import { PracticeReviewModal } from '@/components/practices/PracticeReviewModal';

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
    const [practices, setPractices] = useState<PracticeWithSession[]>([]);
    const [allLogs, setAllLogs] = useState<PracticeLogData[]>([]);
    const [todayLogs, setTodayLogs] = useState<PracticeLogData[]>([]);
    const [children, setChildren] = useState<any[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | 'ALL'>('ALL');
    const [isLoading, setIsLoading] = useState(true);

    // 모달 상태
    const [checkModal, setCheckModal] = useState<{ practice: PracticeItemData; existingLog?: PracticeLogData } | null>(null);
    const [reviewModal, setReviewModal] = useState<{ practice: PracticeItemData; doneDays: number } | null>(null);

    useEffect(() => {
        if (!authLoading) {
            if (user) fetchData();
            else setIsLoading(false);
        }
    }, [user, authLoading]);

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [childrenData, practicesData, todayLogsData] = await Promise.all([
                db.getChildren(user.id),
                db.getActivePracticeItems(user.id),
                db.getTodayPracticeLogs(user.id),
            ]);
            setChildren(childrenData);
            setPractices(practicesData as PracticeWithSession[]);
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
    };

    const today = new Date().toISOString().split('T')[0];

    const filteredPractices = selectedChildId === 'ALL'
        ? practices
        : practices.filter(p => p.consultation_sessions?.child_id === selectedChildId);

    // 세션별 그룹핑
    const grouped: GroupedPractices[] = [];
    for (const p of filteredPractices) {
        const existing = grouped.find(g => g.session.id === p.consultation_sessions?.id);
        if (existing) {
            existing.practices.push(p);
        } else if (p.consultation_sessions) {
            grouped.push({ session: p.consultation_sessions, practices: [p] });
        }
    }

    const getTodayLog = (practiceId: string) => todayLogs.find(l => l.practice_id === practiceId);

    const getDoneDays = (practiceId: string) => allLogs.filter(l => l.practice_id === practiceId).length;

    const handleCheckSave = async (done: boolean, memo: string | null) => {
        if (!user || !checkModal) return;
        await db.createPracticeLog({
            practice_id: checkModal.practice.id,
            user_id: user.id,
            date: today,
            done,
            memo,
        });
        await fetchData();
    };

    const handleReviewSave = async (content: string) => {
        if (!user || !reviewModal) return;
        await db.createPracticeReview({
            practice_id: reviewModal.practice.id,
            user_id: user.id,
            content,
        });
        await db.updatePracticeItem(reviewModal.practice.id, { status: 'COMPLETED' });
        await fetchData();
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title="실천" />

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
                                전체
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

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium text-text-sub">실천 기록을 불러오고 있어요</p>
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-5xl text-primary/40">self_improvement</span>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-text-main dark:text-white text-lg">아직 실천 항목이 없어요</p>
                                <p className="text-text-sub text-sm leading-relaxed break-keep px-6">
                                    마음 통역소에서 상담을 받으면<br />맞춤 실천 항목이 생겨요
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/consult')}
                                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-[15px] shadow-xl shadow-primary/20 flex items-center gap-2 active:scale-[0.98] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                                상담 시작하기
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

                                {/* 실천 카드들 — 오늘 미완료 우선 */}
                                {[...sessionPractices].sort((a, b) => {
                                    const aDone = getTodayLog(a.id)?.done ? 1 : 0;
                                    const bDone = getTodayLog(b.id)?.done ? 1 : 0;
                                    return aDone - bDone;
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
                                                    {doneDays}/{practice.duration}일
                                                </span>
                                            </div>

                                            {/* 응원 메시지 */}
                                            {practice.encouragement && (
                                                <p className="text-[11px] text-secondary font-medium">{practice.encouragement}</p>
                                            )}

                                            {/* 오늘 체크 / 회고 버튼 */}
                                            {overdue ? (
                                                <button
                                                    onClick={() => setReviewModal({ practice, doneDays })}
                                                    className="w-full py-3 rounded-xl bg-secondary/10 text-secondary font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">rate_review</span>
                                                    기간 완료 — 회고 작성하기
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setCheckModal({ practice, existingLog: todayLog })}
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
                                                        ? todayLog.done ? '오늘 실천 완료' : '오늘 못했어요'
                                                        : '오늘 실천 기록하기'
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
                    onSave={handleReviewSave}
                    onClose={() => setReviewModal(null)}
                />
            )}
        </div>
    );
}

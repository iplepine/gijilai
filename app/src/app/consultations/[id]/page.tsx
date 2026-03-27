'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, SessionData } from '@/lib/db';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';

export default function ConsultationDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { user, loading: authLoading } = useAuth();

    const [session, setSession] = useState<(SessionData & { childName?: string }) | null>(null);
    const [consults, setConsults] = useState<any[]>([]);
    const [otherSessions, setOtherSessions] = useState<{ id: string; title: string; status: string; childName?: string; latestDate: string; latestMagicWord?: string; consultCount: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && user) loadData();
        else if (!authLoading) setIsLoading(false);
    }, [user, authLoading, id]);

    const loadData = async () => {
        if (!user || !id) return;
        try {
            const [{ data: sessionData }, { data: consultsData }, children, allSessions, { data: allConsults }] = await Promise.all([
                supabase
                    .from('consultation_sessions')
                    .select('*')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .single(),
                supabase
                    .from('consultations')
                    .select('*')
                    .eq('session_id', id)
                    .order('created_at', { ascending: true }),
                db.getChildren(user.id),
                db.getSessions(user.id),
                supabase
                    .from('consultations')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'COMPLETED')
                    .order('created_at', { ascending: false }),
            ]);

            if (sessionData) {
                const childName = children.find((c: any) => c.id === sessionData.child_id)?.name;
                setSession({ ...sessionData, childName } as SessionData & { childName?: string });
            }
            setConsults(consultsData || []);

            // 지난 상담 목록 (현재 세션 제외)
            const others = (allSessions || [])
                .filter((s: any) => s.id !== id)
                .map((s: any) => {
                    const sc = (allConsults || []).filter((c: any) => c.session_id === s.id);
                    const latest = sc[0];
                    return {
                        id: s.id,
                        title: s.title,
                        status: s.status,
                        childName: children.find((c: any) => c.id === s.child_id)?.name,
                        latestDate: latest?.created_at || s.created_at,
                        latestMagicWord: latest?.ai_prescription?.magicWord,
                        consultCount: sc.length,
                    };
                });
            setOtherSessions(others);
        } catch (e) {
            console.error('Failed to load consultation detail:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async () => {
        if (!session) return;

        // 연결된 ACTIVE 실천 항목 확인
        const { data: activePractices } = await supabase
            .from('practice_items')
            .select('id, title')
            .eq('session_id', session.id)
            .eq('status', 'ACTIVE');

        await db.updateSession(session.id, { status: 'RESOLVED' });

        if (activePractices && activePractices.length > 0) {
            const names = activePractices.map(p => `• ${p.title}`).join('\n');
            const dropPractices = window.confirm(
                `진행 중인 실천이 ${activePractices.length}개 있어요.\n\n${names}\n\n실천도 함께 종료할까요?`
            );
            if (dropPractices) {
                await Promise.all(
                    activePractices.map(p =>
                        supabase.from('practice_items').update({ status: 'DROPPED' }).eq('id', p.id)
                    )
                );
            }
        }

        setSession(prev => prev ? { ...prev, status: 'RESOLVED' } : prev);
    };

    const handleDeleteSession = async () => {
        if (!session) return;
        if (!window.confirm('이 고민과 관련된 모든 상담·실천 기록이 삭제돼요.\n정말 삭제할까요?')) return;
        await db.deleteSession(session.id);
        router.replace('/consultations');
    };

    const handleDeleteConsultation = async (consultationId: string) => {
        if (!window.confirm('이 상담 기록을 삭제할까요?')) return;
        await db.deleteConsultation(consultationId);
        const remaining = consults.filter(c => c.id !== consultationId);
        if (remaining.length === 0) {
            await db.deleteSession(session!.id);
            router.replace('/consultations');
        } else {
            setConsults(remaining);
        }
    };

    const statusLabel = (status: string) => {
        if (status === 'ACTIVE') return { text: '진행 중', color: 'text-primary bg-primary/10' };
        if (status === 'RESOLVED') return { text: '해결됨', color: 'text-secondary bg-secondary/10' };
        return { text: '지난 상담', color: 'text-text-sub bg-gray-100 dark:bg-white/10' };
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title="상담 기록" />

                <main className="w-full max-w-md p-6 pb-32 flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                        </div>
                    ) : !session ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-6">
                            <p className="font-bold text-slate-800 dark:text-white">상담을 찾을 수 없어요</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in duration-300 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-start gap-3">
                                    <h2 className="text-lg font-bold text-text-main dark:text-white flex-1 leading-snug">{session.title}</h2>
                                    {session.status !== 'ACTIVE' && (
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusLabel(session.status).color}`}>
                                            {statusLabel(session.status).text}
                                        </span>
                                    )}
                                </div>
                                {session.childName && (
                                    <p className="text-[12px] text-text-sub">{session.childName}</p>
                                )}
                            </div>

                            {/* 상담 타임라인 */}
                            <div className="space-y-4">
                                {consults.map((item: any, i: number) => {
                                    const rx = item.ai_prescription;
                                    return (
                                        <div key={item.id} className="space-y-3">
                                            {/* 날짜 뱃지 */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-bold text-[#D08B5B] bg-[#D08B5B]/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                                    {i > 0 && <span className="ml-1 text-secondary">(추가 상담)</span>}
                                                </span>
                                                {consults.length > 1 && (
                                                    <button
                                                        onClick={() => handleDeleteConsultation(item.id)}
                                                        className="text-[11px] text-text-sub/50 hover:text-red-400 transition-colors flex items-center gap-0.5"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* 고민 */}
                                            <div className="bg-[#FFFDF9] dark:bg-surface-dark border border-[#EACCA4]/40 rounded-2xl p-5">
                                                <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5 mb-2">
                                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                                    그날의 고민
                                                </div>
                                                <p className="text-[14px] text-text-main dark:text-white leading-relaxed">
                                                    &ldquo;{item.problem_description}&rdquo;
                                                </p>
                                            </div>

                                            {/* 처방전 */}
                                            {rx && (
                                                <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-secondary/20 space-y-4">
                                                    <div className="text-[12px] font-bold text-secondary flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[16px] fill-1">vaccines</span>
                                                        마음 처방전
                                                    </div>
                                                    {rx.interpretation && (
                                                        <div>
                                                            <div className="text-[11px] font-bold text-slate-400 mb-1">아이의 속마음</div>
                                                            <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">{rx.interpretation}</p>
                                                        </div>
                                                    )}
                                                    {rx.chemistry && (
                                                        <div>
                                                            <div className="text-[11px] font-bold text-slate-400 mb-1">아이와 나</div>
                                                            <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">{rx.chemistry}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* 실천 항목 */}
                                            {rx?.actionItems && rx.actionItems.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="text-[12px] font-bold text-primary flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[16px]">target</span>
                                                        실천 항목
                                                    </div>
                                                    {rx.actionItems.map((ai: any, j: number) => {
                                                        const isMagic = ai.title === '오늘의 한마디' || ai.duration === 1;
                                                        return isMagic ? (
                                                            <div key={j} className="bg-[#519E8A] rounded-xl p-4 text-white relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                                                                <div className="relative z-10">
                                                                    <div className="flex items-center gap-1 mb-2">
                                                                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                                                        <span className="text-[12px] font-black">{ai.title}</span>
                                                                    </div>
                                                                    <p className="text-[14px] font-bold leading-relaxed">&ldquo;{ai.description}&rdquo;</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div key={j} className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-primary/10 space-y-2">
                                                                <div>
                                                                    <p className="text-[13px] font-bold text-text-main dark:text-gray-200">{ai.title}</p>
                                                                    <span className="text-[11px] text-text-sub">{ai.duration}일</span>
                                                                </div>
                                                                <p className="text-[12px] text-text-main dark:text-gray-300 leading-relaxed">{ai.description}</p>
                                                                {ai.encouragement && (
                                                                    <div className="flex items-start gap-1.5 pt-1.5 border-t border-primary/10">
                                                                        <span className="material-symbols-outlined text-[13px] text-secondary mt-0.5">emoji_objects</span>
                                                                        <p className="text-[11px] text-secondary font-medium leading-relaxed">{ai.encouragement}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : rx?.actionItem ? (
                                                <div className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-primary/10 space-y-1">
                                                    <div className="text-[12px] font-bold text-primary flex items-center gap-1.5 mb-1">
                                                        <span className="material-symbols-outlined text-[16px]">target</span>
                                                        실천 과제
                                                    </div>
                                                    <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">{rx.actionItem}</p>
                                                </div>
                                            ) : null}

                                            {/* 상담 구분선 */}
                                            {i < consults.length - 1 && (
                                                <div className="border-t border-dashed border-primary/10 my-2" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 액션 버튼들 */}
                            <div className="space-y-3 pt-2">
                                {session.status === 'ACTIVE' && (
                                    <>
                                        <button
                                            onClick={() => router.push(`/consult?sessionId=${session.id}`)}
                                            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">add</span>
                                            추가 상담하기
                                        </button>
                                        <button
                                            onClick={handleResolve}
                                            className="w-full py-3 text-[13px] font-bold text-secondary flex items-center justify-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                            이 고민은 해결됐어요
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleDeleteSession}
                                    className="w-full py-3 text-[13px] font-medium text-text-sub/50 flex items-center justify-center gap-1 hover:text-red-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                    기록 삭제
                                </button>
                            </div>

                            {/* 지난 상담 */}
                            {otherSessions.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-primary/10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-gray-300 rounded-full" />
                                        <h3 className="text-[13px] font-bold text-text-sub">지난 상담</h3>
                                    </div>
                                    {otherSessions.map(s => {
                                        const label = statusLabel(s.status);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => router.push(`/consultations/${s.id}`)}
                                                className="w-full text-left bg-white dark:bg-surface-dark rounded-2xl p-5 border border-primary/10 active:scale-[0.99] transition-all"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="text-[15px] font-bold text-text-main dark:text-white">{s.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[11px] text-text-sub">
                                                                {new Date(s.latestDate).toLocaleDateString('ko-KR')}
                                                            </span>
                                                            {s.childName && (
                                                                <span className="text-[11px] text-text-sub">· {s.childName}</span>
                                                            )}
                                                            {s.consultCount > 1 && (
                                                                <span className="text-[11px] text-primary font-bold">상담 {s.consultCount}회</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${label.color}`}>
                                                        {label.text}
                                                    </span>
                                                </div>
                                                {s.latestMagicWord && (
                                                    <p className="text-[12px] text-secondary mt-2 line-clamp-1 font-bold">
                                                        &ldquo;{s.latestMagicWord}&rdquo;
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <BottomNav />
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, SessionData } from '@/lib/db';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';

interface SessionWithMeta extends SessionData {
    consultCount: number;
    latestDate: string;
    latestMagicWord?: string;
    childName?: string;
}

export default function RecordsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState<SessionWithMeta[]>([]);

    useEffect(() => {
        if (!authLoading && user) loadData();
        else if (!authLoading) setIsLoading(false);
    }, [user, authLoading]);

    const loadData = async () => {
        if (!user) return;
        try {
            const [childData, sessionData, { data: consultData }] = await Promise.all([
                db.getChildren(user.id),
                db.getSessions(user.id),
                supabase
                    .from('consultations')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'COMPLETED')
                    .order('created_at', { ascending: false }),
            ]);

            const consults = consultData || [];
            const sessionsWithMeta: SessionWithMeta[] = (sessionData || []).map(s => {
                const sessionConsults = consults.filter((c: any) => c.session_id === s.id);
                const latest = sessionConsults[0];
                return {
                    ...s,
                    consultCount: sessionConsults.length,
                    latestDate: latest?.created_at || s.created_at,
                    latestMagicWord: latest?.ai_prescription?.magicWord,
                    childName: (childData || []).find((c: any) => c.id === s.child_id)?.name,
                };
            });

            // 세션 없는 상담도 표시 (하위 호환)
            const orphanConsults = consults.filter((c: any) => !c.session_id);
            for (const c of orphanConsults) {
                sessionsWithMeta.push({
                    id: c.id,
                    user_id: user.id,
                    child_id: c.child_id,
                    title: '과거 상담',
                    status: 'ARCHIVED',
                    created_at: c.created_at,
                    updated_at: c.created_at,
                    consultCount: 1,
                    latestDate: c.created_at,
                    latestMagicWord: c.ai_prescription?.magicWord,
                    childName: (childData || []).find((ch: any) => ch.id === c.child_id)?.name,
                });
            }

            setSessions(sessionsWithMeta);
        } catch (e) {
            console.error('Failed to load records:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const statusLabel = (status: string) => {
        if (status === 'ACTIVE') return { text: '진행 중', color: 'text-primary bg-primary/10' };
        if (status === 'RESOLVED') return { text: '해결됨', color: 'text-secondary bg-secondary/10' };
        return { text: '지난 상담', color: 'text-text-sub bg-gray-100 dark:bg-white/10' };
    };

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const resolvedSessions = sessions.filter(s => s.status !== 'ACTIVE');

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full app-shell-width bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title="상담 기록" showBack={true} />

                <main className="w-full app-shell-width p-6 pb-32 flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-24 h-24 bg-secondary/5 dark:bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-5xl text-secondary/30">chat_bubble</span>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-slate-800 dark:text-white">아직 상담 기록이 없어요</p>
                                <p className="text-slate-400 text-sm leading-relaxed break-keep px-10">
                                    마음 통역소에서 첫 상담을 받아보세요.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {activeSessions.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        <h3 className="text-[13px] font-bold text-text-main dark:text-white">진행 중인 고민</h3>
                                    </div>
                                    {activeSessions.map(session => (
                                        <SessionCard key={session.id} session={session} statusLabel={statusLabel} onSelect={() => router.push(`/consultations/${session.id}`)} />
                                    ))}
                                </div>
                            )}
                            {resolvedSessions.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-gray-300 rounded-full" />
                                        <h3 className="text-[13px] font-bold text-text-sub">지난 기록</h3>
                                    </div>
                                    {resolvedSessions.map(session => (
                                        <SessionCard key={session.id} session={session} statusLabel={statusLabel} onSelect={() => router.push(`/consultations/${session.id}`)} />
                                    ))}
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

function SessionCard({ session, statusLabel, onSelect }: {
    session: SessionWithMeta;
    statusLabel: (s: string) => { text: string; color: string };
    onSelect: () => void;
}) {
    const label = statusLabel(session.status);
    return (
        <button
            onClick={onSelect}
            className="w-full text-left bg-white dark:bg-surface-dark rounded-2xl p-5 border border-primary/10 active:scale-[0.99] transition-all"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                    <h4 className="text-[15px] font-bold text-text-main dark:text-white">{session.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-text-sub">
                            {new Date(session.latestDate).toLocaleDateString('ko-KR')}
                        </span>
                        {session.childName && (
                            <span className="text-[11px] text-text-sub">· {session.childName}</span>
                        )}
                        {session.consultCount > 1 && (
                            <span className="text-[11px] text-primary font-bold">상담 {session.consultCount}회</span>
                        )}
                    </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${label.color}`}>
                    {label.text}
                </span>
            </div>
            {session.latestMagicWord && (
                <p className="text-[12px] text-secondary mt-2 line-clamp-1 font-bold">
                    &ldquo;{session.latestMagicWord}&rdquo;
                </p>
            )}
        </button>
    );
}

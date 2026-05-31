'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, SessionData, ChildProfile } from '@/lib/db';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';
import { TabLoadingScreen } from '@/components/ui/TabLoadingScreen';
import { useLocale } from '@/i18n/LocaleProvider';
import type { Database } from '@/types/supabase';
import {
    findCaregiver,
    hasLabelCollision,
    isCoParentLinked,
    loadCaregiverMap,
    type CaregiverMap,
} from '@/lib/coParentMap';
import { formatCaregiverLabelWithName } from '@/lib/coParent';

interface SessionWithMeta extends SessionData {
    consultCount: number;
    latestDate: string;
    latestProblem?: string;
    latestMagicWord?: string;
    childName?: string;
    /** 세션을 시작한 양육자 호칭(공동양육자 연결된 경우에만 값이 있음) */
    starterLabel?: string;
    /** 가장 최근 상담의 작성자 호칭(starter와 다르면 표시) */
    latestAuthorLabel?: string;
}

type ConsultationRow = Database['public']['Tables']['consultations']['Row'];

function getMagicWord(value: ConsultationRow['ai_prescription']): string | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const magicWord = (value as Record<string, unknown>).magicWord;
    return typeof magicWord === 'string' ? magicWord : undefined;
}

export default function RecordsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLocale();

    const [isLoading, setIsLoading] = useState(true);
    const [sessions, setSessions] = useState<SessionWithMeta[]>([]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                const [childData, sessionData, { data: consultData }] = await Promise.all([
                    db.getChildren(user.id),
                    db.getSessions(user.id),
                    // user_id 필터 제거: co-parent로 연결된 아이의 상담도 노출. RLS가 가시성 처리.
                    supabase
                        .from('consultations')
                        .select('*')
                        .eq('status', 'COMPLETED')
                        .order('created_at', { ascending: false }),
                ]);

                const children = childData || [];
                const consults = (consultData || []) as ConsultationRow[];

                // 보이는 아이별 양육자 맵 로드 (공동양육자 라벨 칩 표시용)
                const caregiverMaps = new Map<string, CaregiverMap>();
                await Promise.all(
                    children.map(async (c: ChildProfile) => {
                        if (!c.id) return;
                        try {
                            const map = await loadCaregiverMap(c.id);
                            if (isCoParentLinked(map)) caregiverMaps.set(c.id, map);
                        } catch (err) {
                            console.warn('[consultations] caregiver map load failed:', err);
                        }
                    }),
                );

                const resolveAuthorLabel = (childId: string | null | undefined, userId: string | null | undefined): string | undefined => {
                    if (!childId || !userId) return undefined;
                    const map = caregiverMaps.get(childId);
                    if (!map) return undefined; // 솔로 아이는 라벨 표시 안 함
                    const entry = findCaregiver(map, userId);
                    if (!entry) return undefined;
                    return formatCaregiverLabelWithName(entry.label, entry.displayName, hasLabelCollision(map));
                };

                const sessionsWithMeta: SessionWithMeta[] = (sessionData || []).map((s) => {
                    const sessionConsults = consults.filter((c) => c.session_id === s.id);
                    const latest = sessionConsults[0];
                    const starterLabel = resolveAuthorLabel(s.child_id, s.user_id);
                    const latestAuthorLabel = latest ? resolveAuthorLabel(s.child_id, latest.user_id) : undefined;
                    return {
                        ...s,
                        consultCount: sessionConsults.length,
                        latestDate: latest?.created_at || s.created_at,
                        latestProblem: latest?.problem_description ?? undefined,
                        latestMagicWord: latest ? getMagicWord(latest.ai_prescription) : undefined,
                        childName: children.find((c: ChildProfile) => c.id === s.child_id)?.name,
                        starterLabel,
                        latestAuthorLabel,
                    };
                });

                const orphanConsults = consults.filter((c) => !c.session_id);
                for (const c of orphanConsults) {
                    const authorLabel = resolveAuthorLabel(c.child_id, c.user_id);
                    sessionsWithMeta.push({
                        id: c.id,
                        user_id: c.user_id,
                        child_id: c.child_id,
                        title: t('consult.pastConsult'),
                        status: 'ARCHIVED',
                        created_at: c.created_at,
                        updated_at: c.created_at,
                        consultCount: 1,
                        latestDate: c.created_at,
                        latestProblem: c.problem_description ?? undefined,
                        latestMagicWord: getMagicWord(c.ai_prescription),
                        childName: children.find((ch: ChildProfile) => ch.id === c.child_id)?.name,
                        starterLabel: authorLabel,
                        latestAuthorLabel: authorLabel,
                    });
                }

                setSessions(sessionsWithMeta);
            } catch (e) {
                console.error('Failed to load records:', e);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user, authLoading, t]);

    const statusLabel = (status: string) => {
        if (status === 'ACTIVE') return { text: t('consult.statusActive'), color: 'text-primary bg-primary/10' };
        if (status === 'RESOLVED') return { text: t('consult.statusResolved'), color: 'text-secondary bg-secondary/10' };
        return { text: t('consult.statusArchived'), color: 'text-text-sub bg-gray-100 dark:bg-white/10' };
    };

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const resolvedSessions = sessions.filter(s => s.status !== 'ACTIVE');

    if (isLoading || authLoading) {
        return (
            <TabLoadingScreen
                navbarTitle={t('consult.consultHistory')}
                showBack
                label={t('consult.loadingRecords')}
            />
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col shadow-2xl overflow-hidden relative">
                <Navbar title={t('consult.consultHistory')} showBack={true} />

                <main className="app-bottom-nav-scroll w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar p-6">
                    {sessions.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-24 h-24 bg-secondary/5 dark:bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                                <span className="material-symbols-outlined text-5xl text-secondary/30">chat_bubble</span>
                            </div>
                            <div className="space-y-2">
                                <p className="font-bold text-slate-800 dark:text-white">{t('consult.noRecords')}</p>
                                <p className="text-slate-400 text-sm leading-relaxed break-keep px-10">
                                    {t('consult.noRecordsHint')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {activeSessions.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        <h3 className="text-[13px] font-bold text-text-main dark:text-white">{t('consult.activeConsults')}</h3>
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
                                        <h3 className="text-[13px] font-bold text-text-sub">{t('consult.pastRecords')}</h3>
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
    const { t, locale } = useLocale();
    const label = statusLabel(session.status);
    return (
        <button
            onClick={onSelect}
            className="w-full text-left bg-white dark:bg-surface-dark rounded-xl p-4 border border-primary/10 active:scale-[0.99] transition-all"
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-bold tracking-[-0.01em] text-text-main dark:text-white">{session.title}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        <span className="text-[10px] font-medium text-text-sub/90">
                            {new Date(session.latestDate).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                        </span>
                        {session.childName && (
                            <span className="text-[10px] font-medium text-text-sub/90">{session.childName}</span>
                        )}
                        {session.consultCount > 1 && (
                            <span className="text-[10px] font-semibold text-primary/85">{t('consult.consultCount', { count: session.consultCount })}</span>
                        )}
                    </div>
                    {/* 공동양육자 라벨 칩 — 솔로 사용자에겐 표시되지 않음 */}
                    {(session.starterLabel || session.latestAuthorLabel) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {session.starterLabel && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    <span className="material-symbols-outlined text-[12px] leading-none">play_arrow</span>
                                    {session.starterLabel}이 시작
                                </span>
                            )}
                            {session.latestAuthorLabel &&
                              session.latestAuthorLabel !== session.starterLabel && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                                    <span className="material-symbols-outlined text-[12px] leading-none">forum</span>
                                    {session.latestAuthorLabel}이 이어감
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-semibold px-2 py-1 rounded-md ${label.color}`}>
                        {label.text}
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-text-sub/30">chevron_right</span>
                </div>
            </div>

            {session.latestProblem && (
                <div className="mt-2.5 rounded-lg bg-[#FFF9F4] dark:bg-primary/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-[#D08B5B]/85 mb-1">{t('consult.todaysConcern')}</p>
                    <p className="text-[12px] font-medium text-text-main dark:text-white leading-[1.5] line-clamp-2 break-keep">
                        &ldquo;{session.latestProblem}&rdquo;
                    </p>
                </div>
            )}

            {session.latestMagicWord && (
                <div className="mt-2 flex items-start gap-1.5 text-secondary/65">
                    <span className="material-symbols-outlined text-[18px] leading-none mt-0.5 shrink-0">record_voice_over</span>
                    <p className="text-[10px] line-clamp-2 font-medium leading-[1.45]">
                        &ldquo;{session.latestMagicWord}&rdquo;
                    </p>
                </div>
            )}
        </button>
    );
}

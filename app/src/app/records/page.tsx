'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { db } from '@/lib/db';
import BottomNav from '@/components/layout/BottomNav';
import { Navbar } from '@/components/layout/Navbar';

export default function RecordsPage() {
    return (
        <Suspense>
            <RecordsContent />
        </Suspense>
    );
}

function RecordsContent() {
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { intake } = useAppStore();

    const [children, setChildren] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [consults, setConsults] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);

    useEffect(() => {
        if (!authLoading && user) {
            loadData();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [user, authLoading]);

    useEffect(() => {
        const viewId = searchParams.get('view');
        if (viewId && consults.length > 0) {
            const target = consults.find((c: any) => c.id === viewId);
            if (target) setSelected(target);
        }
    }, [consults, searchParams]);

    const loadData = async () => {
        if (!user) return;
        try {
            const [childData, { data: consultData }] = await Promise.all([
                db.getChildren(user.id),
                supabase
                    .from('consultations')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'COMPLETED')
                    .order('created_at', { ascending: false }),
            ]);
            setChildren(childData || []);
            setConsults(consultData || []);
        } catch {
            // 실패 시 무시
        } finally {
            setIsLoading(false);
        }
    };

    const childName = (childId: string | null) =>
        children.find((c: any) => c.id === childId)?.name;

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar
                    title="상담 기록"
                    showBack={!!selected}
                    onBackClick={selected ? () => setSelected(null) : undefined}
                    rightElement={selected ? (
                        <button
                            onClick={() => setSelected(null)}
                            className="text-[13px] font-bold text-secondary flex items-center gap-0.5"
                        >
                            목록
                        </button>
                    ) : undefined}
                />

                <main className="w-full max-w-md p-6 pb-32 flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                        </div>
                    ) : selected ? (
                        <div className="animate-in fade-in duration-300 space-y-4">
                            <span className="text-[12px] font-bold text-[#D08B5B] bg-[#D08B5B]/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {new Date(selected.created_at).toLocaleDateString('ko-KR')}
                                {childName(selected.child_id) && (
                                    <span className="ml-1 opacity-70">· {childName(selected.child_id)}</span>
                                )}
                            </span>

                            <div className="bg-[#FFFDF9] dark:bg-surface-dark border border-[#EACCA4]/40 rounded-2xl p-5">
                                <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5 mb-2">
                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                    그날의 고민
                                </div>
                                <p className="text-[14px] text-text-main dark:text-white leading-relaxed">
                                    &ldquo;{selected.problem_description}&rdquo;
                                </p>
                            </div>

                            {selected.ai_prescription && (
                                <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-secondary/20 space-y-4">
                                    <div className="text-[12px] font-bold text-secondary flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] fill-1">vaccines</span>
                                        마음 처방전
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-400 mb-1">
                                            {intake.childName ? `${intake.childName}의 속마음` : '아이의 속마음'}
                                        </div>
                                        <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                            {selected.ai_prescription.interpretation}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-400 mb-1">아이와 나</div>
                                        <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                            {selected.ai_prescription.chemistry}
                                        </p>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-400 mb-1">실천 과제</div>
                                        <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                            {selected.ai_prescription.actionItem}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selected.ai_prescription?.magicWord && (
                                <div className="bg-[#519E8A] rounded-2xl p-5 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                            <span className="text-[14px] font-black">마법의 한마디</span>
                                        </div>
                                        <p className="text-[16px] font-medium leading-relaxed">
                                            &ldquo;{selected.ai_prescription.magicWord}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : consults.length === 0 ? (
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
                        <div className="space-y-3 animate-in fade-in duration-300">
                            {consults.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelected(item)}
                                    className="w-full text-left bg-[#FFFDF9] dark:bg-surface-dark rounded-2xl p-5 border border-[#EACCA4]/30 active:scale-[0.99] transition-all"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-[#D08B5B] flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                                            {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                            {childName(item.child_id) && (
                                                <span className="ml-1 opacity-70">· {childName(item.child_id)}</span>
                                            )}
                                        </span>
                                        <span className="material-symbols-outlined text-[16px] text-secondary/50">arrow_forward</span>
                                    </div>
                                    <p className="text-[14px] font-bold text-text-main dark:text-white line-clamp-2 leading-snug">
                                        &ldquo;{item.problem_description}&rdquo;
                                    </p>
                                    {item.ai_prescription?.magicWord && (
                                        <p className="text-[12px] text-secondary mt-2 line-clamp-1 font-bold">
                                            &ldquo;{item.ai_prescription.magicWord}&rdquo;
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </main>

                <BottomNav />
            </div>
        </div>
    );
}

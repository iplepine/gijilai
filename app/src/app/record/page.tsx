'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';

import { db, ReportData } from '@/lib/db';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

type TabType = 'REPORT' | 'CONSULT' | 'MISSION';

interface Consultation {
    id: string;
    created_at: string;
    category: string;
    problem_description: string;
    ai_options?: any[];
    user_response?: Record<string, string>;
    ai_prescription: {
        interpretation: string;
        chemistry: string;
        magicWord: string;
        actionItem: string;
    };
}

interface ActionItem {
    id: string;
    created_at: string;
    title: string;
    is_completed: boolean;
}

export default function RecordPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('REPORT');
    const [reports, setReports] = useState<ReportData[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);
    const [missions, setMissions] = useState<ActionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedConsult, setSelectedConsult] = useState<Consultation | null>(null);

    useEffect(() => {
        if (!authLoading) {
            if (user) {
                fetchData();
            } else {
                setIsLoading(false);
            }
        }
    }, [user, authLoading]);

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // 1. Fetch TCI Reports
            const reportData = await db.getReports(user.id);
            setReports(reportData || []);

            // 2. Fetch Consultations
            const { data: consultData, error: consultError } = await supabase
                .from('consultations')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (consultError) throw consultError;
            setConsultations(consultData || []);

            // 3. Fetch Action Items (Missions)
            const { data: missionData, error: missionError } = await supabase
                .from('action_items')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (missionError) throw missionError;
            setMissions(missionData || []);

        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMission = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('action_items')
                .update({ is_completed: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setMissions(prev => prev.map(m =>
                m.id === id ? { ...m, is_completed: !currentStatus } : m
            ));
        } catch (error) {
            console.error('Error updating mission:', error);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center">
            {/* Header */}
            <header className="w-full max-w-md px-6 py-8 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-text-main dark:text-white flex items-center gap-2 font-display tracking-tight">
                        <span className="material-symbols-outlined text-secondary fill-1">vaccines</span>
                        마음 약국
                    </h1>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-black/20 rounded-2xl overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('REPORT')}
                        className={`flex-none px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'REPORT'
                            ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                            : 'text-slate-400 hover:text-primary'
                            }`}
                    >
                        기질 분석
                    </button>
                    <button
                        onClick={() => setActiveTab('CONSULT')}
                        className={`flex-none px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'CONSULT'
                            ? 'bg-white dark:bg-surface-dark text-secondary shadow-sm'
                            : 'text-slate-400 hover:text-secondary'
                            }`}
                    >
                        마음 약국
                    </button>
                    <button
                        onClick={() => setActiveTab('MISSION')}
                        className={`flex-none px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'MISSION'
                            ? 'bg-white dark:bg-surface-dark text-green-600 shadow-sm'
                            : 'text-slate-400 hover:text-green-600'
                            }`}
                    >
                        미션 기록
                    </button>
                </div>
            </header>

            <main className="w-full max-w-md p-6 pb-32">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                        <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></span>
                        <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                    </div>
                ) : activeTab === 'REPORT' ? (
                    /* Report List */
                    <div className="space-y-5">
                        {reports.length > 0 ? (
                            reports.map(report => {
                                const analysis = report.analysis_json as any;
                                const isHarmony = report.type === 'HARMONY';
                                const isParent = report.type === 'PARENT';

                                return (
                                    <div
                                        key={report.id}
                                        onClick={() => {
                                            // 리포트 상세 페이지로 이동 (나중에 reportId로 로드하는 로직 추가 필요)
                                            alert('상세 보고 기능은 곧 업데이트됩니다!');
                                        }}
                                        className="bg-white dark:bg-surface-dark rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl -mr-8 -mt-8 opacity-20 ${isHarmony ? 'bg-green-500' : isParent ? 'bg-orange-500' : 'bg-primary'}`}></div>

                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <div className="space-y-1">
                                                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isHarmony ? 'bg-green-100 text-green-600' :
                                                    isParent ? 'bg-orange-100 text-orange-600' :
                                                        'bg-primary/10 text-primary'
                                                    }`}>
                                                    {report.type === 'CHILD' ? '아이 기질' : isParent ? '양육자 기질' : '조화 분석'}
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-400 mt-1">
                                                    {formatDate(report.created_at)}
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-black/20 flex items-center justify-center text-slate-300">
                                                <Icon name="chevron_right" size="sm" />
                                            </div>
                                        </div>

                                        <div className="relative z-10">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight mb-2 break-keep">
                                                {isHarmony ? analysis?.harmonyTitle : (analysis?.title?.split(':')[1]?.trim() || analysis?.title)}
                                            </h3>
                                            <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed break-keep">
                                                {analysis?.intro || analysis?.dynamics?.description || '상세 리포트 내용을 확인해 보세요.'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-24 flex flex-col items-center text-center space-y-6">
                                <div className="text-6xl grayscale opacity-20">📊</div>
                                <div className="space-y-2">
                                    <p className="text-slate-800 dark:text-white font-bold">아직 생성된 리포트가 없어요</p>
                                    <p className="text-slate-400 text-sm break-keep">
                                        기질 검사를 완료하고 나만을 위한<br />AI 심층 분석 리포트를 받아보세요!
                                    </p>
                                </div>
                                <Button onClick={() => router.push('/')} variant="primary" className="rounded-full px-8">
                                    검사하러 가기
                                </Button>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'CONSULT' ? (
                    /* Consultation List */
                    <div className="space-y-4">
                        {consultations.length > 0 ? (
                            consultations.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedConsult(item)}
                                    className="bg-[#FFFDF9] dark:bg-surface-dark rounded-[2rem] p-6 shadow-sm border border-[#EACCA4]/30 relative overflow-hidden group active:scale-[0.99] transition-all cursor-pointer hover:border-secondary/30"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <span className="text-[12px] font-bold text-[#D08B5B] dark:text-secondary bg-[#D08B5B]/10 dark:bg-secondary/10 px-3 py-1.5 rounded-lg tracking-wide inline-flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {formatDate(item.created_at)}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-white dark:bg-black/20 flex items-center justify-center text-[#D08B5B] dark:text-secondary shadow-sm">
                                            <span className="material-symbols-outlined text-[18px] fill-1">heart_plus</span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 mb-6">
                                        <h3 className="text-[15.5px] font-bold text-text-main dark:text-white leading-relaxed line-clamp-2 break-keep tracking-tight">
                                            "{item.problem_description}"
                                        </h3>
                                    </div>

                                    <div className="relative z-10 bg-[#519E8A]/5 p-4 rounded-2xl border border-[#519E8A]/10 flex flex-col gap-1.5">
                                        <div className="text-[11px] font-bold text-[#519E8A] flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                            처방받은 마법의 한마디
                                        </div>
                                        <p className="text-[14px] font-bold text-[#3B7A6A] dark:text-[#519E8A] leading-snug truncate">
                                            "{item.ai_prescription?.magicWord}"
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-24 flex flex-col items-center text-center space-y-5">
                                <div className="w-20 h-20 bg-[#FFFDF9] dark:bg-surface-dark rounded-full shadow-inner flex items-center justify-center mb-2">
                                    <span className="material-symbols-outlined text-4xl text-[#D08B5B]/30 font-light">vaccines</span>
                                </div>
                                <p className="text-text-sub dark:text-gray-400 text-[15px] leading-relaxed break-keep font-medium">
                                    아직 기록된 처방전이 없어요.<br />
                                    육아가 유독 버겁고 힘든 날,<br />언제든 마음 약국을 찾아와 고민을 털어놓아주세요.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Mission List */
                    <div className="space-y-3">
                        {missions.length > 0 ? (
                            missions.map(mission => (
                                <div
                                    key={mission.id}
                                    onClick={() => toggleMission(mission.id, mission.is_completed)}
                                    className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer active:scale-[0.98] ${mission.is_completed
                                        ? 'bg-primary/5 border-primary/20 opacity-80'
                                        : 'bg-white dark:bg-surface-dark border-primary/5 shadow-soft hover:border-primary/20'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${mission.is_completed
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-beige-light dark:bg-black/20 text-primary'
                                        }`}>
                                        <span className="material-symbols-outlined text-[28px]">
                                            {mission.is_completed ? 'check_circle' : 'task_alt'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-[15px] font-bold leading-snug transition-all ${mission.is_completed ? 'text-text-sub line-through opacity-70' : 'text-text-main dark:text-white'
                                            }`}>
                                            {mission.title}
                                        </h4>
                                        <span className="text-[10px] text-text-sub font-medium opacity-60">
                                            {formatDate(mission.created_at)} 처방
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center space-y-4">
                                <div className="text-5xl opacity-20">🎯</div>
                                <p className="text-text-sub dark:text-gray-400 text-sm leading-relaxed">
                                    실천 중인 미션이 없어요.<br />
                                    처방전의 미션을 등록해 실천해보세요!
                                </p>
                            </div>
                        )}
                    </div>
                )
                }
            </main >

            {/* Consultation Detail Modal */}
            {
                selectedConsult && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div
                            className="w-full max-w-md bg-background-light dark:bg-background-dark rounded-t-[3rem] max-h-[90vh] overflow-y-auto flex flex-col p-8 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl relative"
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedConsult(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>

                            <div className="mb-8 pt-4">
                                <span className="text-[12px] font-bold text-[#D08B5B] dark:text-secondary bg-[#D08B5B]/10 dark:bg-secondary/10 px-3 py-1.5 rounded-lg tracking-wider mb-3 inline-block">
                                    {formatDate(selectedConsult.created_at)}
                                </span>
                                <h2 className="text-[26px] font-bold text-text-main dark:text-white font-display tracking-tight break-keep leading-snug">
                                    아이를 온전히 이해하고 싶었던 날의 기록
                                </h2>
                            </div>

                            {/* Problem Context */}
                            <div className="bg-[#FFFDF9] dark:bg-surface-dark border border-[#EACCA4]/40 rounded-[2rem] p-7 mb-8 flex flex-col gap-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                                <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                    그날 양육자님의 마음
                                </div>
                                <p className="text-[15px] leading-relaxed text-text-main dark:text-white font-medium">
                                    "{selectedConsult.problem_description}"
                                </p>
                            </div>

                            {/* Dynamic Questions & Answers */}
                            {selectedConsult.ai_options && selectedConsult.ai_options.length > 0 && (
                                <div className="flex flex-col gap-6 mb-10 pl-2">
                                    <div className="text-sm font-bold text-text-sub dark:text-gray-400 flex items-center gap-2 mb-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                        상담사 아이나와 나눈 대화
                                    </div>
                                    {selectedConsult.ai_options.map((q: any) => (
                                        <div key={q.id} className="flex flex-col gap-3">
                                            <div className="flex gap-3 items-start pr-8">
                                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                                                    <img src="/gijilai_icon.png" alt="" className="w-4 h-4 opacity-70 grayscale" />
                                                </div>
                                                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none p-4 text-[13px] text-text-main dark:text-white leading-relaxed">
                                                    {q.text}
                                                </div>
                                            </div>
                                            {selectedConsult.user_response?.[q.id] && (
                                                <div className="flex gap-3 items-start pl-8 justify-end">
                                                    <div className="bg-secondary/10 text-secondary border border-secondary/20 dark:bg-surface-dark rounded-2xl p-4 text-[13px] font-bold">
                                                        {selectedConsult.user_response[q.id]}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Prescription Result */}
                            <div className="flex flex-col gap-6 mb-20">
                                <div className="text-[15px] font-bold text-secondary flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px] fill-1">vaccines</span>
                                    우리를 위한 마음 처방전
                                </div>

                                <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-7 border border-secondary/20 shadow-lg shadow-secondary/5 space-y-6">
                                    <div>
                                        <div className="text-[12px] font-bold text-secondary mb-2 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                                            그때 아이의 진짜 마음은요
                                        </div>
                                        <p className="text-[14.5px] leading-relaxed dark:text-gray-200 break-keep">{selectedConsult.ai_prescription.interpretation}</p>
                                    </div>

                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>

                                    <div>
                                        <div className="text-[12px] font-bold text-text-main dark:text-white mb-2 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                            우리의 기질 케미
                                        </div>
                                        <p className="text-[14px] text-text-sub dark:text-gray-300 leading-relaxed break-keep">{selectedConsult.ai_prescription.chemistry}</p>
                                    </div>

                                    <div className="bg-[#519E8A]/10 p-5 rounded-2xl border border-[#519E8A]/20">
                                        <div className="text-[12px] font-bold text-[#3B7A6A] mb-2 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px] fill-1">auto_awesome</span>
                                            마법의 한마디
                                        </div>
                                        <p className="text-[16px] font-black text-[#519E8A] break-keep leading-snug tracking-tight">"{selectedConsult.ai_prescription.magicWord}"</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Bottom Nav Spacer */}
            <div className="h-32"></div>
            <BottomNav />
        </div >
    );
}

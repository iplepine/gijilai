'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';

import { db, ReportData } from '@/lib/db';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { TCI_TERMINOLOGY } from '@/constants/terminology';

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
    const [children, setChildren] = useState<any[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | 'ALL'>('ALL');
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

            // 4. Fetch Children
            const childData = await db.getChildren(user.id);
            setChildren(childData || []);

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

    const filteredReports = reports.filter(r => selectedChildId === 'ALL' || r.child_id === selectedChildId);
    const filteredConsultations = consultations.filter(c => selectedChildId === 'ALL' || (c as any).child_id === selectedChildId);
    const filteredMissions = missions.filter(m => selectedChildId === 'ALL' || (m as any).child_id === selectedChildId);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                {/* Header */}
                <header className="w-full max-w-md px-6 pt-12 pb-4 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800">
                    <div className="relative flex items-center justify-center h-10 mb-4 w-full">
                        {/* Left Action: Back Button */}
                        <div className="absolute left-0">
                            <button
                                onClick={() => router.back()}
                                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-white hover:bg-slate-200 transition-colors"
                                aria-label="뒤로 가기"
                            >
                                <Icon name="arrow_back" size="sm" />
                            </button>
                        </div>

                        {/* Center: Title */}
                        <h1 className="text-xl font-bold text-text-main dark:text-white flex items-center gap-1.5 font-display tracking-tight text-center">
                            나의 기록
                        </h1>
                    </div>

                    {/* Child Filter Chips */}
                    {children.length > 0 && (
                        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedChildId('ALL')}
                                className={`px-4 py-2 rounded-full text-[12px] font-black whitespace-nowrap transition-all ${
                                    selectedChildId === 'ALL'
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-white dark:bg-surface-dark text-slate-400 border border-slate-100 dark:border-slate-800'
                                }`}
                            >
                                전체
                            </button>
                            {children.map((child: any) => (
                                <button
                                    key={child.id}
                                    onClick={() => setSelectedChildId(child.id)}
                                    className={`px-4 py-2 rounded-full text-[12px] font-black whitespace-nowrap transition-all ${
                                        selectedChildId === child.id
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-white dark:bg-surface-dark text-slate-400 border border-slate-100 dark:border-slate-800'
                                    }`}
                                >
                                    {child.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex p-1 bg-slate-100 dark:bg-black/20 rounded-2xl overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('REPORT')}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'REPORT'
                                ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                                : 'text-slate-400 hover:text-primary'
                                }`}
                        >
                            분석 리포트
                        </button>
                        <button
                            onClick={() => setActiveTab('CONSULT')}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'CONSULT'
                                ? 'bg-white dark:bg-surface-dark text-secondary shadow-sm'
                                : 'text-slate-400 hover:text-secondary'
                                }`}
                        >
                            상담 일지
                        </button>
                        <button
                            onClick={() => setActiveTab('MISSION')}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-black transition-all ${activeTab === 'MISSION'
                                ? 'bg-white dark:bg-surface-dark text-green-600 shadow-sm'
                                : 'text-slate-400 hover:text-green-600'
                                }`}
                        >
                            실천 미션
                        </button>
                    </div>
                </header>

                <main className="w-full max-w-md p-6 pb-32">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></span>
                            <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                        </div>
                    ) : children.length === 0 ? (
                        /* Onboarding for No Children */
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center text-6xl mb-10 relative">
                                <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
                                🌱
                            </div>

                            <div className="space-y-4 mb-12">
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                                    나만의 육아 아카이브를<br />시작해보세요
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed break-keep px-4 font-medium">
                                    아이의 기질을 이해하고 나눈 대화들,<br />
                                    그리고 매일의 작은 실천들이 이곳에 쌓여<br />
                                    <span className="text-primary font-bold">우리 가족만의 소중한 기록</span>이 됩니다.
                                </p>
                            </div>

                            <Button
                                onClick={() => router.replace('/intake')}
                                variant="primary"
                                className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                            >
                                첫 아이 등록하고 시작하기
                            </Button>

                            <p className="mt-6 text-[12px] text-slate-400 font-medium">
                                이미 등록하셨나요? <button onClick={fetchData} className="underline text-primary/60">새로고침</button>
                            </p>
                        </div>
                    ) : activeTab === 'REPORT' ? (
                        /* Report List */
                        <div className="space-y-5">
                            {filteredReports.length > 0 ? (
                                filteredReports.map((report, idx) => {
                                    const analysis = report.analysis_json as any;
                                    const isHarmony = report.type === 'HARMONY';
                                    const isParent = report.type === 'PARENT';
                                    // 같은 아이 + 같은 타입의 리포트 중 몇 회차인지 계산
                                    const sameTypeReports = filteredReports
                                        .filter(r => r.child_id === report.child_id && r.type === report.type)
                                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                    const roundNumber = sameTypeReports.findIndex(r => r.id === report.id) + 1;
                                    const totalRounds = sameTypeReports.length;

                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => {
                                                router.replace(`/report?id=${report.id}`);
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
                                                        {report.type === 'CHILD' ? TCI_TERMINOLOGY.REPORT.CHILD_NAME : isParent ? TCI_TERMINOLOGY.REPORT.PARENT_NAME : TCI_TERMINOLOGY.REPORT.HARMONY_TITLE.split(' ')[0] + ' ' + TCI_TERMINOLOGY.REPORT.HARMONY_TITLE.split(' ')[1]}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                                                        {formatDate(report.created_at)}
                                                        {totalRounds > 1 && (
                                                            <span className="text-primary/60 font-black">
                                                                <span className="w-0.5 h-0.5 rounded-full bg-slate-300 inline-block mr-1.5"></span>
                                                                {roundNumber}회차
                                                            </span>
                                                        )}
                                                        {selectedChildId === 'ALL' && children.find(c => c.id === report.child_id) && (
                                                            <span className="flex items-center gap-1 text-primary/60">
                                                                <span className="w-0.5 h-0.5 rounded-full bg-slate-300"></span>
                                                                {children.find(c => c.id === report.child_id)?.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-black/20 flex items-center justify-center text-slate-300">
                                                    <Icon name="chevron_right" size="sm" />
                                                </div>
                                            </div>

                                            <div className="relative z-10">
                                                <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight mb-2 break-keep">
                                                    {isHarmony ? (analysis?.harmonyTitle || '조화 분석 리포트') : (analysis?.title || '기질 리포트')}
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
                                        <p className="text-slate-400 text-sm break-keep leading-relaxed px-10">
                                            기질 검사를 완료하고 나만을 위한<br />AI 심층 분석 리포트를 받아보세요!
                                        </p>
                                    </div>
                                    <Button onClick={() => router.replace('/')} variant="primary" className="rounded-full px-10 h-14 font-black">
                                        기질 검사 시작하기
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'CONSULT' ? (
                        /* Consultation List */
                        <div className="space-y-4">
                            {filteredConsultations.length > 0 ? (
                                filteredConsultations.map(item => (
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
                                                {selectedChildId === 'ALL' && children.find(c => c.id === (item as any).child_id) && (
                                                    <span className="flex items-center gap-1 ml-1 opacity-70">
                                                        <span className="w-0.5 h-0.5 rounded-full bg-secondary/30"></span>
                                                        {children.find(c => c.id === (item as any).child_id)?.name}
                                                    </span>
                                                )}
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

                                        <div className="relative z-10 bg-white dark:bg-black/10 p-5 rounded-2xl border border-secondary/10 flex flex-col gap-2 shadow-sm">
                                            <div className="text-[11px] font-black text-secondary uppercase tracking-widest flex items-center gap-1.5 opacity-80">
                                                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                                AI 마법의 한마디
                                            </div>
                                            <p className="text-[14.5px] font-bold text-slate-700 dark:text-secondary/90 leading-snug break-keep">
                                                "{item.ai_prescription?.magicWord}"
                                            </p>
                                        </div>

                                        <div className="mt-4 flex items-center justify-end text-[11px] font-bold text-secondary gap-1 group-hover:translate-x-1 transition-transform">
                                            처방전 다시보기 <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-24 flex flex-col items-center text-center space-y-6">
                                    <div className="w-24 h-24 bg-secondary/5 dark:bg-secondary/10 rounded-full flex items-center justify-center mb-2">
                                        <span className="material-symbols-outlined text-5xl text-secondary/30 font-light">vaccines</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-bold text-slate-800 dark:text-white">아직 통역된 마음이 없어요</p>
                                        <p className="text-slate-400 text-sm leading-relaxed break-keep px-10">
                                            육아가 유독 버겁고 힘든 날,<br />언제든 마음 상담소에서 고민을 터놓아주세요.
                                        </p>
                                    </div>
                                    <Button onClick={() => router.replace('/consult')} variant="secondary" className="rounded-full px-10 h-14 font-black">
                                        상담 시작하기
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Mission List */
                        <div className="space-y-3">
                            {filteredMissions.length > 0 ? (
                                filteredMissions.map(mission => (
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
                                <div className="py-24 flex flex-col items-center text-center space-y-6">
                                    <div className="w-24 h-24 bg-green-500/5 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-2">
                                        <span className="material-symbols-outlined text-5xl text-green-500/30 font-light">task_alt</span>
                                    </div>
                                    <div className="space-y-2 text-center">
                                        <p className="font-bold text-slate-800 dark:text-white">실천 중인 미션이 없어요</p>
                                        <p className="text-slate-400 text-sm leading-relaxed break-keep px-10">
                                            처방전에서 제안해드리는 미션을 등록하고<br />작은 변화를 직접 경험해보세요!
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                    }

                    {/* App Download Nudge - 하단 고정형이 아닌 목록 끝 배너 */}
                    <div className="mt-12 px-2">
                        <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-[2.5rem] p-8 text-center relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 blur-3xl -mr-24 -mt-24"></div>
                            <div className="relative z-10 space-y-5">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-md border border-white/20">
                                    <span className="text-2xl animate-bounce-subtle">✨</span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-white leading-tight">
                                        실천 관리는 앱에서 하세요
                                    </h3>
                                    <p className="text-slate-400 text-[12px] leading-relaxed break-keep">
                                        매일 정해진 시간에 보내드리는 대화 처방 알림과<br />아이의 변화를 기록하는 캘린더 기능을 만나보세요.
                                    </p>
                                </div>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    className="h-12 rounded-xl bg-white text-slate-900 font-black text-sm shadow-xl"
                                    onClick={() => window.open('https://aina.garden/app', '_blank')}
                                >
                                    기질아이 앱 설치하기
                                </Button>
                            </div>
                        </div>
                    </div>
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
                                    <span className="text-[12px] font-bold text-[#D08B5B] dark:text-secondary bg-[#D08B5B]/10 dark:bg-secondary/10 px-3 py-1.5 rounded-lg tracking-wider mb-3 inline-flex items-center gap-2">
                                        {formatDate(selectedConsult.created_at)}
                                        {children.find(c => c.id === (selectedConsult as any).child_id) && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-secondary/30"></span>
                                                {children.find(c => c.id === (selectedConsult as any).child_id)?.name}
                                            </>
                                        )}
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
            </div>
        </div>
    );
}

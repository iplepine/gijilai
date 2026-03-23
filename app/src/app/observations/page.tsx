'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';
import { db, ObservationData } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';

interface Consultation {
    id: string;
    created_at: string;
    problem_description: string;
    ai_prescription: {
        actionItem: string;
    };
}

export default function RecordPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [observations, setObservations] = useState<ObservationData[]>([]);
    const [children, setChildren] = useState<any[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string | 'ALL'>('ALL');
    const [isLoading, setIsLoading] = useState(true);

    // 작성 모달
    const [showModal, setShowModal] = useState(false);
    const [situation, setSituation] = useState('');
    const [myAction, setMyAction] = useState('');
    const [childReaction, setChildReaction] = useState('');
    const [note, setNote] = useState('');
    const [modalChildId, setModalChildId] = useState<string>('');
    const [modalConsultId, setModalConsultId] = useState<string>('');
    const [recentConsults, setRecentConsults] = useState<Consultation[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
    const [latestActionItem, setLatestActionItem] = useState<{ actionItem: string; date: string; consultId: string } | null>(null);

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
            const [obsData, childData, consultData] = await Promise.all([
                db.getObservations(user.id),
                db.getChildren(user.id),
                supabase
                    .from('consultations')
                    .select('id, created_at, ai_prescription')
                    .eq('user_id', user.id)
                    .eq('status', 'COMPLETED')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .then(r => r.data),
            ]);
            setObservations(obsData || []);
            setChildren(childData || []);
            if (consultData?.[0]?.ai_prescription) {
                const p = consultData[0].ai_prescription as any;
                if (p.actionItem) {
                    setLatestActionItem({
                        actionItem: p.actionItem,
                        date: consultData[0].created_at,
                        consultId: consultData[0].id,
                    });
                }
            }
            if (childData?.length === 1) {
                setModalChildId(childData[0].id);
            }
        } catch (error) {
            console.error('Error fetching observations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = async () => {
        setSituation('');
        setMyAction('');
        setChildReaction('');
        setNote('');
        setModalConsultId('');
        setFieldErrors({});
        if (children.length === 1) {
            setModalChildId(children[0].id);
        } else {
            setModalChildId('');
        }

        // 최근 상담 3건 로드
        if (user) {
            try {
                const { data } = await supabase
                    .from('consultations')
                    .select('id, created_at, problem_description, ai_prescription')
                    .eq('user_id', user.id)
                    .eq('status', 'COMPLETED')
                    .order('created_at', { ascending: false })
                    .limit(3);
                setRecentConsults((data as Consultation[]) || []);
            } catch {
                setRecentConsults([]);
            }
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        const errors: Record<string, boolean> = {};
        if (!situation.trim()) errors.situation = true;
        if (!myAction.trim()) errors.myAction = true;
        if (!childReaction.trim()) errors.childReaction = true;
        if (children.length > 1 && !modalChildId) errors.childId = true;
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        if (!user) return;
        setIsSubmitting(true);
        try {
            const newObs = await db.createObservation({
                user_id: user.id,
                child_id: modalChildId || (children.length === 1 ? children[0].id : null),
                consultation_id: modalConsultId || null,
                situation: situation.trim(),
                my_action: myAction.trim(),
                child_reaction: childReaction.trim(),
                note: note.trim() || null,
            });
            setObservations(prev => [newObs, ...prev]);
            setShowModal(false);
        } catch (error) {
            console.error('Error saving observation:', error);
            alert('저장에 실패했어요. 다시 시도해주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 관찰 기록을 삭제할까요?')) return;
        const prev = observations;
        setObservations(obs => obs.filter(o => o.id !== id));
        try {
            await db.deleteObservation(id);
        } catch (error) {
            console.error('Error deleting observation:', error);
            setObservations(prev);
            alert('삭제에 실패했어요.');
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    };

    const filteredObservations = observations.filter(
        o => selectedChildId === 'ALL' || o.child_id === selectedChildId
    );

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center font-body">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar
                    title="관찰일지"
                    rightElement={filteredObservations.length > 0 ? (
                        <button onClick={openModal} className="text-primary">
                            <span className="material-symbols-outlined text-[24px]">edit_square</span>
                        </button>
                    ) : undefined}
                />

                {/* 아이별 필터 칩 */}
                {children.length > 1 && (
                    <div className="flex gap-2 px-6 py-3 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-gray-800">
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

                <main className="w-full max-w-md px-5 py-4 pb-32">
                    {/* 최근 상담 액션 아이템 */}
                    {!isLoading && latestActionItem && children.length > 0 && (
                        <div
                            onClick={() => router.push(`/consultations/${latestActionItem.consultId}`)}
                            className="mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-[1.5rem] p-5 border border-primary/15 animate-in fade-in slide-in-from-top-2 duration-500 cursor-pointer active:scale-[0.98] transition-transform"
                        >
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="material-symbols-outlined text-[16px] text-primary">target</span>
                                <span className="text-[11px] font-bold text-primary tracking-wide">오늘의 실천 과제</span>
                                <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-0.5">
                                    {formatDate(latestActionItem.date)} 상담
                                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                </span>
                            </div>
                            <p className="text-[14px] font-bold text-text-main dark:text-white leading-relaxed">
                                {latestActionItem.actionItem}
                            </p>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await openModal();
                                    setModalConsultId(latestActionItem.consultId);
                                }}
                                className="mt-3 text-[12px] font-bold text-primary flex items-center gap-1 ml-auto"
                            >
                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                실천 기록 남기기
                            </button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <span className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></span>
                            <p className="text-sm font-medium text-text-sub">기록을 불러오고 있어요</p>
                        </div>
                    ) : children.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="w-24 h-24 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center text-5xl mb-6 relative">
                                <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20"></div>
                                <span className="material-symbols-outlined text-6xl text-primary/40">edit_note</span>
                            </div>
                            <div className="space-y-3 mb-8">
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">
                                    나만의 육아 관찰일지를<br />시작해보세요
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed break-keep px-4 font-medium">
                                    아이와의 순간을 기록하고,<br />
                                    어떤 대응이 효과적이었는지 돌아보며<br />
                                    <span className="text-primary font-bold">나만의 양육 패턴</span>을 발견해보세요.
                                </p>
                            </div>
                            <Button
                                onClick={() => router.push('/intake')}
                                variant="primary"
                                className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all"
                            >
                                첫 아이 등록하고 시작하기
                            </Button>
                        </div>
                    ) : filteredObservations.length === 0 ? (
                        <div className="py-10 flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="w-16 h-16 bg-primary/5 dark:bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-primary/30">edit_note</span>
                            </div>
                            <p className="font-bold text-text-main dark:text-white">아직 관찰 기록이 없어요</p>
                            <p className="text-text-sub text-sm leading-relaxed break-keep px-6">
                                아이와의 순간을 기록해보세요.<br />
                                상황, 나의 대응, 아이의 반응을<br />짧게 적는 것만으로도 변화가 시작돼요.
                            </p>
                            <Button onClick={openModal} variant="primary" className="rounded-full px-10 h-12 font-black mt-2">
                                첫 관찰 기록 남기기
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredObservations.map(obs => (
                                <div
                                    key={obs.id}
                                    className="bg-[#FFFDF9] dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-[#EACCA4]/30 relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[12px] font-bold text-[#D08B5B] dark:text-secondary bg-[#D08B5B]/10 dark:bg-secondary/10 px-3 py-1.5 rounded-lg tracking-wide inline-flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                            {formatDate(obs.created_at)}
                                            {children.length > 1 && children.find(c => c.id === obs.child_id) && (
                                                <span className="flex items-center gap-1 ml-1 opacity-70">
                                                    <span className="w-0.5 h-0.5 rounded-full bg-secondary/30"></span>
                                                    {children.find(c => c.id === obs.child_id)?.name}
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {obs.consultation_id && (
                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">실천</span>
                                            )}
                                            <button
                                                onClick={() => handleDelete(obs.id)}
                                                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">location_on</span>
                                                상황
                                            </div>
                                            <p className="text-[14px] text-text-main dark:text-white leading-relaxed">{obs.situation}</p>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">chat</span>
                                                내 행동
                                            </div>
                                            <p className="text-[14px] text-text-main dark:text-white leading-relaxed">{obs.my_action}</p>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">child_care</span>
                                                아이 반응
                                            </div>
                                            <p className="text-[14px] text-text-main dark:text-white leading-relaxed">{obs.child_reaction}</p>
                                        </div>
                                        {obs.note && (
                                            <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-3 mt-2">
                                                <p className="text-[13px] text-text-sub dark:text-gray-300 leading-relaxed">{obs.note}</p>
                                            </div>
                                        )}
                                    </div>

                                    {obs.consultation_id && (
                                        <ConsultationLink consultationId={obs.consultation_id} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>


                {/* 작성 바텀시트 모달 */}
                {showModal && (
                    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="w-full max-w-md bg-white dark:bg-background-dark rounded-t-[2rem] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10 duration-500 shadow-2xl relative overflow-hidden">
                            {/* 핸들바 + 닫기 */}
                            <div className="sticky top-0 bg-white dark:bg-background-dark pt-3 pb-4 px-7 z-10">
                                <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[15px] font-bold text-text-main dark:text-white">{modalConsultId ? '실천 기록' : '관찰 기록'}</span>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-[13px] font-bold text-slate-400"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>

                            <div className="px-7 pb-24 overflow-y-auto flex-1">
                                {/* 아이 선택 (2명 이상일 때만) */}
                                {children.length > 1 && (
                                    <div className="flex gap-2 mb-5">
                                        {children.map((child: any) => (
                                            <button
                                                key={child.id}
                                                onClick={() => setModalChildId(child.id)}
                                                className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                                                    modalChildId === child.id
                                                        ? 'bg-text-main dark:bg-white text-white dark:text-black'
                                                        : 'text-slate-400 border border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                {child.name}
                                            </button>
                                        ))}
                                        {fieldErrors.childId && <p className="text-red-400 text-[11px] self-center">선택해주세요</p>}
                                    </div>
                                )}

                                {/* 실천 과제 표시 (연동 시) */}
                                {modalConsultId && latestActionItem && (
                                    <div className="mb-5 bg-primary/5 rounded-xl p-4 border border-primary/10">
                                        <div className="text-[11px] font-bold text-primary mb-1.5 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">target</span>
                                            실천 과제
                                        </div>
                                        <p className="text-[14px] text-text-main dark:text-white leading-relaxed">{latestActionItem.actionItem}</p>
                                    </div>
                                )}

                                {/* 상황 */}
                                <div className="mb-5">
                                    <label className="text-[13px] font-bold text-slate-600 dark:text-slate-300 tracking-wide mb-2 block">
                                        {modalConsultId ? '어떤 상황에서 실천했나요?' : '상황'}
                                    </label>
                                    <textarea
                                        value={situation}
                                        onChange={e => setSituation(e.target.value)}
                                        maxLength={200}
                                        rows={1}
                                        placeholder={modalConsultId ? '예: 저녁 식사 시간에...' : '어떤 일이 있었나요?'}
                                        onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                        className={`w-full pb-2 text-[15px] text-text-main dark:text-white bg-transparent border-b-2 focus:outline-none transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none overflow-hidden ${
                                            fieldErrors.situation ? 'border-red-300' : 'border-slate-100 dark:border-slate-800 focus:border-primary'
                                        }`}
                                    />
                                </div>

                                {/* 내 대응 / 실천 내용 */}
                                <div className="mb-5">
                                    <label className="text-[13px] font-bold text-slate-600 dark:text-slate-300 tracking-wide mb-2 block">
                                        {modalConsultId ? '실제로 어떻게 했나요?' : '내 대응'}
                                    </label>
                                    <textarea
                                        value={myAction}
                                        onChange={e => setMyAction(e.target.value)}
                                        maxLength={200}
                                        rows={1}
                                        placeholder="어떻게 반응하셨나요?"
                                        onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                        className={`w-full pb-2 text-[15px] text-text-main dark:text-white bg-transparent border-b-2 focus:outline-none transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none overflow-hidden ${
                                            fieldErrors.myAction ? 'border-red-300' : 'border-slate-100 dark:border-slate-800 focus:border-primary'
                                        }`}
                                    />
                                </div>

                                {/* 아이 반응 */}
                                <div className="mb-5">
                                    <label className="text-[13px] font-bold text-slate-600 dark:text-slate-300 tracking-wide mb-2 block">
                                        {modalConsultId ? '아이 반응은 어땠나요?' : '아이 반응'}
                                    </label>
                                    <textarea
                                        value={childReaction}
                                        onChange={e => setChildReaction(e.target.value)}
                                        maxLength={200}
                                        rows={1}
                                        placeholder="아이가 어떻게 했나요?"
                                        onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                                        className={`w-full pb-2 text-[15px] text-text-main dark:text-white bg-transparent border-b-2 focus:outline-none transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none overflow-hidden ${
                                            fieldErrors.childReaction ? 'border-red-300' : 'border-slate-100 dark:border-slate-800 focus:border-primary'
                                        }`}
                                    />
                                </div>

                                {/* 메모 + 상담 연결 */}
                                <div className="mb-7 space-y-3">
                                    <input
                                        type="text"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        maxLength={300}
                                        placeholder="메모 (선택)"
                                        className="w-full pb-2 text-[14px] text-text-sub dark:text-gray-300 bg-transparent border-b border-slate-100 dark:border-slate-800 focus:outline-none focus:border-slate-300 transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    />
                                    {recentConsults.length > 0 && (
                                        <select
                                            value={modalConsultId}
                                            onChange={e => setModalConsultId(e.target.value)}
                                            className="w-full pb-2 text-[14px] bg-transparent border-b border-slate-100 dark:border-slate-800 focus:outline-none focus:border-slate-300 transition-colors text-slate-400 dark:text-slate-500"
                                        >
                                            <option value="">처방전 연결 (선택)</option>
                                            {recentConsults.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {formatDate(c.created_at)} · {(c.problem_description || '').slice(0, 20)}...
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                            </div>

                            {/* 하단 고정 저장 버튼 */}
                            <div className="sticky bottom-0 px-7 py-4 bg-white dark:bg-background-dark border-t border-slate-100 dark:border-slate-800 ">
                                <button
                                    onClick={handleSave}
                                    disabled={isSubmitting}
                                    className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] ${
                                        isSubmitting
                                            ? 'bg-gray-100 text-gray-400'
                                            : 'bg-text-main dark:bg-white text-white dark:text-black'
                                    }`}
                                >
                                    {isSubmitting ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="h-32"></div>
                <BottomNav />
            </div>
        </div>
    );
}

/** 연결된 상담 처방전의 actionItem을 표시하는 하위 컴포넌트 */
function ConsultationLink({ consultationId }: { consultationId: string }) {
    const [actionItem, setActionItem] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('consultations')
                    .select('ai_prescription')
                    .eq('id', consultationId)
                    .single();
                if (data?.ai_prescription) {
                    const prescription = data.ai_prescription as any;
                    setActionItem(prescription.actionItem || null);
                }
            } catch {
                // 조회 실패 시 미표시
            }
        })();
    }, [consultationId]);

    if (!actionItem) return null;

    return (
        <div className="mt-4 pt-3 border-t border-secondary/10">
            <div className="text-[11px] font-bold text-secondary/70 flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-[13px]">link</span>
                연결된 처방전
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-1">{actionItem}</p>
        </div>
    );
}

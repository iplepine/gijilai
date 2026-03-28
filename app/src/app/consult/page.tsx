'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import BottomNav from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { db } from '@/lib/db';
import { getRandomExamples } from '@/data/consultExamples';

type Step = 'INPUT' | 'DIAGNOSTIC' | 'RESULT';

interface QuestionOption {
    id: string;
    text: string;
    freeText?: boolean;
}

interface Question {
    id: string;
    text: string;
    type: 'CHOICE' | 'TEXT';
    options?: QuestionOption[];
}

interface QuestionAnalysisItem {
    question: string;
    answer: string;
    analysis: string;
}

interface ActionItem {
    title: string;
    description: string;
    duration: number;
    encouragement: string;
}

interface Prescription {
    interpretation: string;
    chemistry: string;
    questionAnalysis?: QuestionAnalysisItem[];
    magicWord: string;
    actionItem?: string;
    actionItems?: ActionItem[];
    sessionTitle?: string;
}

export default function ConsultPage() {
    return (
        <Suspense>
            <ConsultContent />
        </Suspense>
    );
}

function ConsultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionIdParam = searchParams.get('sessionId');
    const { user } = useAuth();
    const { intake, cbqResponses, atqResponses, selectedChildId } = useAppStore();
    const [childName, setChildName] = useState<string | null>(intake.childName || null);
    const [childBirthDate, setChildBirthDate] = useState<string | undefined>(intake.birthDate || undefined);
    const [childGender, setChildGender] = useState<string | undefined>(intake.gender || undefined);

    // 세션 상태
    const [sessionContext, setSessionContext] = useState<any>(null);
    const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
    const [validChildId, setValidChildId] = useState<string | null>(null);
    const [childLoading, setChildLoading] = useState(true);
    const [hasChildReport, setHasChildReport] = useState(true);

    useEffect(() => {
        if (!user) { setChildLoading(false); return; }
        setChildLoading(true);
        supabase.from('children').select('id, name, birth_date, gender').eq('parent_id', user.id).then(async ({ data }) => {
            if (!data || data.length === 0) {
                setChildName(intake.childName || null);
                setValidChildId(null);
                setChildLoading(false);
            } else {
                const selected = selectedChildId ? data.find(c => c.id === selectedChildId) : data[0];
                const child = selected || data[0];
                setChildName(child.name);
                setChildBirthDate(child.birth_date);
                setChildGender(child.gender);
                setValidChildId(child.id);

                const { count } = await supabase
                    .from('reports')
                    .select('*', { count: 'exact', head: true })
                    .eq('child_id', child.id)
                    .eq('type', 'CHILD');
                setHasChildReport((count || 0) > 0);
                setChildLoading(false);
            }
        });
    }, [user, selectedChildId, intake.childName]);

    const [examples, setExamples] = useState<ReturnType<typeof getRandomExamples>>([]);
    useEffect(
        () => setExamples(getRandomExamples(childBirthDate, childGender, 5)),
        [childBirthDate, childGender]
    );

    const [step, setStep] = useState<Step>('INPUT');
    const [isLoading, setIsLoading] = useState(false);

    // INPUT STATE
    const [problemDesc, setProblemDesc] = useState('');
    const [currentTextAnswer, setCurrentTextAnswer] = useState('');
    const [freeTextOptionId, setFreeTextOptionId] = useState<string | null>(null);

    // DIAGNOSTIC STATE
    const [empathy, setEmpathy] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isFollowUpDone, setIsFollowUpDone] = useState(false);

    // RESULT STATE
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
    const [savedConsultId, setSavedConsultId] = useState<string | null>(null);

    // 기질 프로필 (초기 로드 시 1회 계산)
    const [childProfile, setChildProfile] = useState<any>(null);
    const [parentProfile, setParentProfile] = useState<any>(null);

    // 추가 상담: 세션 컨텍스트 로드
    useEffect(() => {
        if (!sessionIdParam) return;
        (async () => {
            try {
                const ctx = await db.getSessionWithConsultations(sessionIdParam);
                setSessionContext(ctx);
                setSessionId(sessionIdParam);
            } catch (e) {
                console.error('Failed to load session context:', e);
            }
        })();
    }, [sessionIdParam]);

    useEffect(() => {
        (async () => {
            const { TemperamentScorer } = await import('@/lib/TemperamentScorer');
            const { TemperamentClassifier } = await import('@/lib/TemperamentClassifier');

            let childScores: any = null;
            let parentScores: any = null;

            if (Object.keys(cbqResponses).length > 0) {
                const { CHILD_QUESTIONS } = await import('@/data/questions');
                childScores = TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses as any);
                const result = TemperamentClassifier.analyzeChild(childScores);
                setChildProfile({ label: result.label, keywords: result.keywords, description: result.desc, scores: childScores });
            }

            if (Object.keys(atqResponses).length > 0) {
                const { PARENT_QUESTIONS } = await import('@/data/questions');
                parentScores = TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses as any);
                const result = TemperamentClassifier.analyzeParent(parentScores);
                setParentProfile({ label: result.label, keywords: result.keywords, description: result.desc, scores: parentScores });
            }

        })();
    }, [cbqResponses, atqResponses]);


    const handleStartDiagnostic = async () => {
        if (!problemDesc.trim()) {
            alert('어떤 부분에서 가장 힘드셨는지 자유롭게 적어주세요.');
            return;
        }

        const fullProblem = problemDesc;

        setIsLoading(true);
        try {
            let recentObservations: any[] = [];
            if (user) {
                try {
                    recentObservations = await db.getRecentObservations(user.id, 5);
                } catch {
                    // 관찰 기록 조회 실패 시 빈 배열로 진행
                }
            }

            const res = await fetch('/api/consult/questions/initial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: fullProblem,
                    childName: childName || intake.childName,
                    childProfile,
                    parentProfile,
                    recentObservations,
                    sessionContext: sessionContext || undefined
                }),
            });

            if (!res.ok) throw new Error('Failed to fetch initial questions');

            const data = await res.json();
            setEmpathy(data.empathy);
            setQuestions(data.questions);
            setStep('DIAGNOSTIC');
            setCurrentQuestionIndex(0);
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswer = async (questionId: string, answer: string) => {
        const newAnswers = { ...answers, [questionId]: answer };
        setAnswers(newAnswers);
        setFreeTextOptionId(null);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            // Check if we need follow-up
            if (!isFollowUpDone) {
                await handleCheckFollowUp(newAnswers);
            } else {
                await handleGeneratePrescription(newAnswers);
            }
        }
    };

    const handleCheckFollowUp = async (currentAnswers: Record<string, string>) => {
        setIsLoading(true);
        try {
            const fullProblem = problemDesc;
            const res = await fetch('/api/consult/questions/followup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: fullProblem,
                    firstRoundAnswers: currentAnswers
                }),
            });

            const data = await res.json();
            if (data.needsFollowUp && data.followUpQuestions && data.followUpQuestions.length > 0) {
                setEmpathy(data.followUpReason || '조금 더 정확한 솔루션을 드리기 위해 몇 가지만 더 여쭤볼게요.');
                setQuestions(prev => [...prev, ...data.followUpQuestions]);
                setIsFollowUpDone(true);
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                await handleGeneratePrescription(currentAnswers);
            }
        } catch (error) {
            console.error(error);
            await handleGeneratePrescription(currentAnswers); // Fallback to results
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePrescription = async (allAnswers: Record<string, string>) => {
        setIsLoading(true);
        try {
            const fullProblem = problemDesc;

            let recentObservations: any[] = [];
            if (user) {
                try {
                    recentObservations = await db.getRecentObservations(user.id, 5);
                } catch {
                    // 관찰 기록 조회 실패 시 빈 배열로 진행
                }
            }

            const res = await fetch('/api/consult/prescription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: fullProblem,
                    questions: questions.map(q => ({ id: q.id, text: q.text })),
                    answers: allAnswers,
                    childProfile,
                    parentProfile,
                    childName: childName || intake.childName,
                    recentObservations,
                    sessionContext: sessionContext || undefined
                }),
            });

            if (!res.ok) throw new Error('Failed to generate prescription');

            const data = await res.json();
            setPrescription(data);
            setStep('RESULT');

            // 모든 실천 항목 기본 선택
            if (data.actionItems?.length > 0) {
                setSelectedActionIndex(null);
            }

            // 세션 + 상담 저장 (실천 항목은 CTA에서 저장)
            if (user) {
                let currentSessionId = sessionId;

                if (!currentSessionId) {
                    const { data: newSession } = await supabase
                        .from('consultation_sessions')
                        .insert({
                            user_id: user.id,
                            child_id: validChildId,
                            title: data.sessionTitle || problemDesc.substring(0, 30),
                        })
                        .select('id')
                        .single();
                    if (newSession) {
                        currentSessionId = newSession.id;
                        setSessionId(currentSessionId);
                    }
                } else {
                    await supabase
                        .from('consultation_sessions')
                        .update({ updated_at: new Date().toISOString() })
                        .eq('id', currentSessionId);
                }

                const { data: savedConsult } = await supabase.from('consultations').insert({
                    user_id: user.id,
                    child_id: validChildId,
                    session_id: currentSessionId,
                    category: '자유 입력',
                    problem_description: problemDesc,
                    ai_options: questions,
                    user_response: allAnswers,
                    selected_reaction_id: 'DYNAMIC_FLOW',
                    ai_prescription: data,
                    status: 'COMPLETED'
                }).select('id').single();

                if (savedConsult) setSavedConsultId(savedConsult.id);
            }
        } catch (error) {
            console.error(error);
            alert('처방전을 생성하는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body pb-0">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={step === 'RESULT' ? '마음 처방전' : '마음 통역소'} />

                <main className="w-full max-w-md flex flex-col flex-1 p-6 pb-36">
                    {step === 'INPUT' && childLoading && (
                        <div className="flex flex-col items-center justify-center flex-1">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && !validChildId && (
                        <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[40px] text-primary">child_care</span>
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-text-main dark:text-white">아이를 먼저 등록해주세요</h2>
                                <p className="text-sm text-text-sub dark:text-gray-400 leading-relaxed break-keep">
                                    아이의 기질에 맞는 맞춤 상담을 위해<br />아이 정보가 필요해요.
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/settings/child/new')}
                                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">person_add</span>
                                <span>아이 등록하기</span>
                            </button>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && !hasChildReport && (
                        <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[40px] text-secondary">psychology</span>
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-text-main dark:text-white">기질 검사를 먼저 해주세요</h2>
                                <p className="text-sm text-text-sub dark:text-gray-400 leading-relaxed break-keep">
                                    {childName}의 기질을 파악해야<br />맞춤 상담을 받을 수 있어요.
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/survey/intro')}
                                className="px-8 py-4 rounded-2xl bg-secondary text-white font-bold text-base shadow-xl shadow-secondary/20 active:scale-[0.98] transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">quiz</span>
                                <span>기질 검사 시작하기</span>
                            </button>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && hasChildReport && (
                        <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* 추가 상담: 이전 상담 요약 + 실천 현황 */}
                            {sessionContext && (
                                <div className="bg-secondary/5 border border-secondary/15 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-secondary">replay</span>
                                        <span className="text-[13px] font-bold text-secondary">이어서 상담 · {sessionContext.session?.title}</span>
                                    </div>
                                    {/* 지난 상담 요약 */}
                                    {sessionContext.consultations?.length > 0 && (() => {
                                        const lastConsult = sessionContext.consultations[sessionContext.consultations.length - 1];
                                        return (
                                            <div className="text-[12px] text-text-sub leading-relaxed">
                                                <span className="font-bold text-text-main dark:text-white">지난 상담:</span> {lastConsult.problem_description?.substring(0, 60)}{lastConsult.problem_description?.length > 60 ? '...' : ''}
                                            </div>
                                        );
                                    })()}
                                    {/* 실천 현황 */}
                                    {sessionContext.practices?.length > 0 && (
                                        <div className="space-y-1.5">
                                            {sessionContext.practices.map((p: any) => {
                                                const doneDays = (sessionContext.logs || []).filter((l: any) => l.practice_id === p.id && l.done).length;
                                                return (
                                                    <div key={p.id} className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-secondary/10 rounded-full overflow-hidden">
                                                            <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.round((doneDays / p.duration) * 100)}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-secondary shrink-0">{p.title} {doneDays}/{p.duration}일</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-text-main dark:text-white leading-tight">
                                    {childName ? `${childName} 양육자님,` : '양육자님,'}<br />{sessionContext ? '이번에는 어떤 일이 있으셨나요?' : '오늘 어떤 일이 가장 힘드셨나요?'}
                                </h2>
                                <p className="text-sm text-text-sub dark:text-gray-400">{sessionContext ? '이전 상담 내용을 참고해서 더 깊은 솔루션을 드릴게요.' : '아이의 기질에 딱 맞는 솔루션을 찾아드릴게요.'}</p>
                            </div>

                            <div>
                                {!sessionContext && (
                                    <>
                                        <p className="text-[12px] text-text-sub dark:text-gray-500 mb-2">비슷한 고민을 눌러보세요</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {examples.map(ex => (
                                                <button
                                                    key={ex.label}
                                                    onClick={() => setProblemDesc(ex.text)}
                                                    className={`px-3 py-2 rounded-xl text-[13px] transition-all border active:scale-95 shadow-sm ${
                                                        problemDesc === ex.text
                                                            ? 'bg-primary/10 text-primary border-primary/30 font-bold'
                                                            : 'bg-white dark:bg-surface-dark text-text-sub border-primary/10 hover:border-primary/30 hover:bg-primary/5'
                                                    }`}
                                                >
                                                    {ex.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <textarea
                                    value={problemDesc}
                                    onChange={(e) => setProblemDesc(e.target.value.slice(0, 500))}
                                    maxLength={500}
                                    placeholder={sessionContext ? "실천하면서 느낀 점이나\n새로운 고민을 적어주세요..." : "아침에 어린이집에 가야 하는데\n옷을 안 입겠다며 30분째 울었어요.\n결국 화를 내고 말았네요..."}
                                    className="w-full h-48 p-5 text-[15px] leading-relaxed rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && hasChildReport && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30">
                            <button
                                onClick={handleStartDiagnostic}
                                disabled={!problemDesc.trim() || isLoading}
                                className={`w-full py-5 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${!problemDesc.trim() || isLoading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary-dark shadow-xl shadow-primary/20'
                                    }`}
                            >
                                <span>상담 시작하기</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </button>
                        </div>
                    )}

                    {step === 'DIAGNOSTIC' && currentQuestion && (
                        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Empathy Box */}
                            {empathy && (
                                <div className="bg-secondary/10 rounded-3xl p-6 border border-secondary/20 relative animate-in zoom-in-95 duration-700">
                                    <div className="absolute -top-3 left-6 bg-secondary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">상담사 아이나</div>
                                    <p className="text-[14px] text-text-main dark:text-white leading-relaxed font-medium">
                                        {empathy}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {currentQuestionIndex > 0 && (
                                            <button
                                                onClick={() => {
                                                    setCurrentQuestionIndex(prev => prev - 1);
                                                    setFreeTextOptionId(null);
                                                    setCurrentTextAnswer('');
                                                }}
                                                className="p-1.5 -ml-1.5 rounded-full hover:bg-primary/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px] text-primary">arrow_back</span>
                                            </button>
                                        )}
                                        <span className="text-[11px] font-black text-primary uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {questions.map((_, i) => (
                                            <div key={i} className={`w-4 h-1 rounded-full transition-all ${i <= currentQuestionIndex ? 'bg-primary' : 'bg-primary/10'}`}></div>
                                        ))}
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-text-main dark:text-white leading-snug">
                                    {currentQuestion.text}
                                </h2>
                            </div>

                            {currentQuestion.type === 'CHOICE' ? (
                                <div className="flex flex-col gap-3">
                                    {currentQuestion.options?.map((opt, i) => (
                                        <div key={opt.id || `${currentQuestion.id}-opt-${i}`}>
                                            <button
                                                onClick={() => {
                                                    if (opt.freeText) {
                                                        setFreeTextOptionId(freeTextOptionId === opt.id ? null : opt.id);
                                                        setCurrentTextAnswer('');
                                                    } else {
                                                        setFreeTextOptionId(null);
                                                        handleAnswer(currentQuestion.id, opt.text);
                                                    }
                                                }}
                                                className={`w-full text-left p-5 rounded-[1.5rem] border-2 transition-all active:scale-[0.98] group ${
                                                    freeTextOptionId === opt.id
                                                        ? 'border-secondary bg-secondary/5'
                                                        : 'border-primary/5 bg-white dark:bg-surface-dark hover:border-secondary hover:bg-secondary/5'
                                                }`}
                                            >
                                                <div className="font-bold leading-relaxed text-[15px] text-text-main dark:text-white group-hover:text-secondary">
                                                    {opt.text}
                                                </div>
                                            </button>
                                            {opt.freeText && freeTextOptionId === opt.id && (
                                                <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <textarea
                                                        ref={(el) => {
                                                            if (el) {
                                                                el.focus();
                                                                setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                                            }
                                                        }}
                                                        className="w-full h-32 p-5 text-[15px] rounded-3xl border border-secondary/30 focus:outline-none focus:ring-4 focus:ring-secondary/10 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all"
                                                        placeholder="자유롭게 적어주세요."
                                                        value={currentTextAnswer}
                                                        onChange={(e) => setCurrentTextAnswer(e.target.value.slice(0, 300))}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (currentTextAnswer.trim()) {
                                                                handleAnswer(currentQuestion.id, currentTextAnswer);
                                                                setCurrentTextAnswer('');
                                                                setFreeTextOptionId(null);
                                                            } else {
                                                                alert('답변을 입력해주세요.');
                                                            }
                                                        }}
                                                        className="w-full py-4 rounded-2xl bg-primary text-white font-bold transition-all active:scale-95"
                                                    >
                                                        다음으로
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        className="w-full h-40 p-5 text-[15px] rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                        placeholder="자유롭게 적어주세요."
                                        value={currentTextAnswer}
                                        onChange={(e) => setCurrentTextAnswer(e.target.value.slice(0, 300))}
                                    />
                                    <button
                                        onClick={() => {
                                            if (currentTextAnswer.trim()) {
                                                handleAnswer(currentQuestion.id, currentTextAnswer);
                                                setCurrentTextAnswer('');
                                            } else {
                                                alert('답변을 입력해주세요.');
                                            }
                                        }}
                                        className="w-full py-4 rounded-2xl bg-primary text-white font-bold transition-all active:scale-95"
                                    >
                                        다음으로
                                    </button>
                                </div>
                            )}

                        </div>
                    )}

                    {step === 'RESULT' && prescription && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* 날짜 · 이름 뱃지 */}
                            <span className="text-[12px] font-bold text-[#D08B5B] bg-[#D08B5B]/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {new Date().toLocaleDateString('ko-KR')}
                                {childName && <span className="ml-1 opacity-70">· {childName}</span>}
                            </span>

                            {/* 그날의 고민 */}
                            <div className="bg-[#FFFDF9] dark:bg-surface-dark border border-[#EACCA4]/40 rounded-2xl p-5">
                                <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5 mb-2">
                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                    그날의 고민
                                </div>
                                <p className="text-[14px] text-text-main dark:text-white leading-relaxed">
                                    &ldquo;{problemDesc}&rdquo;
                                </p>
                            </div>

                            {/* 문진 해설 */}
                            {prescription.questionAnalysis && prescription.questionAnalysis.length > 0 && (
                                <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-[#EACCA4]/30 space-y-3">
                                    <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px]">quiz</span>
                                        문진 해설
                                    </div>
                                    {prescription.questionAnalysis.map((item, i) => (
                                        <div key={i} className="space-y-1">
                                            <p className="text-[11px] text-text-sub dark:text-gray-500">Q. {item.question}</p>
                                            <p className="text-[12px] font-medium text-text-main dark:text-gray-200 pl-3 border-l-2 border-secondary/40">{item.answer}</p>
                                            <p className="text-[12px] text-[#D08B5B] leading-relaxed">{item.analysis}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 마음 처방전 */}
                            <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-secondary/20 space-y-4">
                                <div className="text-[12px] font-bold text-secondary flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] fill-1">vaccines</span>
                                    마음 처방전
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 mb-1">
                                        {childName ? `${childName}의 속마음` : '아이의 속마음'}
                                    </div>
                                    <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                        {prescription.interpretation}
                                    </p>
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400 mb-1">아이와 나</div>
                                    <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                        {prescription.chemistry}
                                    </p>
                                </div>
                            </div>

                            {/* 오늘의 한마디 (고정, 선택 아님) */}
                            {prescription.magicWord && (
                                <div className="bg-[#519E8A] rounded-2xl p-5 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                            <span className="text-[14px] font-black">오늘의 한마디</span>
                                        </div>
                                        <p className="text-[16px] font-bold leading-relaxed">
                                            &ldquo;{prescription.magicWord}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* 실천 항목 선택 */}
                            {prescription.actionItems && prescription.actionItems.length > 0 && (
                                <div className="space-y-4 mt-10 pt-8 border-t border-beige-main/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[18px] text-primary">checklist</span>
                                        </div>
                                        <div>
                                            <p className="text-[16px] font-black text-text-main dark:text-white">아이나가 제안하는 실천 항목</p>
                                            <p className="text-[12px] text-text-sub">실천할 항목을 골라보세요</p>
                                        </div>
                                    </div>
                                    {prescription.actionItems.map((item, i) => {
                                        const isSelected = selectedActionIndex === i;
                                        return (
                                            <button key={i} type="button" onClick={() => setSelectedActionIndex(isSelected ? null : i)} className={`w-full text-left rounded-2xl p-5 border-2 transition-all active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/5' : 'border-beige-main/20 bg-white dark:bg-surface-dark'}`}>
                                                <div className="flex items-start gap-3">
                                                    <span className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 transition-colors ${isSelected ? 'text-primary fill-1' : 'text-gray-300'}`}>
                                                        {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                                                    </span>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[15px] font-bold text-text-main dark:text-white">{item.title}</p>
                                                            <span className="text-[11px] font-bold text-text-sub bg-beige-main/15 px-2 py-0.5 rounded-full shrink-0">{item.duration}일</span>
                                                        </div>
                                                        <p className="text-[13px] text-text-sub leading-relaxed">{item.description}</p>
                                                        <p className="text-[12px] text-secondary font-medium">{item.encouragement || `${item.duration}일 동안 해보세요`}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 다음 행동 유도 */}
                            <div className="space-y-3 mt-2">
                                <button
                                    onClick={async () => {
                                        if (user && sessionId && savedConsultId && prescription?.actionItems && selectedActionIndex !== null) {
                                            const item = prescription.actionItems[selectedActionIndex];
                                            await supabase.from('practice_items').insert({
                                                session_id: sessionId,
                                                consultation_id: savedConsultId,
                                                title: item.title,
                                                description: item.description,
                                                duration: item.duration,
                                                encouragement: item.encouragement || null,
                                            });
                                        }
                                        router.push('/practices');
                                    }}
                                    disabled={selectedActionIndex === null}
                                    className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] ${selectedActionIndex !== null ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {selectedActionIndex !== null ? '실천 시작하기' : '실천 항목을 선택해주세요'}
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full py-3 text-[14px] font-bold text-text-sub transition-all active:scale-[0.98]"
                                >
                                    다음에 할게요
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="fixed inset-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-6 px-8">
                            <div className="w-10 h-10 rounded-full border-3 border-primary/15 border-t-primary animate-spin"></div>

                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-text-main dark:text-white">
                                    {step === 'INPUT' ? '질문을 준비하고 있어요' : '마음을 번역하고 있어요'}
                                </p>
                                <p className="text-sm text-text-sub dark:text-gray-400">
                                    {step === 'INPUT' ? '더 좋은 상담을 위해 잠시만 기다려주세요' : '아이의 마음에 맞는 처방전을 만들고 있어요'}
                                </p>
                            </div>

                            {problemDesc && (
                                <div className="w-full max-w-sm bg-white/60 dark:bg-surface-dark/60 rounded-2xl p-5 border border-primary/10 mt-2">
                                    <p className="text-[11px] font-bold text-text-sub dark:text-gray-500 mb-2 uppercase tracking-wider">상담 내용</p>
                                    <p className="text-[14px] text-text-main dark:text-gray-200 leading-relaxed line-clamp-4">{problemDesc}</p>
                                </div>
                            )}

                            <div className="w-48 h-1.5 bg-primary/10 rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full animate-progress"></div>
                            </div>
                        </div>
                    )}
                </main>

                {/* 앱 다운로드 유도 섹션 (결과 확인 후) */}
                {step === 'RESULT' && (
                    <div className="px-6 pb-36">
                        <div className="bg-secondary/10 dark:bg-secondary/20 rounded-[2.5rem] p-8 text-center relative overflow-hidden border border-secondary/20">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 blur-3xl rounded-full"></div>
                            <p className="text-text-main dark:text-white font-bold text-sm mb-4 relative z-10">아이나의 알림과 함께라면<br />실천이 더 쉬워져요</p>
                            <Button
                                size="sm"
                                variant="primary"
                                className="w-full rounded-xl bg-secondary text-white h-12 font-black shadow-lg shadow-secondary/20 relative z-10"
                                onClick={() => window.open('https://aina.garden/app', '_blank')}
                            >
                                앱 설치하고 푸시 알림 받기
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

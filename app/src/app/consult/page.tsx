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
import { getFeatureAccess } from '@/lib/access';
import { getRandomExamples } from '@/data/consultExamples';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';

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
    trigger?: string;
    action?: string;
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
    const { t, locale } = useLocale();
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

    // 구독/트라이얼 상태
    const [hasSubscription, setHasSubscription] = useState(false);
    const access = getFeatureAccess({ userCreatedAt: user?.created_at, hasSubscription });
    const trial = access.trial;
    const hasFullAccess = access.hasFullAccess;
    useEffect(() => {
        if (!user) return;
        db.getActiveSubscription(user.id).catch(() => null).then(sub => {
            setHasSubscription(!!sub);
        });
    }, [user]);

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
        if (!hasFullAccess) {
            router.push('/pricing');
            return;
        }

        if (!problemDesc.trim()) {
            alert(t('consult.pleaseDescribeProblem'));
            return;
        }

        const fullProblem = problemDesc;
        trackEvent('consult_started', {
            has_child_report: hasChildReport,
            has_subscription: hasSubscription,
            is_followup: !!sessionIdParam,
        });

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
                    childBirthDate: childBirthDate || intake.birthDate,
                    childGender: childGender || intake.gender,
                    childProfile,
                    parentProfile,
                    recentObservations,
                    sessionContext: sessionContext || undefined
                }),
            });

            if (res.status === 402 || res.status === 403) {
                router.push('/pricing');
                return;
            }
            if (!res.ok) throw new Error('Failed to fetch initial questions');

            const data = await res.json();
            setEmpathy(data.empathy);
            setQuestions(data.questions);
            setStep('DIAGNOSTIC');
            setCurrentQuestionIndex(0);
        } catch (error) {
            console.error(error);
            alert(t('consult.errorRetry'));
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
        if (!hasFullAccess) {
            router.push('/pricing');
            return;
        }
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

            if (res.status === 402 || res.status === 403) {
                router.push('/pricing');
                return;
            }

            const data = await res.json();
            if (data.needsFollowUp && data.followUpQuestions && data.followUpQuestions.length > 0) {
                setEmpathy(data.followUpReason || t('consult.followUpDefault'));
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
        if (!hasFullAccess) {
            router.push('/pricing');
            return;
        }
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
                    childBirthDate: childBirthDate || intake.birthDate,
                    childGender: childGender || intake.gender,
                    recentObservations,
                    sessionContext: sessionContext || undefined
                }),
            });

            if (res.status === 402 || res.status === 403) {
                router.push('/pricing');
                return;
            }
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
            alert(t('consult.prescriptionError'));
        } finally {
            setIsLoading(false);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body pb-0">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar title={step === 'RESULT' ? t('consult.heartPrescription') : t('consult.heartInterpreterStation')} />

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
                                <h2 className="text-xl font-bold text-text-main dark:text-white">{t('consult.registerChildFirst')}</h2>
                                <p className="text-sm text-text-sub dark:text-gray-400 leading-relaxed break-keep whitespace-pre-line">
                                    {t('consult.registerChildDesc')}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/settings/child/new')}
                                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-base shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">person_add</span>
                                <span>{t('consult.registerChildBtn')}</span>
                            </button>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && !hasChildReport && (
                        <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[40px] text-secondary">psychology</span>
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-text-main dark:text-white">{t('consult.doSurveyFirst')}</h2>
                                <p className="text-sm text-text-sub dark:text-gray-400 leading-relaxed break-keep whitespace-pre-line">
                                    {t('consult.doSurveyDesc', { name: childName || '' })}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/survey/intro')}
                                className="px-8 py-4 rounded-2xl bg-secondary text-white font-bold text-base shadow-xl shadow-secondary/20 active:scale-[0.98] transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[20px]">quiz</span>
                                <span>{t('consult.startSurveyBtn')}</span>
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
                                        <span className="text-[13px] font-bold text-secondary">{t('consult.continueConsult', { title: sessionContext.session?.title || '' })}</span>
                                    </div>
                                    {/* 지난 상담 요약 */}
                                    {sessionContext.consultations?.length > 0 && (() => {
                                        const lastConsult = sessionContext.consultations[sessionContext.consultations.length - 1];
                                        return (
                                            <div className="text-[12px] text-text-sub leading-relaxed">
                                                <span className="font-bold text-text-main dark:text-white">{t('consult.lastConsult')}</span> {lastConsult.problem_description?.substring(0, 60)}{lastConsult.problem_description?.length > 60 ? '...' : ''}
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
                                                        <span className="text-[11px] font-bold text-secondary shrink-0">{p.title} {doneDays}/{p.duration}{t('common.days')}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-text-main dark:text-white leading-tight">
                                    {childName ? t('consult.greetingWithName', { name: childName }) : t('consult.greetingDefault')}<br />{sessionContext ? t('consult.questionContinue') : t('consult.questionFirst')}
                                </h2>
                                <p className="text-sm text-text-sub dark:text-gray-400">{sessionContext ? t('consult.subtitleContinue') : t('consult.subtitleFirst')}</p>
                            </div>

                            <div>
                                {!sessionContext && (
                                    <>
                                        <p className="text-[12px] text-text-sub dark:text-gray-500 mb-2">{t('consult.exampleHint')}</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {examples.map(ex => (
                                                <button
                                                    key={ex.label}
                                                    onClick={() => setProblemDesc(prev => prev ? `${prev}\n${ex.text}` : ex.text)}
                                                    className={`px-3 py-2 rounded-xl text-[13px] transition-all border active:scale-95 shadow-sm ${
                                                        problemDesc.includes(ex.text)
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
                                    placeholder={sessionContext ? t('consult.textareaPlaceholderContinue') : t('consult.textareaPlaceholderFirst')}
                                    className="w-full h-48 p-5 text-[15px] leading-relaxed rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                />
                                <div className="flex items-center justify-between mt-2 px-1">
                                    <p className={`text-[12px] transition-opacity duration-300 ${
                                        problemDesc.length > 0 && problemDesc.length < 30
                                            ? 'text-text-sub dark:text-gray-500 opacity-100'
                                            : 'opacity-0'
                                    }`}>
                                        {t('consult.moreDetailHint')}
                                    </p>
                                    <span className={`text-[11px] tabular-nums ${
                                        problemDesc.length >= 500 ? 'text-red-400' : 'text-text-muted dark:text-gray-500'
                                    }`}>
                                        {problemDesc.length}/500
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && hasChildReport && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20 z-30">
                            {!hasFullAccess && (
                                <p className="text-center text-xs font-medium mb-3 text-text-sub dark:text-gray-400">
                                    {t('consult.trialExpired')} <button onClick={() => router.push('/pricing')} className="text-primary font-bold underline underline-offset-2">{t('consult.subscribeCta')}</button>
                                </p>
                            )}
                            {trial?.isActive && !hasSubscription && trial.daysRemaining <= 2 && (
                                <p className="text-center text-xs font-medium mb-3 text-secondary">
                                    {t('consult.trialDaysRemaining', { days: trial.daysRemaining })}
                                </p>
                            )}
                            <button
                                onClick={hasFullAccess ? handleStartDiagnostic : () => router.push('/pricing')}
                                disabled={(hasFullAccess && problemDesc.trim().length < 30) || isLoading}
                                className={`w-full py-5 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${((hasFullAccess && problemDesc.trim().length < 30) || isLoading)
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary-dark shadow-xl shadow-primary/20'
                                    }`}
                            >
                                <span>{hasFullAccess ? t('consult.startConsult') : t('consult.subscribeCta')}</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </button>
                        </div>
                    )}

                    {step === 'DIAGNOSTIC' && currentQuestion && (
                        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Empathy Box */}
                            {empathy && (
                                <div className="bg-secondary/10 rounded-3xl p-6 border border-secondary/20 relative animate-in zoom-in-95 duration-700">
                                    <div className="absolute -top-3 left-6 bg-secondary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">{t('consult.consultantName')}</div>
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
                                        <span className="text-[11px] font-bold text-primary tracking-wide">{currentQuestionIndex + 1} / {questions.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {questions.map((_, i) => (
                                                <div key={i} className={`w-4 h-1 rounded-full transition-all ${i <= currentQuestionIndex ? 'bg-primary' : 'bg-primary/10'}`}></div>
                                            ))}
                                        </div>
                                        {currentQuestionIndex >= questions.length - 2 && (
                                            <span className="text-[10px] text-primary/60 font-medium">{t('survey.almostDone')}</span>
                                        )}
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
                                                        placeholder={t('consult.freeTextPlaceholder')}
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
                                                                alert(t('consult.pleaseEnterAnswer'));
                                                            }
                                                        }}
                                                        className="w-full py-4 rounded-2xl bg-primary text-white font-bold transition-all active:scale-95"
                                                    >
                                                        {t('consult.nextButton')}
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
                                        placeholder={t('consult.freeTextPlaceholder')}
                                        value={currentTextAnswer}
                                        onChange={(e) => setCurrentTextAnswer(e.target.value.slice(0, 300))}
                                    />
                                    <button
                                        onClick={() => {
                                            if (currentTextAnswer.trim()) {
                                                handleAnswer(currentQuestion.id, currentTextAnswer);
                                                setCurrentTextAnswer('');
                                            } else {
                                                alert(t('consult.pleaseEnterAnswer'));
                                            }
                                        }}
                                        className="w-full py-4 rounded-2xl bg-primary text-white font-bold transition-all active:scale-95"
                                    >
                                        {t('consult.nextButton')}
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
                                {new Date().toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                                {childName && <span className="ml-1 opacity-70">· {childName}</span>}
                            </span>

                            {/* 1. 도입 — 아이의 마음 지도 (공감 선행 + 속마음) */}
                            <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-secondary/20 space-y-4">
                                <div className="text-[12px] font-bold text-secondary flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] fill-1">favorite</span>
                                    {childName ? t('consult.heartMapTitle', { name: childName }) : t('consult.heartMapTitleDefault')}
                                </div>
                                <div className="bg-[#FFFDF9] dark:bg-background-dark rounded-xl p-4">
                                    <p className="text-[13px] text-text-sub dark:text-gray-400 leading-relaxed italic mb-2">
                                        &ldquo;{problemDesc.length > 80 ? problemDesc.slice(0, 80) + '...' : problemDesc}&rdquo;
                                    </p>
                                </div>
                                <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                    {prescription.interpretation}
                                </p>
                            </div>

                            {/* 2. 문진 해설 */}
                            {prescription.questionAnalysis && prescription.questionAnalysis.length > 0 && (
                                <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-[#EACCA4]/30 space-y-3">
                                    <div className="text-[12px] font-bold text-[#D08B5B] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px]">quiz</span>
                                        {t('consult.questionAnalysis')}
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

                            {/* 3. 피크 — 아이와 나 (기질 궁합 분석) */}
                            <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-secondary/20 space-y-3">
                                <div className="text-[12px] font-bold text-secondary flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] fill-1">vaccines</span>
                                    {t('consult.heartSignal')}
                                </div>
                                <p className="text-[13px] text-text-main dark:text-gray-200 leading-relaxed">
                                    {prescription.chemistry}
                                </p>
                            </div>

                            {/* 4. 오늘의 한마디 */}
                            {prescription.magicWord && (
                                <div className="bg-[#519E8A] rounded-2xl p-5 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                            <span className="text-[14px] font-black">{t('consult.magicWord')}</span>
                                        </div>
                                        <p className="text-[16px] font-bold leading-relaxed">
                                            &ldquo;{prescription.magicWord}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* 5. 실천 항목 선택 */}
                            {prescription.actionItems && prescription.actionItems.length > 0 && (
                                <div className="space-y-4 mt-10 pt-8 border-t border-beige-main/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[18px] text-primary">checklist</span>
                                        </div>
                                        <div>
                                            <p className="text-[16px] font-black text-text-main dark:text-white">{t('consult.actionItemsTitle')}</p>
                                            <p className="text-[12px] text-text-sub">{t('consult.actionItemsHint')}</p>
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
                                                            <span className="text-[11px] font-bold text-text-sub bg-beige-main/15 px-2 py-0.5 rounded-full shrink-0">{item.duration}{t('common.days')}</span>
                                                        </div>
                                                        {item.trigger && item.action && (
                                                            <div className="flex flex-col gap-1 text-[12px]">
                                                                <span className="text-secondary font-bold">IF <span className="font-normal text-text-main dark:text-gray-200">{item.trigger}</span></span>
                                                                <span className="text-primary font-bold">THEN <span className="font-normal text-text-main dark:text-gray-200">{item.action}</span></span>
                                                            </div>
                                                        )}
                                                        <p className="text-[13px] text-text-sub leading-relaxed">{item.description}</p>
                                                        <p className="text-[12px] text-secondary font-medium">{item.encouragement || t('consult.tryDaysDefault', { days: item.duration })}</p>
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
                                            const fullDescription = item.trigger && item.action
                                                ? `[IF] ${item.trigger}\n[THEN] ${item.action}\n\n${item.description}`
                                                : item.description;
                                            await supabase.from('practice_items').insert({
                                                session_id: sessionId,
                                                consultation_id: savedConsultId,
                                                title: item.title,
                                                description: fullDescription,
                                                duration: item.duration,
                                                encouragement: item.encouragement || null,
                                            });
                                        }
                                        router.push('/practices');
                                    }}
                                    disabled={selectedActionIndex === null}
                                    className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] ${selectedActionIndex !== null ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {selectedActionIndex !== null ? t('consult.startPractice') : t('consult.selectActionItem')}
                                </button>
                                <button
                                    onClick={() => router.push('/')}
                                    className="w-full py-3 text-[14px] font-bold text-text-sub transition-all active:scale-[0.98]"
                                >
                                    {t('consult.doLater')}
                                </button>
                            </div>

                            {/* 6. 엔드 — 따뜻한 격려 */}
                            <div className="text-center py-6 space-y-2">
                                <p className="text-[14px] text-text-main dark:text-gray-200 font-medium leading-relaxed">
                                    {childName ? t('consult.encouragementWithName', { name: childName }) : t('consult.encouragementDefault')}
                                </p>
                                <p className="text-[12px] text-text-sub dark:text-gray-500">
                                    {t('consult.aiDisclaimer')}
                                </p>
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="fixed inset-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-6 px-8">
                            <div className="w-10 h-10 rounded-full border-3 border-primary/15 border-t-primary animate-spin"></div>

                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-text-main dark:text-white">
                                    {step === 'INPUT' ? (childName ? t('consult.analyzingTemperament', { name: childName }) : t('consult.analyzingTemperamentDefault')) : t('consult.translatingHeart')}
                                </p>
                                <p className="text-sm text-text-sub dark:text-gray-400">
                                    {step === 'INPUT' ? t('consult.preparingQuestions') : t('consult.creatingPrescription')}
                                </p>
                            </div>

                            {problemDesc && (
                                <div className="w-full max-w-sm bg-white/60 dark:bg-surface-dark/60 rounded-2xl p-5 border border-primary/10 mt-2">
                                    <p className="text-[11px] font-bold text-text-sub dark:text-gray-500 mb-2 uppercase tracking-wider">{t('consult.consultContent')}</p>
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
                            <p className="text-text-main dark:text-white font-bold text-sm mb-4 relative z-10 whitespace-pre-line">{t('consult.appDownloadHint')}</p>
                            <Button
                                size="sm"
                                variant="primary"
                                className="w-full rounded-xl bg-secondary text-white h-12 font-black shadow-lg shadow-secondary/20 relative z-10"
                                onClick={() => window.open('https://aina.garden/app', '_blank')}
                            >
                                {t('consult.appInstallPush')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

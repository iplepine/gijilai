'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import BottomNav from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/layout/Navbar';
import { db } from '@/lib/db';

type Step = 'INPUT' | 'DIAGNOSTIC' | 'RESULT';

interface Question {
    id: string;
    text: string;
    type: 'CHOICE' | 'TEXT';
    options?: { id: string; text: string }[];
}

interface Prescription {
    interpretation: string;
    chemistry: string;
    magicWord: string;
    actionItem: string;
}

// 자유 입력 도우미 키워드
const CATEGORIES = [
    '아침마다 전쟁이에요', '밥을 잘 안 먹어요', '밤에 잠을 안 자려 해요',
    '동생이랑 자꾸 싸워요', '밖에서 통제가 안 돼요'
];

export default function ConsultPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { intake, cbqResponses, atqResponses } = useAppStore();

    const [step, setStep] = useState<Step>('INPUT');
    const [isLoading, setIsLoading] = useState(false);

    // INPUT STATE
    const [problemDesc, setProblemDesc] = useState('');
    const [currentTextAnswer, setCurrentTextAnswer] = useState('');

    // DIAGNOSTIC STATE
    const [empathy, setEmpathy] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isFollowUpDone, setIsFollowUpDone] = useState(false);

    // RESULT STATE
    const [prescription, setPrescription] = useState<Prescription | null>(null);

    // 기질 프로필 (초기 로드 시 1회 계산)
    const [childProfile, setChildProfile] = useState<any>(null);
    const [parentProfile, setParentProfile] = useState<any>(null);
    const [harmonyAnalysis, setHarmonyAnalysis] = useState<any>(null);

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

            if (childScores && parentScores) {
                setHarmonyAnalysis(TemperamentClassifier.analyzeHarmony(childScores, parentScores));
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
                    childName: intake.childName,
                    childProfile,
                    parentProfile,
                    harmonyAnalysis,
                    recentObservations
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
                    answers: allAnswers,
                    childProfile,
                    parentProfile,
                    harmonyAnalysis,
                    recentObservations
                }),
            });

            if (!res.ok) throw new Error('Failed to generate prescription');

            const data = await res.json();
            setPrescription(data);
            setStep('RESULT');

            // Save history
            if (user) {
                const { data: children } = await supabase.from('children').select('id').eq('parent_id', user.id).limit(1);
                const childId = children?.[0]?.id || null;

                await supabase.from('consultations').insert({
                    user_id: user.id,
                    child_id: childId,
                    category: '자유 입력',
                    problem_description: problemDesc,
                    ai_options: questions,
                    user_response: allAnswers,
                    selected_reaction_id: 'DYNAMIC_FLOW',
                    ai_prescription: data,
                    status: 'COMPLETED'
                });
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
                <Navbar title="마음 통역소" />

                <main className="w-full max-w-md flex flex-col flex-1 p-6 pb-24">
                    {step === 'INPUT' && (
                        <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-text-main dark:text-white leading-tight">
                                    {intake.childName ? `${intake.childName} 양육자님,` : '양육자님,'}<br />오늘 어떤 일이 가장 힘드셨나요?
                                </h2>
                                <p className="text-sm text-text-sub dark:text-gray-400">아이의 기질에 딱 맞는 솔루션을 찾아드릴게요.</p>
                            </div>

                            <div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setProblemDesc(prev => prev ? `${prev} ${cat}` : cat)}
                                            className="px-3 py-2 rounded-xl text-[13px] font-bold transition-all border bg-white dark:bg-surface-dark text-text-sub border-primary/10 hover:border-primary/30 hover:bg-primary/5 active:scale-95 shadow-sm"
                                        >
                                            + {cat}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={problemDesc}
                                    onChange={(e) => setProblemDesc(e.target.value)}
                                    placeholder="자유롭게 적어주세요.&#10;예: 아침에 어린이집에 가야 하는데 옷을 안 입겠다며 30분째 울었어요. 결국 화를 내고 말았네요..."
                                    className="w-full h-48 p-5 text-[15px] leading-relaxed rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                />
                            </div>

                            <button
                                onClick={handleStartDiagnostic}
                                disabled={!problemDesc.trim() || isLoading}
                                className={`w-full py-5 rounded-2xl text-white font-bold text-lg mt-4 transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${!problemDesc.trim() || isLoading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary-dark shadow-xl shadow-primary/20'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>상황 분석 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>상담 시작하기</span>
                                        <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'DIAGNOSTIC' && currentQuestion && (
                        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Empathy Box */}
                            {currentQuestionIndex === 0 && empathy && (
                                <div className="bg-secondary/10 rounded-3xl p-6 border border-secondary/20 relative animate-in zoom-in-95 duration-700">
                                    <div className="absolute -top-3 left-6 bg-secondary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">상담사 아이나</div>
                                    <p className="text-[14px] text-text-main dark:text-white leading-relaxed font-medium">
                                        {empathy}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">Question {currentQuestionIndex + 1} / {questions.length}</span>
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
                                    {currentQuestion.options?.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleAnswer(currentQuestion.id, opt.text)}
                                            className="w-full text-left p-5 rounded-[1.5rem] border-2 border-primary/5 bg-white dark:bg-surface-dark hover:border-secondary hover:bg-secondary/5 transition-all active:scale-[0.98] group"
                                        >
                                            <div className="font-bold leading-relaxed text-[15px] text-text-main dark:text-white group-hover:text-secondary">
                                                {opt.text}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        className="w-full h-40 p-5 text-[15px] rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                        placeholder="자유롭게 적어주세요."
                                        value={currentTextAnswer}
                                        onChange={(e) => setCurrentTextAnswer(e.target.value)}
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

                            {isLoading && (
                                <div className="fixed inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <p className="font-bold text-primary">아이나가 마음을 번역 중입니다...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'RESULT' && prescription && (
                        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex flex-col items-center text-center py-4">
                                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-secondary text-3xl fill-1">verified_user</span>
                                </div>
                                <h2 className="text-2xl font-bold text-text-main dark:text-white">오늘의 마음 처방전</h2>
                                <p className="text-sm text-text-sub mt-2">{intake.childName ? `${intake.childName}의` : '아이의'} 기질과 상황을 종합한 최선의 솔루션입니다.</p>
                            </div>

                            <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-card border border-primary/5 dark:border-white/5 flex flex-col gap-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-secondary">
                                        <span className="material-symbols-outlined text-xl">psychology</span>
                                        <span className="font-bold text-sm tracking-tight">{intake.childName ? `${intake.childName}의 속마음 통역` : '아이의 속마음 통역'}</span>
                                    </div>
                                    <div className="text-[15px] text-text-main dark:text-gray-200 leading-relaxed bg-secondary/5 p-5 rounded-2xl border border-secondary/10">
                                        {prescription.interpretation}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-primary dark:text-primary-light">
                                        <span className="material-symbols-outlined text-xl">diversity_2</span>
                                        <span className="font-bold text-sm tracking-tight">아이와 나</span>
                                    </div>
                                    <div className="text-[15px] text-text-main dark:text-gray-200 leading-relaxed bg-primary/5 p-5 rounded-2xl border border-primary/10">
                                        {prescription.chemistry}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-teal-600">
                                        <span className="material-symbols-outlined text-xl">auto_awesome</span>
                                        <span className="font-bold text-sm tracking-tight">마법의 한마디</span>
                                    </div>
                                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-2xl shadow-lg shadow-teal-500/20">
                                        <span className="font-bold text-white leading-relaxed text-[16px]">
                                            "{prescription.magicWord}"
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-primary dark:bg-primary-dark rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden mt-4">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4 opacity-90">
                                        <span className="material-symbols-outlined text-xl">task_alt</span>
                                        <span className="text-xs font-bold uppercase tracking-widest">Daily Mission</span>
                                    </div>
                                    <div className="font-bold text-[15px] leading-relaxed mb-8">
                                        {prescription.actionItem}
                                    </div>
                                    <button
                                        onClick={() => router.replace('/')}
                                        className="w-full bg-white text-primary font-bold py-4 rounded-2xl hover:bg-beige-light transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span>홈으로 돌아가기</span>
                                        <span className="material-symbols-outlined text-[20px]">home</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* 앱 다운로드 유도 섹션 (결과 확인 후) */}
                {step === 'RESULT' && (
                    <div className="px-6 pb-20">
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
                <BottomNav />
            </div>
        </div>
    );
}

'use client';

import { Suspense, useCallback, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { TabLoadingIndicator } from '@/components/ui/TabLoadingIndicator';
import { TemperamentLoadingState } from '@/components/ui/TemperamentLoadingState';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { Navbar } from '@/components/layout/Navbar';
import { db, ObservationData, PracticeItemData, PracticeLogData, ChildProfile } from '@/lib/db';
import { getFeatureAccess } from '@/lib/access';
import { getRandomExamples } from '@/data/consultExamples';
import { useLocale } from '@/i18n/LocaleProvider';
import { trackEvent } from '@/lib/analytics';
import { getApiErrorMessage, readJsonResponse } from '@/lib/api';
import { buildInstallPageUrl, isAppWebView } from '@/lib/install';
import {
    validateConsultProblemInput,
    type ConsultInputValidationCode,
} from '@/lib/consultInputValidation';

type Step = 'INPUT' | 'DIAGNOSTIC' | 'RESULT';
type QuestionNavDirection = 'next' | 'prev';

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

function isQuestion(value: unknown): value is Question {
    if (!value || typeof value !== 'object') return false;
    const question = value as Record<string, unknown>;
    const isValidType = question.type === 'CHOICE' || question.type === 'TEXT';
    const hasValidOptions = question.options === undefined || (
        Array.isArray(question.options)
        && question.options.every((option) => {
            if (!option || typeof option !== 'object') return false;
            const candidate = option as Record<string, unknown>;
            return typeof candidate.id === 'string'
                && typeof candidate.text === 'string'
                && (candidate.freeText === undefined || typeof candidate.freeText === 'boolean');
        })
    );

    return typeof question.id === 'string'
        && typeof question.text === 'string'
        && isValidType
        && hasValidOptions;
}

function isPrescription(value: unknown): value is Prescription {
    if (!value || typeof value !== 'object') return false;
    const prescription = value as Record<string, unknown>;
    const hasQuestionAnalysis = prescription.questionAnalysis === undefined || (
        Array.isArray(prescription.questionAnalysis)
        && prescription.questionAnalysis.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return typeof candidate.question === 'string'
                && typeof candidate.answer === 'string'
                && typeof candidate.analysis === 'string';
        })
    );
    const hasActionItems = prescription.actionItems === undefined || (
        Array.isArray(prescription.actionItems)
        && prescription.actionItems.every((item) => {
            if (!item || typeof item !== 'object') return false;
            const candidate = item as Record<string, unknown>;
            return typeof candidate.title === 'string'
                && typeof candidate.description === 'string'
                && typeof candidate.duration === 'number'
                && typeof candidate.encouragement === 'string'
                && (candidate.trigger === undefined || typeof candidate.trigger === 'string')
                && (candidate.action === undefined || typeof candidate.action === 'string');
        })
    );

    return typeof prescription.interpretation === 'string'
        && typeof prescription.chemistry === 'string'
        && typeof prescription.magicWord === 'string'
        && hasQuestionAnalysis
        && hasActionItems
        && (prescription.actionItem === undefined || typeof prescription.actionItem === 'string')
        && (prescription.sessionTitle === undefined || typeof prescription.sessionTitle === 'string');
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

interface TemperamentProfile {
    label: string;
    keywords: string[];
    description: string;
    image: string;
    scores: {
        NS: number;
        HA: number;
        RD: number;
        P: number;
    };
}

type SessionContextData = Awaited<ReturnType<typeof db.getSessionWithConsultations>>;
type ChildSummary = Pick<ChildProfile, 'id' | 'name' | 'birth_date' | 'gender'>;

function truncateText(value: string, maxLength = 64) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function ConsultGreeting({
    childName,
    highlightChildName,
    isFollowUp,
    locale,
    t,
}: {
    childName: string | null;
    highlightChildName: boolean;
    isFollowUp: boolean;
    locale: 'ko' | 'en';
    t: (key: string, params?: Record<string, string | number>) => string;
}) {
    const question = isFollowUp ? t('consult.questionContinue') : t('consult.questionFirst');

    if (!childName) {
        return (
            <>
                {t('consult.greetingDefault')}
                <br />
                {question}
            </>
        );
    }

    if (!highlightChildName) {
        return (
            <>
                {t('consult.greetingWithName', { name: childName })}
                <br />
                {question}
            </>
        );
    }

    const highlightedName = (
        <span className="text-child dark:text-secondary">{childName}</span>
    );

    return (
        <>
            {locale === 'ko' ? (
                <>
                    {highlightedName} 양육자님,
                </>
            ) : (
                <>
                    Dear {highlightedName}&apos;s parent,
                </>
            )}
            <br />
            {question}
        </>
    );
}

export default function ConsultPage() {
    return (
        <Suspense fallback={<ConsultPageFallback />}>
            <ConsultContent />
        </Suspense>
    );
}

function ConsultPageFallback() {
    const { t } = useLocale();

    return (
        <div className="bg-background-light dark:bg-background-dark h-[100dvh] min-h-[100dvh] overflow-hidden flex flex-col items-center justify-center font-body pb-0">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-0 flex flex-col shadow-2xl overflow-hidden relative">
                <Navbar title={t('consult.heartInterpreterStation')} />
                <main className="app-fixed-cta-scroll w-full max-w-md flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
                    <TabLoadingIndicator ariaLabel={t('common.loading')} className="flex-1" />
                </main>
            </div>
        </div>
    );
}

function ConsultContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionIdParam = searchParams.get('sessionId');
    const replacePracticeIdParam = searchParams.get('replacePracticeId');
    const entrySource = searchParams.get('source') ?? (sessionIdParam ? 'followup' : 'direct');
    const reportTab = searchParams.get('report_tab');
    const reportKind = searchParams.get('report_kind');
    const { user } = useAuth();
    const { t, locale } = useLocale();
    const { intake, cbqResponses, atqResponses, selectedChildId } = useAppStore();
    const [childName, setChildName] = useState<string | null>(intake.childName || null);
    const [childBirthDate, setChildBirthDate] = useState<string | undefined>(intake.birthDate || undefined);
    const [childGender, setChildGender] = useState<string | undefined>(intake.gender || undefined);
    const [hasMultipleChildren, setHasMultipleChildren] = useState(false);

    // 세션 상태
    const [sessionContext, setSessionContext] = useState<SessionContextData | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(sessionIdParam);
    const [sessionContextLoading, setSessionContextLoading] = useState(!!sessionIdParam);
    const [validChildId, setValidChildId] = useState<string | null>(null);
    const [childLoading, setChildLoading] = useState(true);
    const [hasChildReport, setHasChildReport] = useState(true);
    const sessionChildId = sessionContext?.session.child_id ?? null;

    useEffect(() => {
        if (!user) { setHasMultipleChildren(false); setChildLoading(false); return; }
        if (sessionContextLoading) return;
        setChildLoading(true);
        supabase.from('children').select('id, name, birth_date, gender').eq('parent_id', user.id).then(async ({ data }) => {
            const children = (data || []) as ChildSummary[];
            setHasMultipleChildren(children.length > 1);
            if (children.length === 0) {
                setChildName(intake.childName || null);
                setChildBirthDate(intake.birthDate || undefined);
                setChildGender(intake.gender || undefined);
                setValidChildId(null);
                setHasChildReport(false);
                setChildLoading(false);
            } else {
                const requestedChildId = sessionChildId || selectedChildId;
                const selected = requestedChildId ? children.find(c => c.id === requestedChildId) : children[0];
                const child = selected || (!sessionChildId ? children[0] : null);
                if (!child) {
                    setChildName(null);
                    setChildBirthDate(undefined);
                    setChildGender(undefined);
                    setValidChildId(null);
                    setHasChildReport(false);
                    setChildLoading(false);
                    return;
                }
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
    }, [user, selectedChildId, sessionChildId, sessionContextLoading, intake.childName, intake.birthDate, intake.gender]);

    const [examples, setExamples] = useState<ReturnType<typeof getRandomExamples>>([]);
    useEffect(
        () => setExamples(getRandomExamples(childBirthDate, childGender, 5, locale)),
        [childBirthDate, childGender, locale]
    );

    const [step, setStep] = useState<Step>('INPUT');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState<'questions' | 'followup' | 'prescription' | null>(null);

    // 구독/트라이얼 상태
    const [hasSubscription, setHasSubscription] = useState(false);
    const access = getFeatureAccess({ userCreatedAt: user?.created_at, hasSubscription });
    const trial = access.trial;
    const hasFullAccess = access.hasFullAccess;
    const isTrialActive = !hasSubscription && !!trial?.isActive;
    const trialState = hasSubscription ? 'subscribed' : trial?.isActive ? 'active' : trial ? 'expired' : 'unknown';
    useEffect(() => {
        if (!user) return;
        db.getActiveSubscription(user.id).catch(() => null).then(sub => {
            setHasSubscription(!!sub);
        });
    }, [user]);

    // INPUT STATE
    const [problemDesc, setProblemDesc] = useState('');
    const [problemInputError, setProblemInputError] = useState<string | null>(null);
    const [isProblemInputFocused, setIsProblemInputFocused] = useState(false);
    const problemInputRef = useRef<HTMLDivElement>(null);
    const problemScrollTimeoutRef = useRef<number | null>(null);
    const freeTextTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const lastFocusedFreeTextOptionRef = useRef<string | null>(null);
    const [currentTextAnswer, setCurrentTextAnswer] = useState('');
    const [freeTextOptionId, setFreeTextOptionId] = useState<string | null>(null);

    // DIAGNOSTIC STATE
    const [empathy, setEmpathy] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [questionNavDirection, setQuestionNavDirection] = useState<QuestionNavDirection>('next');
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isFollowUpDone, setIsFollowUpDone] = useState(false);

    // RESULT STATE
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
    const [savedConsultId, setSavedConsultId] = useState<string | null>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const trackedFollowupContextRef = useRef(false);

    // 기질 프로필 (초기 로드 시 1회 계산)
    const [childProfile, setChildProfile] = useState<TemperamentProfile | null>(null);
    const [parentProfile, setParentProfile] = useState<TemperamentProfile | null>(null);

    useEffect(() => {
        if (isAppWebView()) {
            setShowInstallPrompt(false);
            return;
        }

        // Native WebView context can be injected after the React page mounts.
        const revealTimer = window.setTimeout(() => {
            setShowInstallPrompt(!isAppWebView());
        }, 1000);
        const verifyTimer = window.setTimeout(() => {
            if (isAppWebView()) setShowInstallPrompt(false);
        }, 2500);

        return () => {
            window.clearTimeout(revealTimer);
            window.clearTimeout(verifyTimer);
        };
    }, []);

    const scrollProblemInputIntoView = useCallback(() => {
        const input = problemInputRef.current;
        if (!input) return;

        if (problemScrollTimeoutRef.current !== null) {
            window.clearTimeout(problemScrollTimeoutRef.current);
        }

        problemScrollTimeoutRef.current = window.setTimeout(() => {
            problemScrollTimeoutRef.current = null;
            input.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }, 120);
    }, []);

    useEffect(() => () => {
        if (problemScrollTimeoutRef.current !== null) {
            window.clearTimeout(problemScrollTimeoutRef.current);
        }
    }, []);

    const getProblemInputErrorMessage = useCallback((code: ConsultInputValidationCode) => {
        if (code === 'empty') return t('consult.pleaseDescribeProblem');
        if (code === 'too_short') return t('consult.problemInputTooShort');
        return t('consult.problemInputInvalid');
    }, [t]);

    const updateProblemDesc = useCallback((value: string) => {
        setProblemDesc(value.slice(0, 500));
        if (problemInputError) setProblemInputError(null);
    }, [problemInputError]);
    const trimmedProblemDesc = problemDesc.trim();
    const selectedProblemExampleText = examples.find((ex) => trimmedProblemDesc === ex.text.trim())?.text ?? null;
    const hasProblemDesc = problemDesc.length > 0;
    const problemInputValidationPreview = hasProblemDesc ? validateConsultProblemInput(problemDesc) : null;
    const shouldShowMoreDetailHint =
        problemInputValidationPreview?.ok === false
        && problemInputValidationPreview.code === 'too_short';

    const openPricing = useCallback((entryCta: string, placement: string) => {
        trackEvent('trial_conversion_cta_clicked', {
            source: entrySource,
            entry_cta: entryCta,
            placement,
            trial_state: trialState,
            trial_days_remaining: trial?.daysRemaining ?? 0,
            has_subscription: hasSubscription,
        });
        router.push(`/pricing?source=consult&entry_cta=${entryCta}`);
    }, [entrySource, hasSubscription, router, trial?.daysRemaining, trialState]);

    const selectProblemExample = useCallback((text: string) => {
        updateProblemDesc(text);
    }, [updateProblemDesc]);

    const clearProblemDesc = useCallback(() => {
        updateProblemDesc('');
    }, [updateProblemDesc]);

    useEffect(() => {
        if (!isProblemInputFocused) return;

        scrollProblemInputIntoView();
        const viewport = window.visualViewport;
        if (!viewport) return;

        viewport.addEventListener('resize', scrollProblemInputIntoView);
        return () => {
            viewport.removeEventListener('resize', scrollProblemInputIntoView);
        };
    }, [isProblemInputFocused, scrollProblemInputIntoView]);

    useEffect(() => {
        const root = document.documentElement;
        const viewport = window.visualViewport;

        const updateKeyboardInset = () => {
            const activeElement = document.activeElement;
            const isTextInput = activeElement instanceof HTMLElement
                && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT');

            if (!viewport || !isTextInput) {
                root.style.setProperty('--keyboard-inset-bottom', '0px');
                return;
            }

            const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            root.style.setProperty('--keyboard-inset-bottom', `${Math.round(keyboardInset)}px`);
        };

        const clearKeyboardInset = () => {
            window.setTimeout(updateKeyboardInset, 80);
        };

        window.addEventListener('focusin', updateKeyboardInset);
        window.addEventListener('focusout', clearKeyboardInset);
        viewport?.addEventListener('resize', updateKeyboardInset);
        viewport?.addEventListener('scroll', updateKeyboardInset);
        updateKeyboardInset();

        return () => {
            window.removeEventListener('focusin', updateKeyboardInset);
            window.removeEventListener('focusout', clearKeyboardInset);
            viewport?.removeEventListener('resize', updateKeyboardInset);
            viewport?.removeEventListener('scroll', updateKeyboardInset);
            root.style.setProperty('--keyboard-inset-bottom', '0px');
        };
    }, []);

    // 추가 상담: 세션 컨텍스트 로드
    useEffect(() => {
        if (!sessionIdParam) {
            setSessionContext(null);
            setSessionId(null);
            setSessionContextLoading(false);
            trackedFollowupContextRef.current = false;
            return;
        }
        setSessionContextLoading(true);
        (async () => {
            try {
                const ctx = await db.getSessionWithConsultations(sessionIdParam);
                setSessionContext(ctx);
                setSessionId(sessionIdParam);
            } catch (e) {
                console.error('Failed to load session context:', e);
                setSessionContext(null);
                setSessionId(null);
            } finally {
                setSessionContextLoading(false);
            }
        })();
    }, [sessionIdParam]);

    const followupContextSummary = useCallback(() => {
        if (!sessionContext) return null;

        const logs = [...(sessionContext.logs || [])].sort((a, b) => a.date.localeCompare(b.date));
        const practices = sessionContext.practices || [];
        const reviews = sessionContext.reviews || [];
        const latestLog = logs[logs.length - 1];
        const latestPractice = latestLog
            ? practices.find((practice) => practice.id === latestLog.practice_id)
            : practices[practices.length - 1];
        const latestReview = latestPractice
            ? reviews.find((review) => review.practice_id === latestPractice.id)
            : null;
        const doneDays = latestPractice
            ? logs.filter((log) => log.practice_id === latestPractice.id && log.done).length
            : 0;
        const childReactionLabels: Record<string, string> = {
            cooperated: t('practices.reactionCooperated'),
            resisted_then_settled: t('practices.reactionSettled'),
            escalated: t('practices.reactionEscalated'),
            no_clear_reaction: t('practices.reactionNoClear'),
            not_tried: t('practices.reactionNotTried'),
            custom: t('practices.reactionCustom'),
        };
        const parentImpressionLabels: Record<string, string> = {
            this_is_it: t('practices.impressionThisIsIt'),
            seems_right: t('practices.impressionSeemsRight'),
            not_sure: t('practices.impressionNotSure'),
            seems_wrong: t('practices.impressionSeemsWrong'),
            want_to_adjust: t('practices.impressionWantToAdjust'),
        };
        const reaction = latestLog?.child_reaction_note
            || (latestLog?.child_reaction_type ? childReactionLabels[latestLog.child_reaction_type] : null)
            || (latestLog ? (latestLog.done ? t('consult.followupContextDone') : t('consult.followupContextSkipped')) : t('consult.followupContextNoLogs'));
        const nextFocus = latestReview?.content
            ? t('consult.followupContextNextReview', { review: truncateText(latestReview.content, 46) })
            : latestLog?.parent_impression_type
                ? t('consult.followupContextNextImpression', {
                    impression: parentImpressionLabels[latestLog.parent_impression_type] || latestLog.parent_impression_type,
                })
                : t('consult.followupContextNextDefault');

        return {
            practice: latestPractice
                ? t('consult.followupContextPracticeSummary', {
                    title: latestPractice.title,
                    done: doneDays,
                    duration: latestPractice.duration,
                })
                : t('consult.followupContextNoLogs'),
            reaction,
            nextFocus,
        };
    }, [sessionContext, t]);

    const followupSummary = followupContextSummary();

    useEffect(() => {
        if (!sessionContext || trackedFollowupContextRef.current) return;
        trackedFollowupContextRef.current = true;
        trackEvent('followup_context_viewed', {
            source: entrySource,
            has_subscription: hasSubscription,
            is_trial: isTrialActive,
            practice_count: sessionContext.practices?.length ?? 0,
            log_count: sessionContext.logs?.length ?? 0,
            review_count: sessionContext.reviews?.length ?? 0,
        });
    }, [entrySource, hasSubscription, isTrialActive, sessionContext]);

    useEffect(() => {
        (async () => {
            const { TemperamentScorer } = await import('@/lib/TemperamentScorer');
            const { TemperamentClassifier } = await import('@/lib/TemperamentClassifier');

            let childScores: TemperamentProfile['scores'] | null = null;
            let parentScores: TemperamentProfile['scores'] | null = null;

            if (Object.keys(cbqResponses).length > 0) {
                const { CHILD_QUESTIONS } = await import('@/data/questions');
                childScores = TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses);
                const result = TemperamentClassifier.analyzeChild(childScores);
                setChildProfile({ label: result.label, keywords: result.keywords, description: result.desc, image: result.image, scores: childScores });
            } else {
                setChildProfile(null);
            }

            if (Object.keys(atqResponses).length > 0) {
                const { PARENT_QUESTIONS } = await import('@/data/questions');
                parentScores = TemperamentScorer.calculate(PARENT_QUESTIONS, atqResponses);
                const result = TemperamentClassifier.analyzeParent(parentScores);
                setParentProfile({ label: result.label, keywords: result.keywords, description: result.desc, image: result.image, scores: parentScores });
            } else {
                setParentProfile(null);
            }

        })();
    }, [cbqResponses, atqResponses]);


    const handleStartDiagnostic = async () => {
        if (!hasFullAccess) {
            openPricing('consult_gate', 'consult_input_gate');
            return;
        }

        const inputValidation = validateConsultProblemInput(problemDesc);
        if (!inputValidation.ok) {
            setProblemInputError(getProblemInputErrorMessage(inputValidation.code));
            scrollProblemInputIntoView();
            return;
        }

        const fullProblem = problemDesc;
        trackEvent('consult_started', {
            source: entrySource,
            has_child_report: hasChildReport,
            has_subscription: hasSubscription,
            is_trial: isTrialActive,
            is_followup: !!sessionIdParam,
            report_tab: reportTab ?? undefined,
            report_kind: reportKind ?? undefined,
        });

        setLoadingStage('questions');
        setIsLoading(true);
        try {
            let recentObservations: ObservationData[] = [];
            if (user) {
                try {
                    recentObservations = await db.getRecentObservations(user.id, 5, validChildId ?? undefined);
                } catch {
                    // 관찰 기록 조회 실패 시 빈 배열로 진행
                }
            }

            const res = await fetch('/api/consult/questions/initial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: fullProblem,
                    childId: validChildId,
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
                openPricing('consult_gate', 'initial_question_gate');
                return;
            }
            const data = await readJsonResponse<{ empathy?: string; questions?: Question[]; error?: string }>(res);
            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, 'Failed to fetch initial questions'));
            }

            if (typeof data?.empathy !== 'string' || !Array.isArray(data.questions) || !data.questions.every(isQuestion)) {
                throw new Error('INVALID_INITIAL_QUESTIONS_RESPONSE');
            }
            setEmpathy(data.empathy);
            setQuestions(data.questions);
            setAnswers({});
            setCurrentTextAnswer('');
            setFreeTextOptionId(null);
            setIsFollowUpDone(false);
            setStep('DIAGNOSTIC');
            setQuestionNavDirection('next');
            setCurrentQuestionIndex(0);
        } catch (error) {
            console.error(error);
            alert(t('consult.errorRetry'));
        } finally {
            setIsLoading(false);
            setLoadingStage(null);
        }
    };

    const handleAnswer = async (questionId: string, answer: string) => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }

        const newAnswers = { ...answers, [questionId]: answer };
        setAnswers(newAnswers);
        setFreeTextOptionId(null);

        if (currentQuestionIndex < questions.length - 1) {
            setQuestionNavDirection('next');
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
            openPricing('consult_gate', 'followup_question_gate');
            return;
        }
        setLoadingStage('followup');
        setIsLoading(true);
        try {
            const fullProblem = problemDesc;
            const res = await fetch('/api/consult/questions/followup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: fullProblem,
                    firstRoundQuestions: questions.map(q => ({ id: q.id, text: q.text })),
                    firstRoundAnswers: currentAnswers
                }),
            });

            if (res.status === 402 || res.status === 403) {
                openPricing('consult_gate', 'followup_question_gate');
                return;
            }

            const data = await readJsonResponse<{
                needsFollowUp?: boolean;
                followUpReason?: string;
                followUpQuestions?: Question[];
                error?: string;
            }>(res);
            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, 'Failed to process follow-up'));
            }
            if (!data) {
                throw new Error('EMPTY_FOLLOWUP_RESPONSE');
            }

            if (data.needsFollowUp && (!Array.isArray(data.followUpQuestions) || !data.followUpQuestions.every(isQuestion))) {
                throw new Error('INVALID_FOLLOWUP_RESPONSE');
            }

            const followUpQuestions = data.followUpQuestions;

            if (data.needsFollowUp && followUpQuestions && followUpQuestions.length > 0) {
                setEmpathy(data.followUpReason || t('consult.followUpDefault'));
                setQuestions(prev => [...prev, ...followUpQuestions]);
                setIsFollowUpDone(true);
                setQuestionNavDirection('next');
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                await handleGeneratePrescription(currentAnswers);
            }
        } catch (error) {
            console.error(error);
            await handleGeneratePrescription(currentAnswers); // Fallback to results
        } finally {
            setIsLoading(false);
            setLoadingStage(null);
        }
    };

    const handleGeneratePrescription = async (allAnswers: Record<string, string>) => {
        if (!hasFullAccess) {
            openPricing('consult_gate', 'prescription_gate');
            return;
        }
        setLoadingStage('prescription');
        setIsLoading(true);
        try {
            const fullProblem = problemDesc;

            let recentObservations: ObservationData[] = [];
            if (user) {
                try {
                    recentObservations = await db.getRecentObservations(user.id, 5, validChildId ?? undefined);
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
                    childId: validChildId,
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
                openPricing('consult_gate', 'prescription_gate');
                return;
            }
            const data = await readJsonResponse<Prescription & { error?: string }>(res);
            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, 'Failed to generate prescription'));
            }

            if (!isPrescription(data)) {
                throw new Error('INVALID_PRESCRIPTION_RESPONSE');
            }
            setPrescription(data);
            setStep('RESULT');
            trackEvent('consult_completed', {
                source: entrySource,
                has_subscription: hasSubscription,
                is_trial: isTrialActive,
                is_followup: !!sessionIdParam,
                report_tab: reportTab ?? undefined,
                report_kind: reportKind ?? undefined,
                action_item_count: data.actionItems?.length ?? 0,
            });

            // 첫 번째 실천 항목을 기본 추천으로 선택
            if (Array.isArray(data.actionItems) && data.actionItems.length > 0) {
                setSelectedActionIndex(0);
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
            setLoadingStage(null);
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const hasUnsavedConsultProgress = step !== 'RESULT' && (
        isLoading
        || problemDesc.trim().length > 0
        || questions.length > 0
        || Object.keys(answers).length > 0
        || currentTextAnswer.trim().length > 0
    );
    const handleHomeNavigationRequest = useCallback(() => {
        if (!hasUnsavedConsultProgress) return true;
        return window.confirm(t('consult.confirmLeaveForHome'));
    }, [hasUnsavedConsultProgress, t]);
    const loadingTitle = loadingStage === 'questions'
        ? (childName ? t('consult.analyzingTemperament', { name: childName }) : t('consult.analyzingTemperamentDefault'))
        : loadingStage === 'followup'
            ? t('consult.refiningQuestions')
            : t('consult.translatingHeart');
    const loadingMessage = loadingStage === 'questions'
        ? t('consult.loadingQuestionsCopy')
        : loadingStage === 'followup'
            ? t('consult.loadingFollowupCopy')
            : t('consult.loadingPrescriptionCopy');

    useEffect(() => {
        setFreeTextOptionId(null);
        setCurrentTextAnswer('');
    }, [currentQuestionIndex]);

    useEffect(() => {
        if (!freeTextOptionId) {
            lastFocusedFreeTextOptionRef.current = null;
            return;
        }

        if (lastFocusedFreeTextOptionRef.current === freeTextOptionId) return;
        lastFocusedFreeTextOptionRef.current = freeTextOptionId;

        const timeoutId = window.setTimeout(() => {
            const textarea = freeTextTextareaRef.current;
            if (!textarea) return;
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        return () => window.clearTimeout(timeoutId);
    }, [freeTextOptionId]);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center font-body pb-0">
            <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative">
                <Navbar
                    title={step === 'RESULT' ? t('consult.heartPrescription') : t('consult.heartInterpreterStation')}
                    onHomeClick={handleHomeNavigationRequest}
                />

                <main className="app-fixed-cta-scroll w-full max-w-md flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar p-6">
                    {step === 'INPUT' && childLoading && (
                        <TabLoadingIndicator ariaLabel={t('common.loading')} className="flex-1" />
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
                                            {sessionContext.practices.map((p: PracticeItemData) => {
                                                const doneDays = (sessionContext.logs || []).filter((l: PracticeLogData) => l.practice_id === p.id && l.done).length;
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
                                    {followupSummary && (
                                        <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-secondary/10 p-4 space-y-3">
                                            <div className="flex items-center gap-1.5 text-secondary">
                                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                                <p className="text-[12px] font-black">{t('consult.followupContextTitle')}</p>
                                            </div>
                                            <div className="grid gap-2 text-[12px]">
                                                <div>
                                                    <p className="text-[10px] font-black text-text-sub uppercase tracking-wider">{t('consult.followupContextPreviousLabel')}</p>
                                                    <p className="mt-0.5 font-medium leading-relaxed text-text-main dark:text-gray-200">{followupSummary.practice}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-text-sub uppercase tracking-wider">{t('consult.followupContextReactionLabel')}</p>
                                                    <p className="mt-0.5 font-medium leading-relaxed text-text-main dark:text-gray-200">{followupSummary.reaction}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-text-sub uppercase tracking-wider">{t('consult.followupContextNextLabel')}</p>
                                                    <p className="mt-0.5 font-medium leading-relaxed text-text-main dark:text-gray-200">{followupSummary.nextFocus}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-text-main dark:text-white leading-tight">
                                    <ConsultGreeting
                                        childName={childName}
                                        highlightChildName={hasMultipleChildren}
                                        isFollowUp={!!sessionContext}
                                        locale={locale}
                                        t={t}
                                    />
                                </h2>
                                <p className="text-sm text-text-sub dark:text-gray-400">{sessionContext ? t('consult.subtitleContinue') : t('consult.subtitleFirst')}</p>
                            </div>

                            <div className="rounded-3xl border border-primary/10 bg-white dark:bg-surface-dark p-5 space-y-4">
                                <div>
                                    <p className="text-[14px] font-bold text-text-main dark:text-white">{t('consult.introTitle')}</p>
                                    <p className="mt-1 text-[12px] leading-relaxed text-text-sub dark:text-gray-400">
                                        {sessionContext ? t('consult.introDescContinue') : t('consult.introDescFirst')}
                                    </p>
                                </div>
                                <div className="grid gap-2.5">
                                    <div className="rounded-2xl bg-primary/5 px-4 py-4">
                                        <div className="mx-auto flex w-full max-w-[30rem] items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm dark:bg-white/10" aria-hidden="true">
                                                <span className="material-symbols-outlined flex h-5 w-5 translate-x-px translate-y-px items-center justify-center text-[19px] leading-none">
                                                    psychology
                                                </span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-primary">{t('consult.introOutcomeLabel')}</p>
                                                <p className="mt-0.5 break-keep text-[13px] leading-relaxed text-text-main dark:text-white">{t('consult.introOutcomeText')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-secondary/5 px-4 py-4">
                                        <div className="mx-auto flex w-full max-w-[30rem] items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-secondary shadow-sm dark:bg-white/10" aria-hidden="true">
                                                <span className="material-symbols-outlined flex h-5 w-5 translate-x-px translate-y-px items-center justify-center text-[19px] leading-none">
                                                    timer
                                                </span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-secondary">{t('consult.introTimeLabel')}</p>
                                                <p className="mt-0.5 break-keep text-[13px] leading-relaxed text-text-main dark:text-white">{t('consult.introTimeText')}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl bg-beige-main/25 px-4 py-4">
                                        <div className="mx-auto flex w-full max-w-[30rem] items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-text-main shadow-sm dark:bg-white/10 dark:text-white" aria-hidden="true">
                                                <span className="material-symbols-outlined flex h-5 w-5 translate-x-px translate-y-px items-center justify-center text-[19px] leading-none">
                                                    health_and_safety
                                                </span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-text-main dark:text-white">{t('consult.introScopeLabel')}</p>
                                                <p className="mt-0.5 break-keep text-[13px] leading-relaxed text-text-main dark:text-white">{t('consult.introScopeText')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                {!sessionContext && (
                                    <>
                                        <p className="text-[12px] text-text-sub dark:text-gray-500 mb-2">{t('consult.exampleHint')}</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {examples.map(ex => {
                                                const isSelected = selectedProblemExampleText === ex.text;
                                                return (
                                                    <button
                                                        key={ex.label}
                                                        type="button"
                                                        aria-pressed={isSelected}
                                                        onClick={() => selectProblemExample(ex.text)}
                                                        className={`px-3 py-2 rounded-xl text-[13px] transition-all border active:scale-95 shadow-sm ${
                                                            isSelected
                                                                ? 'bg-primary text-white border-primary font-bold shadow-primary/15'
                                                                : 'bg-white dark:bg-surface-dark text-text-sub border-primary/10 hover:border-primary/30 hover:bg-primary/5'
                                                        }`}
                                                    >
                                                        {ex.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                <div ref={problemInputRef} className="relative scroll-mb-40">
                                    <textarea
                                        value={problemDesc}
                                        onChange={(e) => updateProblemDesc(e.target.value)}
                                        onFocus={() => setIsProblemInputFocused(true)}
                                        onBlur={() => setIsProblemInputFocused(false)}
                                        maxLength={500}
                                        placeholder={sessionContext ? t('consult.textareaPlaceholderContinue') : t('consult.textareaPlaceholderFirst')}
                                        className={`consult-problem-textarea w-full h-36 px-5 pt-5 pb-12 pr-16 text-[15px] leading-relaxed rounded-3xl border focus:outline-none focus:ring-4 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner ${
                                            problemInputError
                                                ? 'border-red-300 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/10'
                                                : 'border-primary/10 focus:ring-primary/5'
                                        }`}
                                    />
                                    <VoiceInputButton
                                        value={problemDesc}
                                        onChange={updateProblemDesc}
                                        maxLength={500}
                                        className="consult-problem-voice-button absolute bottom-4 right-4"
                                    />
                                </div>
                                {problemInputError && (
                                    <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-left dark:border-red-500/20 dark:bg-red-500/10">
                                        <p className="text-[13px] font-bold leading-relaxed text-red-700 dark:text-red-200">
                                            {problemInputError}
                                        </p>
                                        <p className="mt-1 text-[12px] leading-relaxed text-red-600/80 dark:text-red-200/75">
                                            {t('consult.problemInputExample')}
                                        </p>
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-3 mt-2 px-1">
                                    <p className="min-h-4 flex-1 truncate text-[12px] text-text-sub dark:text-gray-500" aria-live="polite">
                                        {shouldShowMoreDetailHint ? t('consult.moreDetailHint') : ''}
                                    </p>
                                    <div className="flex shrink-0 items-center gap-3">
                                        {hasProblemDesc && (
                                            <button
                                                type="button"
                                                onClick={clearProblemDesc}
                                                className="text-[12px] font-bold text-text-sub transition-colors hover:text-primary dark:text-gray-400"
                                            >
                                                {t('consult.clearProblemInput')}
                                            </button>
                                        )}
                                        <span className={`text-[11px] tabular-nums ${
                                            problemDesc.length >= 500 ? 'text-red-400' : 'text-text-muted dark:text-gray-500'
                                        }`}>
                                            {problemDesc.length}/500
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'INPUT' && !childLoading && validChildId && hasChildReport && (
                        <div className="app-fixed-cta fixed bottom-0 left-0 right-0 z-30 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-xl border-t border-beige-main/20">
                            <div className="w-full max-w-md mx-auto px-6">
                            {!hasFullAccess && (
                                <div className="mb-3 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-left">
                                    <p className="text-sm font-bold text-text-main dark:text-white">
                                        {t('consult.trialExpired')}
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-text-sub dark:text-gray-400">
                                        {t('consult.trialExpiredDesc')}
                                    </p>
                                </div>
                            )}
                            {trial?.isActive && !hasSubscription && trial.daysRemaining <= 2 && (
                                <p className="text-center text-xs font-medium mb-3 text-secondary">
                                    {t('consult.trialDaysRemaining', { days: trial.daysRemaining })}
                                </p>
                            )}
                            <button
                                onClick={hasFullAccess ? handleStartDiagnostic : () => openPricing('consult_gate', 'consult_input_sticky')}
                                disabled={isLoading}
                                className={`w-full py-5 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isLoading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary-dark shadow-xl shadow-primary/20'
                                    }`}
                            >
                                <span>{hasFullAccess ? t('consult.startConsult') : t('consult.subscribeCta')}</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </button>
                            </div>
                        </div>
                    )}

                    {step === 'DIAGNOSTIC' && currentQuestion && (
                        <div key={`${currentQuestionIndex}-${currentQuestion.id}`} className={`question-slide question-slide-${questionNavDirection} flex flex-col gap-6 w-full`}>
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
                                                    setQuestionNavDirection('prev');
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
                                    {currentQuestion.options?.map((opt, i) => {
                                        const optionInteractionId = `${currentQuestionIndex}-${currentQuestion.id}-${opt.id || `opt-${i}`}-${i}`;
                                        const isFreeTextOptionOpen = freeTextOptionId === optionInteractionId;

                                        return (
                                            <div key={optionInteractionId}>
                                                <button
                                                    onClick={() => {
                                                        if (opt.freeText) {
                                                            setFreeTextOptionId(isFreeTextOptionOpen ? null : optionInteractionId);
                                                            setCurrentTextAnswer('');
                                                        } else {
                                                            setFreeTextOptionId(null);
                                                            handleAnswer(currentQuestion.id, opt.text);
                                                        }
                                                    }}
                                                    className={`consult-choice-option w-full text-left p-5 rounded-[1.5rem] border-2 transition-all active:scale-[0.98] ${
                                                        isFreeTextOptionOpen
                                                            ? 'border-secondary bg-secondary/5'
                                                            : 'border-primary/5 bg-white dark:bg-surface-dark'
                                                    }`}
                                                >
                                                    <div className="consult-choice-option-label font-bold leading-relaxed text-[15px] text-text-main dark:text-white transition-colors">
                                                        {opt.text}
                                                    </div>
                                                </button>
                                                {opt.freeText && isFreeTextOptionOpen && (
                                                    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <div className="relative">
                                                            <textarea
                                                                ref={freeTextTextareaRef}
                                                                className="w-full h-32 p-5 pr-16 text-[15px] rounded-3xl border border-secondary/30 focus:outline-none focus:ring-4 focus:ring-secondary/10 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all"
                                                                placeholder={t('consult.freeTextPlaceholder')}
                                                                value={currentTextAnswer}
                                                                onChange={(e) => setCurrentTextAnswer(e.target.value.slice(0, 300))}
                                                            />
                                                            <VoiceInputButton
                                                                value={currentTextAnswer}
                                                                onChange={setCurrentTextAnswer}
                                                                maxLength={300}
                                                                className="absolute bottom-4 right-4"
                                                            />
                                                        </div>
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
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <textarea
                                            className="w-full h-40 p-5 pr-16 text-[15px] rounded-3xl border border-primary/10 focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none bg-white dark:bg-surface-dark dark:text-white transition-all shadow-inner"
                                            placeholder={t('consult.freeTextPlaceholder')}
                                            value={currentTextAnswer}
                                            onChange={(e) => setCurrentTextAnswer(e.target.value.slice(0, 300))}
                                        />
                                        <VoiceInputButton
                                            value={currentTextAnswer}
                                            onChange={setCurrentTextAnswer}
                                            maxLength={300}
                                            className="absolute bottom-4 right-4"
                                        />
                                    </div>
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
                                            <button key={i} type="button" onClick={() => setSelectedActionIndex(i)} className={`w-full text-left rounded-2xl p-5 border-2 transition-all active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/5' : 'border-beige-main/20 bg-white dark:bg-surface-dark'}`}>
                                                <div className="flex items-start gap-3">
                                                    <span className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 transition-colors ${isSelected ? 'text-primary fill-1' : 'text-gray-300'}`}>
                                                        {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                                                    </span>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[15px] font-bold text-text-main dark:text-white">{item.title}</p>
                                                                {i === 0 && (
                                                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                                                        {t('consult.recommendedAction')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-text-sub bg-beige-main/15 px-2 py-0.5 rounded-full shrink-0">{item.duration}{t('common.days')}</span>
                                                        </div>
                                                        {item.trigger && item.action && (
                                                            <div className="space-y-2 text-[12px]">
                                                                <div className="border-l-2 border-secondary/50 pl-3">
                                                                    <p className="text-[10px] font-black text-secondary">{t('consult.practiceWhenLabel')}</p>
                                                                    <p className="mt-0.5 font-medium leading-relaxed text-text-main dark:text-gray-200">{item.trigger}</p>
                                                                </div>
                                                                <div className="border-l-2 border-primary/50 pl-3">
                                                                    <p className="text-[10px] font-black text-primary">{t('consult.practiceActionLabel')}</p>
                                                                    <p className="mt-0.5 font-medium leading-relaxed text-text-main dark:text-gray-200">{item.action}</p>
                                                                </div>
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
                                {isTrialActive && (
                                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-left">
                                        <p className="text-[13px] font-black text-text-main dark:text-white">
                                            {t('consult.trialPracticeNudgeTitle')}
                                        </p>
                                        <p className="mt-1 text-[12px] leading-relaxed text-text-sub">
                                            {t('consult.trialPracticeNudgeDesc', { days: trial?.daysRemaining ?? 0 })}
                                        </p>
                                    </div>
                                )}
                                {!hasSubscription && !isTrialActive && (
                                    <div className="rounded-2xl bg-primary p-5 text-white shadow-card relative overflow-hidden text-left">
                                        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                                        <div className="relative z-10 space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[11px] font-black text-white/70 uppercase tracking-wider">{t('consult.resultPremiumEyebrow')}</p>
                                                <h3 className="text-[18px] font-black leading-tight break-keep">{t('consult.resultPremiumTitle')}</h3>
                                                <p className="text-[13px] leading-relaxed text-white/85 break-keep">{t('consult.resultPremiumDesc')}</p>
                                            </div>
                                            <button
                                                onClick={() => openPricing('consult_result_continue', 'consult_result')}
                                                className="w-full h-12 rounded-xl bg-white text-primary text-[14px] font-black active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <span>{t('consult.resultPremiumCta')}</span>
                                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={async () => {
                                        try {
                                            if (user && sessionId && savedConsultId && prescription?.actionItems && selectedActionIndex !== null) {
                                                const item = prescription.actionItems[selectedActionIndex];
                                                const fullDescription = item.trigger && item.action
                                                    ? `[IF] ${item.trigger}\n[THEN] ${item.action}\n\n${item.description}`
                                                    : item.description;
                                                const { data: savedPractice, error: saveError } = await supabase.from('practice_items').insert({
                                                    session_id: sessionId,
                                                    consultation_id: savedConsultId,
                                                    title: item.title,
                                                    description: fullDescription,
                                                    duration: item.duration,
                                                    encouragement: item.encouragement || null,
                                                }).select('id').single();
                                                if (saveError) throw saveError;
                                                trackEvent('practice_item_saved', {
                                                    source: 'consult_result',
                                                    has_subscription: hasSubscription,
                                                    is_trial: isTrialActive,
                                                    is_followup: !!sessionIdParam,
                                                    action_index: selectedActionIndex,
                                                    duration: item.duration,
                                                    replaced_practice: !!replacePracticeIdParam,
                                                    saved: !!savedPractice?.id,
                                                });
                                                if (replacePracticeIdParam) {
                                                    await supabase
                                                        .from('practice_items')
                                                        .update({ status: 'DROPPED' })
                                                        .eq('id', replacePracticeIdParam)
                                                        .eq('session_id', sessionId);
                                                }
                                            }
                                            router.push('/practices');
                                        } catch (error) {
                                            console.error('Failed to save practice item:', error);
                                            alert(t('consult.practiceSaveError'));
                                        }
                                    }}
                                    disabled={selectedActionIndex === null}
                                    className={`w-full py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] ${selectedActionIndex !== null ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {selectedActionIndex !== null ? (replacePracticeIdParam ? t('consult.replacePractice') : t('consult.startPractice')) : t('consult.selectActionItem')}
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
                                <MedicalDisclaimer
                                    title={t('consult.medicalDisclaimerTitle')}
                                    body={t('consult.medicalDisclaimerBody')}
                                    className="mt-4"
                                />
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="fixed inset-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-5 px-8">
                            <TemperamentLoadingState
                                title={loadingTitle}
                                message={loadingMessage}
                                imageSrc={childProfile?.image}
                                imageAlt={childProfile?.label || t('common.defaultTemperamentImageAlt')}
                                typeLabel={childProfile?.label}
                                progressStyle="spinner"
                            />

                            {problemDesc && (
                                <div className="w-full max-w-sm bg-white/70 dark:bg-surface-dark/70 rounded-2xl p-5 border border-primary/10 mt-1 shadow-soft">
                                    <p className="text-[11px] font-bold text-text-sub dark:text-gray-500 mb-2 uppercase tracking-wider">{t('consult.consultContent')}</p>
                                    <p className="text-[14px] text-text-main dark:text-gray-200 leading-relaxed line-clamp-4">{problemDesc}</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {/* 앱 다운로드 유도 섹션 (결과 확인 후) */}
                {step === 'RESULT' && showInstallPrompt && (
                    <div className="px-6 pb-36">
                        <div className="bg-secondary/10 dark:bg-secondary/20 rounded-[2.5rem] p-8 text-center relative overflow-hidden border border-secondary/20">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 blur-3xl rounded-full"></div>
                            <p className="text-text-main dark:text-white font-bold text-sm mb-4 relative z-10 whitespace-pre-line">{t('consult.appDownloadHint')}</p>
                            <Button
                                size="sm"
                                variant="primary"
                                className="w-full rounded-xl bg-secondary text-white h-12 font-black shadow-lg shadow-secondary/20 relative z-10"
                                onClick={() => router.push(buildInstallPageUrl({
                                    source: 'consult_result',
                                    entry_cta: 'practice_reminder',
                                    from: 'practices',
                                }))}
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

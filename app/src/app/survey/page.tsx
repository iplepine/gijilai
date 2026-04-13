'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useSurveySync } from '@/hooks/useSurveySync';
import { useAuth } from '@/components/auth/AuthProvider';
import { trackEvent } from '@/lib/analytics';
import { db } from '@/lib/db';
import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';
import { useLocale } from '@/i18n/LocaleProvider';

type SurveyModule = 'child' | 'parent' | 'parenting';

function SurveyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type'); // 'CHILD' | 'PARENT' | 'STYLE'
  const { t } = useLocale();

  const { user } = useAuth();
  const {
    intake,
    cbqResponses,
    atqResponses,
    parentingResponses,
    setCbqResponse,
    setAtqResponse,
    setParentingResponse,
    restoreSurveyFromDB
  } = useAppStore();

  // 설문 응답을 Supabase에 자동 동기화
  useSurveySync();

  const [currentModule, setCurrentModule] = useState<SurveyModule>(() => {
    if (typeParam === 'PARENT') return 'parent';
    if (typeParam === 'STYLE') return 'parenting';
    return 'child';
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionType, setTransitionType] = useState<'toParent' | 'toParenting' | 'finish' | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const startedModulesRef = useRef<Set<SurveyModule>>(new Set());
  const responseCountRef = useRef(0);

  // 양육자 기질 검사가 이미 DB에 완료되어 있으면 복원 후 스킵
  const parentSkipCheckedRef = useRef(false);
  useEffect(() => {
    if (currentModule !== 'parent' || !user || parentSkipCheckedRef.current) return;
    // 이미 스토어에 완료된 응답이 있으면 체크 불필요
    if (Object.keys(atqResponses).length >= PARENT_QUESTIONS.length) {
      parentSkipCheckedRef.current = true;
      const timer = setTimeout(() => {
        // 바로 양육태도로 스킵
        setCurrentModule('parenting');
        setCurrentIndex(0);
      }, 0);
      return () => clearTimeout(timer);
    }
    parentSkipCheckedRef.current = true;

    (async () => {
      try {
        const latest = await db.getLatestSurveyResponses(user.id);
        const dbParent = latest['PARENT'];
        if (dbParent?.answers && dbParent.status === 'COMPLETED') {
          const dbAnswers = dbParent.answers as Record<string, number>;
          if (Object.keys(dbAnswers).length >= PARENT_QUESTIONS.length) {
            // DB에서 복원하고 양육태도로 스킵
            restoreSurveyFromDB({ atqResponses: dbAnswers });
            setCurrentModule('parenting');
            setCurrentIndex(0);
          }
        }
      } catch (e) {
        console.warn('Parent survey skip check failed:', e);
      }
    })();
  }, [currentModule, user, atqResponses, restoreSurveyFromDB]);

  // 양육태도 검사도 이미 DB에 완료되어 있으면 복원 후 스킵
  const styleSkipCheckedRef = useRef(false);
  useEffect(() => {
    if (currentModule !== 'parenting' || !user || styleSkipCheckedRef.current) return;
    if (Object.keys(parentingResponses).length >= PARENTING_STYLE_QUESTIONS.length) {
      styleSkipCheckedRef.current = true;
      const timer = setTimeout(() => {
        setIsCalculating(true);
        setTimeout(() => router.replace('/report'), 2000);
      }, 0);
      return () => clearTimeout(timer);
    }
    styleSkipCheckedRef.current = true;

    (async () => {
      try {
        const latest = await db.getLatestSurveyResponses(user.id);
        const dbStyle = latest['PARENTING_STYLE'];
        if (dbStyle?.answers && dbStyle.status === 'COMPLETED') {
          const dbAnswers = dbStyle.answers as Record<string, number>;
          if (Object.keys(dbAnswers).length >= PARENTING_STYLE_QUESTIONS.length) {
            restoreSurveyFromDB({ parentingResponses: dbAnswers });
            setIsCalculating(true);
            setTimeout(() => router.replace('/report'), 2000);
          }
        }
      } catch (e) {
        console.warn('Parenting style skip check failed:', e);
      }
    })();
  }, [currentModule, user, parentingResponses, restoreSurveyFromDB, router]);

  // 현재 모듈에 따른 질문 목록과 응답 상태 가져오기
  const getModuleData = useCallback(() => {
    switch (currentModule) {
      case 'child':
        return {
          questions: CHILD_QUESTIONS,
          responses: cbqResponses,
          setResponse: setCbqResponse,
          title: t('survey.childTemperament'),
          accent: '#E5A150',        // Warm Amber
          accentBg: '#FFF8F0',      // Warm tinted background
          accentLight: '#E5A15020',  // Badge bg
          accentText: '#B07A28',    // Badge text
          nextModule: 'parent' as SurveyModule
        };
      case 'parent':
        return {
          questions: PARENT_QUESTIONS,
          responses: atqResponses,
          setResponse: setAtqResponse,
          title: t('survey.parentTemperament'),
          accent: '#2F4F3E',        // Forest Green (primary)
          accentBg: '#F5F9F7',      // Cool green tinted background
          accentLight: '#2F4F3E18',  // Badge bg
          accentText: '#2F4F3E',    // Badge text
          nextModule: 'parenting' as SurveyModule
        };
      case 'parenting':
        return {
          questions: PARENTING_STYLE_QUESTIONS,
          responses: parentingResponses,
          setResponse: setParentingResponse,
          title: t('survey.parentingAttitude'),
          accent: '#7B8CDE',        // Soft Lavender-Blue
          accentBg: '#F5F5FC',      // Lavender tinted background
          accentLight: '#7B8CDE20',  // Badge bg
          accentText: '#5563B0',    // Badge text
          nextModule: null
        };
    }
  }, [currentModule, cbqResponses, atqResponses, parentingResponses, setCbqResponse, setAtqResponse, setParentingResponse, t]);

  const { questions, responses, setResponse, title, accent, accentBg, accentLight, accentText } = getModuleData();
  const currentQuestion = questions[currentIndex];
  const currentAnswer = responses[String(currentQuestion?.id)];
  const responseCount = Object.keys(responses).length;

  // 진행률 계산
  const answeredCount =
    Object.keys(cbqResponses).length +
    Object.keys(atqResponses).length +
    Object.keys(parentingResponses).length;
  useEffect(() => {
    responseCountRef.current = responseCount;
  }, [responseCount]);

  useEffect(() => {
    if (startedModulesRef.current.has(currentModule)) return;

    startedModulesRef.current.add(currentModule);
    trackEvent('survey_module_started', {
      module: currentModule,
    });
  }, [currentModule]);

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      trackEvent('survey_module_completed', {
        module: currentModule,
        answered_questions: responseCountRef.current,
      });

      // Current module finished
      if (currentModule === 'child') {
        // 아이 기질 완료 → 즉시 아이 리포트 화면으로 이동 (안 A)
        router.replace('/report?child_only=true');
      } else if (currentModule === 'parent') {
        // 양육자 기질 완료 시 양육 태도 안내 다이얼로그 노출
        setTransitionType('toParenting');
        setShowTransitionModal(true);
      } else if (currentModule === 'parenting') {
        // 마지막 양육 태도 검사 완료 시 결과 확인 다이얼로그 노출
        setTransitionType('finish');
        setShowTransitionModal(true);
      }
    }
  };

  const handleSelect = (idx: number) => {
    if (isCalculating || isAdvancing) return; // 분석 중이거나 다음 문항으로 넘어가는 중이면 클릭 방지

    const score = idx + 1;
    setResponse(String(currentQuestion.id), score);
    setIsAdvancing(true);

    // Auto advance with delay
    setTimeout(() => {
      goToNext();
      setIsAdvancing(false);
    }, 300);
  };

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      // 모듈 간 뒤로가기
      if (currentModule === 'parent') {
        setCurrentModule('child');
        setCurrentIndex(CHILD_QUESTIONS.length - 1);
      } else if (currentModule === 'parenting') {
        setCurrentModule('parent');
        setCurrentIndex(PARENT_QUESTIONS.length - 1);
      } else {
        setShowExitModal(true);
      }
    }
  }, [currentIndex, currentModule]);

  const handleTransitionConfirm = () => {
    setShowTransitionModal(false);
    if (transitionType === 'toParent') {
      setCurrentModule('parent');
      setCurrentIndex(0);
      window.scrollTo(0, 0);
    } else if (transitionType === 'toParenting') {
      setCurrentModule('parenting');
      setCurrentIndex(0);
      window.scrollTo(0, 0);
    } else if (transitionType === 'finish') {
      trackEvent('survey_flow_completed', {
        answered_questions: answeredCount,
      });
      setIsCalculating(true);
      setTimeout(() => {
        router.replace('/report');
      }, 2000);
    }
    setTransitionType(null);
  };

  const handleExit = () => {
    router.replace('/');
  };



  // Prevent accidental close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (answeredCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answeredCount]);

  // 1. 계산 중(로딩) 화면
  if (isCalculating) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
        <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex flex-col shadow-2xl items-center justify-center px-10 text-center relative">
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl animate-bounce">✨</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-text-main dark:text-white mb-4 animate-pulse">
            {currentModule === 'child' ? t('survey.analyzingChild') : t('survey.analyzingFamily')}
          </h2>
          <p className="text-text-sub dark:text-slate-400 leading-relaxed break-keep">
            {currentModule === 'child'
              ? (intake.childName
                  ? t('survey.analyzingChildDesc', { name: intake.childName })
                  : t('survey.analyzingChildDescDefault'))
              : t('survey.analyzingFamilyDesc')
            }
          </p>
        </div>
      </div>
    );
  }

  // 2. 질문 데이터 로딩 체크
  if (!currentQuestion) return (
    <div className="bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark h-full min-h-screen flex items-center justify-center shadow-2xl relative">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );

  return (
    <div className="text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body transition-colors duration-500 dark:!bg-background-dark" style={{ backgroundColor: accentBg }}>
      <div className="w-full max-w-md h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative dark:!bg-background-dark" style={{ backgroundColor: accentBg }}>
        <Navbar title={title} showBack onBackClick={handlePrev} />

        {/* Progress Bar & Module Tabs */}
        <div className="bg-white/80 dark:bg-surface-dark backdrop-blur-sm border-b border-beige-main/20 sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs font-semibold text-text-sub">
                {t('survey.questionCount', { current: currentIndex + 1, total: questions.length })}
              </span>
              <span className="text-xs font-bold" style={{ color: accent }}>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-beige-light dark:bg-background-dark rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div
          key={`${currentModule}-${currentIndex}`}
          className="flex-1 px-5 py-4 w-full pb-24 animate-fade-in overflow-y-auto no-scrollbar"
        >
          {/* Context Card */}
          <div className="mb-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-block px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors duration-500" style={{ backgroundColor: accentLight, color: accentText }}>
                {currentModule === 'child'
                  ? (intake.childName ? t('survey.childBehavior', { name: intake.childName }) : t('survey.childBehaviorDefault'))
                  : currentModule === 'parent' ? t('survey.parentTendency') : t('survey.parentingSituation')}
              </div>
            </div>

            <h2 className="text-[17px] sm:text-[19px] font-extrabold text-text-main dark:text-white leading-snug whitespace-pre-line mb-3 break-keep">
              <span className="mr-2 text-[19px]" style={{ color: accent }}>Q.</span>
              {currentQuestion.context}
            </h2>

            <div className="p-3.5 bg-beige-light dark:bg-surface-dark rounded-2xl border border-beige-main/20">
              <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">
                <span className="font-bold text-text-main dark:text-slate-300 mr-1">{t('survey.tipLabel')}</span>
                {t('survey.tipText')}
              </p>
            </div>
          </div>

          {/* Choices (BARS) */}
          <div className="space-y-2.5">
            {currentQuestion.choices?.map((choice, idx) => {
              const score = idx + 1; // 1-based score
              const isSelected = currentAnswer === score;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group flex items-center gap-3.5 ${isSelected
                    ? 'shadow-card scale-[1.01] z-10'
                    : 'border-transparent bg-white dark:bg-surface-dark shadow-sm hover:shadow-card hover:-translate-y-0.5'
                    }`}
                  style={isSelected ? { borderColor: accent, backgroundColor: `${accent}08` } : undefined}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 transition-colors ${
                      !isSelected ? 'bg-beige-light dark:bg-background-dark text-text-sub' : ''
                    }`}
                    style={isSelected ? { backgroundColor: accent, color: 'white' } : undefined}
                  >
                    {score}
                  </div>
                  <span
                    className={`text-[14px] sm:text-[15px] leading-snug break-keep flex-1 font-medium ${isSelected ? 'text-text-main dark:text-white' : 'text-text-sub dark:text-slate-300'}`}
                    style={isSelected ? { textShadow: '0.4px 0 0 currentColor' } : undefined}
                  >
                    {choice}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Navigation (Safe Area) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md border-t border-beige-main/20 px-4 py-3 pb-6 sm:pb-3 z-20">
          <div className="max-w-2xl mx-auto flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={handlePrev} className="text-text-sub hover:text-text-main" icon={<Icon name="arrow_back" size="sm" />}>
              {t('common.previous')}
            </Button>

            <div className="text-[10px] uppercase tracking-widest" style={{ color: `${accent}80` }}>
              {currentModule === 'child' ? 'Child Temperament' : currentModule === 'parent' ? 'Parent Temperament' : 'Parenting Style'}
            </div>
          </div>
        </div>

        {/* Transition Modal */}
        {showTransitionModal && transitionType && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 max-w-sm w-full shadow-card transform transition-all scale-100">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-primary/5 rounded-full flex items-center justify-center">
                  <span className="text-4xl">
                    {transitionType === 'toParent' ? '✨' :
                      transitionType === 'toParenting' ? '🤝' : '🎉'}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-text-main dark:text-white mb-3">
                  {transitionType === 'toParent' ? t('survey.childComplete') :
                    transitionType === 'toParenting' ? t('survey.parentComplete') : t('survey.allComplete')}
                </h3>

                <p className="text-text-sub dark:text-slate-300 mb-8 leading-relaxed break-keep whitespace-pre-line">
                  {transitionType === 'toParent'
                    ? t('survey.toParentDesc')
                    : transitionType === 'toParenting'
                    ? t('survey.toParentingDesc')
                    : t('survey.finishDesc')
                  }
                </p>

                <Button size="lg" fullWidth onClick={handleTransitionConfirm} className="rounded-2xl h-16 text-lg font-bold shadow-glow">
                  {transitionType === 'finish' ? t('survey.viewResults') : t('survey.nextStep')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Exit Modal */}
        {showExitModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-8 max-w-xs w-full shadow-card">
              <h3 className="text-lg font-bold text-text-main dark:text-white text-center mb-2">{t('survey.exitTitle')}</h3>
              <p className="text-sm text-center text-text-sub mb-6 whitespace-pre-line">{t('survey.exitDescription')}</p>
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setShowExitModal(false)}>{t('survey.continueBtn')}</Button>
                <Button variant="ghost" fullWidth onClick={handleExit} className="text-red-500 bg-red-50 hover:bg-red-100">{t('survey.quitBtn')}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SurveyContent />
    </Suspense>
  );
}

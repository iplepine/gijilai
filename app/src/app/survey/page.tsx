'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { CHILD_QUESTIONS, PARENT_QUESTIONS, PARENTING_STYLE_QUESTIONS } from '@/data/questions';

type SurveyModule = 'child' | 'parent' | 'parenting';

function SurveyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type'); // 'CHILD' | 'PARENT' | 'STYLE'

  const {
    intake,
    cbqResponses,
    atqResponses,
    parentingResponses,
    setCbqResponse,
    setAtqResponse,
    setParentingResponse
  } = useAppStore();

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

  // 현재 모듈에 따른 질문 목록과 응답 상태 가져오기
  const getModuleData = useCallback(() => {
    switch (currentModule) {
      case 'child':
        return {
          questions: CHILD_QUESTIONS,
          responses: cbqResponses,
          setResponse: setCbqResponse,
          title: '아이 기질',
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
          title: '양육자 기질',
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
          title: '양육 태도',
          accent: '#7B8CDE',        // Soft Lavender-Blue
          accentBg: '#F5F5FC',      // Lavender tinted background
          accentLight: '#7B8CDE20',  // Badge bg
          accentText: '#5563B0',    // Badge text
          nextModule: null
        };
    }
  }, [currentModule, cbqResponses, atqResponses, parentingResponses, setCbqResponse, setAtqResponse, setParentingResponse]);

  const { questions, responses, setResponse, title, accent, accentBg, accentLight, accentText } = getModuleData();
  const currentQuestion = questions[currentIndex];
  const currentAnswer = responses[String(currentQuestion?.id)];

  // 진행률 계산
  const totalQuestions = CHILD_QUESTIONS.length + PARENT_QUESTIONS.length + PARENTING_STYLE_QUESTIONS.length;
  const answeredCount =
    Object.keys(cbqResponses).length +
    Object.keys(atqResponses).length +
    Object.keys(parentingResponses).length;
  const progress = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));

  const goToNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Current module finished
      if (currentModule === 'child') {
        // 아이 기질 완료 → 즉시 아이 리포트 화면으로 이동 (안 A)
        router.replace('/report?child_only=true');
      } else if (currentModule === 'parent') {
        // 부모 기질 완료 시 양육 태도 안내 다이얼로그 노출
        setTransitionType('toParenting');
        setShowTransitionModal(true);
      } else if (currentModule === 'parenting') {
        // 마지막 양육 태도 검사 완료 시 결과 확인 다이얼로그 노출
        setTransitionType('finish');
        setShowTransitionModal(true);
      }
    }
  }, [currentIndex, questions.length, currentModule, router]);

  const handleSelect = useCallback((idx: number) => {
    if (isCalculating || isAdvancing) return; // 분석 중이거나 다음 문항으로 넘어가는 중이면 클릭 방지

    const score = idx + 1;
    setResponse(String(currentQuestion.id), score);
    setIsAdvancing(true);

    // Auto advance with delay
    setTimeout(() => {
      goToNext();
      setIsAdvancing(false);
    }, 300);
  }, [setResponse, currentQuestion?.id, goToNext, isCalculating, isAdvancing]);

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
            {currentModule === 'child' ? '아이 기질 분석 중...' : '우리 가족 기질 분석 중...'}
          </h2>
          <p className="text-text-sub dark:text-slate-400 leading-relaxed break-keep">
            {currentModule === 'child'
              ? <>{intake.childName || '아이'}의 소중한 답변을 바탕으로<br />딱 맞는 <strong>맞춤형 기질 리포트</strong>를 작성하고 있습니다.</>
              : <>아이와 양육자의 기질이 만나는<br /><strong>아름다운 하모니</strong>를 분석 리포트에 담아내고 있습니다.</>
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
    <div className="text-text-main dark:text-gray-100 min-h-screen flex flex-col items-center font-body transition-colors duration-500" style={{ backgroundColor: accentBg }}>
      <div className="w-full max-w-md h-full min-h-screen flex flex-col shadow-2xl overflow-x-hidden relative" style={{ backgroundColor: accentBg }}>
        <Navbar title={title} showBack onBackClick={handlePrev} />

        {/* Progress Bar & Module Tabs */}
        <div className="bg-white/80 dark:bg-surface-dark backdrop-blur-sm border-b border-beige-main/20 sticky top-0 z-10">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs font-semibold text-text-sub">
                문항 {currentIndex + 1} <span className="text-text-sub/30">/</span> {questions.length}
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
                {currentModule === 'child' ? `${intake.childName || '아이'}의 행동` :
                  currentModule === 'parent' ? '나(양육자)의 성향' : '양육 상황'}
              </div>
            </div>

            <h2 className="text-[17px] sm:text-[19px] font-extrabold text-text-main dark:text-white leading-snug whitespace-pre-line mb-3 break-keep">
              <span className="mr-2 text-[19px]" style={{ color: accent }}>Q.</span>
              {currentQuestion.context}
            </h2>

            <div className="p-3.5 bg-beige-light dark:bg-surface-dark rounded-2xl border border-beige-main/20">
              <p className="text-[13px] text-text-sub dark:text-slate-400 leading-relaxed break-keep">
                <span className="font-bold text-text-main dark:text-slate-300 mr-1">Tip.</span>
                상황이 완벽히 똑같지 않더라도, <strong>평소 모습이나 가장 가까운 느낌</strong>을 골라주세요.
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
              이전
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
                  {transitionType === 'toParent' ? '아이 기질 검사 완료!' :
                    transitionType === 'toParenting' ? '양육자 기질 검사 완료!' : '모든 검사가 끝났어요!'}
                </h3>

                <p className="text-text-sub dark:text-slate-300 mb-8 leading-relaxed break-keep">
                  {transitionType === 'toParent' ? (
                    <>이제 <strong>양육자(본인)</strong>의 기질을 알아볼까요?<br />아이와 얼마나 잘 맞는지 분석해드려요.</>
                  ) : transitionType === 'toParenting' ? (
                    <>마지막으로 <strong>평소 양육 스타일</strong>을 체크할게요.<br />구체적인 육아 솔루션이 제공됩니다.</>
                  ) : (
                    <>수고하셨습니다!<br />이제 우리 가족만의 <strong>특별한 기질 분석 리포트</strong>를 확인하러 가볼까요?</>
                  )}
                </p>

                <Button size="lg" fullWidth onClick={handleTransitionConfirm} className="rounded-2xl h-16 text-lg font-bold shadow-glow">
                  {transitionType === 'finish' ? '결과 보러 가기' : '다음 단계로'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Exit Modal */}
        {showExitModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-[2rem] p-8 max-w-xs w-full shadow-card">
              <h3 className="text-lg font-bold text-text-main dark:text-white text-center mb-2">잠깐! 나가시겠어요?</h3>
              <p className="text-sm text-center text-text-sub mb-6">진행 중인 내용은 저장되지만,<br />완료하지 않으면 결과를 볼 수 없어요.</p>
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setShowExitModal(false)}>계속 하기</Button>
                <Button variant="ghost" fullWidth onClick={handleExit} className="text-red-500 bg-red-50 hover:bg-red-100">그만두기</Button>
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SurveyContent />
    </Suspense>
  );
}

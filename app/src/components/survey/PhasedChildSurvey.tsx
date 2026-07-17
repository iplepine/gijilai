'use client';

// 차수화(점진적 심화형) 아동 검사 화면 — DRAFT.
// ASSESSMENT_PHASED_ENABLED 플래그 뒤에서만 렌더된다(기본 off).
// 로직은 buildAssessmentFlow(검증됨)에 위임하고, 이 컴포넌트는 표시만 담당.
// 차수를 마치면 "심화 검사 받기" 체크포인트를 보여준다 — 재검사가 아니라 "더 정밀한 측정".
// ⚠️ 카피·디자인은 1차 초안이며, 인증 플로우 실측 테스트가 필요하다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getFeatureAccess } from '@/lib/access';
import { CONFIDENCE_CALIBRATED, FREE_PHASE_MAX } from '@/lib/assessmentConfig';
import { db } from '@/lib/db';
import { CHILD_ASSESSMENT_BANK } from '@/data/childAssessmentBank';
import { buildAssessmentFlow } from '@/lib/assessmentFlow';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { AssessmentTrendCard } from './AssessmentTrendCard';

const ACCENT = '#E5A150';

type ChildResult = ReturnType<typeof TemperamentClassifier.analyzeChild>;
type Confidence = ReturnType<typeof buildAssessmentFlow>['confidence'];

function ResultSummary({
  result,
  confidence,
  eyebrow,
}: {
  result: ChildResult;
  confidence: Confidence;
  eyebrow: string;
}) {
  return (
    <>
      <p className="text-[12px] font-bold tracking-wide" style={{ color: ACCENT }}>{eyebrow}</p>
      <h1 className="mt-2 text-[24px] font-black text-text-main">
        {result.emoji} {result.label}
      </h1>
      <p className="mt-2 text-[14px] text-text-sub leading-relaxed">{result.desc}</p>

      {/* 신뢰도 정확도 박스는 캘리브레이션 후에만 노출(§5.4 가짜 신뢰도 금지). */}
      {CONFIDENCE_CALIBRATED && (
        <div className="mt-5 rounded-[20px] bg-white dark:bg-surface-dark p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-main">측정 정확도</span>
            <span className="text-[13px] font-black" style={{ color: ACCENT }}>
              {confidence.level} · {confidence.pct}%
            </span>
          </div>
          {confidence.boundaryDims.length > 0 && (
            <p className="mt-2 text-[12px] text-text-sub leading-relaxed">
              {confidence.boundaryDims.join(', ')} 차원이 경계에 있어, 추가 문항으로도 단정이 어려울 수 있어요.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function PhasedChildSurvey() {
  const router = useRouter();
  const { user } = useAuth();
  const { intake, cbqResponses, setCbqResponse, selectedChildId } = useAppStore();
  const [hasFullAccess, setHasFullAccess] = useState(false);
  // 구독 조회가 끝나기 전엔 게이팅을 확정하지 않는다 — 확정 전에 잠금 UI를 보여주면
  // 구독자에게 "구독하고 이어가기"가 뜨고 결제 화면으로 튕겨나간다.
  const [accessReady, setAccessReady] = useState(false);
  const [enteredPhase, setEnteredPhase] = useState(0); // 사용자가 "심화 받기"로 진입한 차수
  const savedPhaseRef = useRef(-1);
  // 이전 문항을 다시 보는 중이면 그 인덱스(null=자연 흐름: 첫 미응답 문항).
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  // 선택 직후 220ms 동안 잡아두는 값 — 선택 표시를 보여주고, 그 사이 입력을 잠근다.
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [navDirection, setNavDirection] = useState<'next' | 'prev'>('next');
  const advanceTimer = useRef<number | null>(null);
  const confirm = useConfirm();

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  // 클라이언트 구독/접근 상태 — access.ts 의 hasActiveSubscription 와 동일한 쿼리. 실패 시 fail-closed.
  useEffect(() => {
    if (!user) {
      setAccessReady(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['ACTIVE', 'PAST_DUE'])
          .gte('current_period_end', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        const access = getFeatureAccess({ userCreatedAt: user.created_at, hasSubscription: !!data });
        setHasFullAccess(access.hasFullAccess);
      } catch {
        /* fail-closed: phase≥2 잠금 유지 */
      } finally {
        if (active) setAccessReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const flow = useMemo(
    () =>
      buildAssessmentFlow({
        bank: CHILD_ASSESSMENT_BANK,
        child: { birthDate: intake.birthDate || '2020-01-01' },
        answers: cbqResponses,
        hasFullAccess,
      }),
    [intake.birthDate, cbqResponses, hasFullAccess],
  );

  const { numPhases, completedPhase } = flow;
  const targetPhase = Math.min(completedPhase + 1, numPhases);
  const phaseFullyDone = completedPhase >= numPhases;
  // accessReady 전에는 잠금으로 단정하지 않는다(구독자 오인 방지).
  const gatedNext = accessReady && !hasFullAccess && targetPhase > FREE_PHASE_MAX;

  // 차수 완료 시점마다 정확한 상태로 저장(전부 끝 → COMPLETED, 그 외 → IN_PROGRESS).
  useEffect(() => {
    if (!user || completedPhase < 1 || savedPhaseRef.current === completedPhase) return;
    savedPhaseRef.current = completedPhase;
    const status = completedPhase >= numPhases ? 'COMPLETED' : 'IN_PROGRESS';
    db.saveSurveyResponses(user.id, 'CHILD', cbqResponses, status, selectedChildId).catch(() => {});
  }, [user, completedPhase, numPhases, cbqResponses, selectedChildId]);

  const result = useMemo(() => TemperamentClassifier.analyzeChild(flow.scores), [flow.scores]);

  const view: 'TERMINAL' | 'CHECKPOINT' | 'QUESTION' = phaseFullyDone
    ? 'TERMINAL'
    : completedPhase >= 1 && enteredPhase < targetPhase
      ? 'CHECKPOINT'
      : 'QUESTION';

  const proceedToDeeper = () => {
    // 접근 권한이 확정되기 전에는 진입도 결제 유도도 하지 않는다.
    if (!accessReady) return;
    if (gatedNext) {
      router.push('/settings/subscription');
      return;
    }
    setEnteredPhase(targetPhase);
  };

  // ── 모든 차수 완료 ────────────────────────────────────────────────────────
  if (view === 'TERMINAL') {
    return (
      <div className="min-h-screen flex flex-col items-center font-body dark:!bg-background-dark" style={{ backgroundColor: '#FFF8F0' }}>
        <div className="w-full max-w-md flex flex-col min-h-screen">
          <Navbar title="우리 아이 기질" showBack onBackClick={() => router.push('/')} />
          <main className="flex-1 px-6 py-8">
            <ResultSummary result={result} confidence={flow.confidence} eyebrow="정밀 검사까지 완료" />
            <Button
              size="lg"
              fullWidth
              onClick={() => router.replace('/report?child_only=true')}
              className="mt-6 rounded-2xl h-14 text-[16px] font-bold"
            >
              결과 리포트 보기
            </Button>
            <AssessmentTrendCard childId={selectedChildId} />
          </main>
        </div>
      </div>
    );
  }

  // ── 차수 완료 체크포인트: "더 정확하게 — 심화 검사 받기" ───────────────────
  if (view === 'CHECKPOINT') {
    return (
      <div className="min-h-screen flex flex-col items-center font-body dark:!bg-background-dark" style={{ backgroundColor: '#FFF8F0' }}>
        <div className="w-full max-w-md flex flex-col min-h-screen">
          <Navbar title="우리 아이 기질" showBack onBackClick={() => router.push('/')} />
          <main className="flex-1 px-6 py-8">
            <ResultSummary result={result} confidence={flow.confidence} eyebrow={`${completedPhase}차 검사 완료`} />

            {/* 이 차수는 완결 — 리포트 보기가 기본 행동(여기서 끝내도 만족) */}
            <Button
              size="lg"
              fullWidth
              onClick={() => router.replace('/report?child_only=true')}
              className="mt-6 rounded-2xl h-14 text-[16px] font-bold"
            >
              결과 리포트 보기
            </Button>

            {/* 심화는 강요하지 않는 보조 초대 — 나중에 이어가도 정확도는 쌓인다 */}
            <div className="mt-5 rounded-[20px] border border-secondary/25 bg-secondary/[0.05] p-5">
              <p className="text-[14px] font-bold text-text-main">더 정확하게 보고 싶다면</p>
              <p className="mt-1.5 text-[13px] text-text-sub leading-relaxed">
                {targetPhase}차 검사는 같은 걸 다시 묻는 게 아니라, 아직 보지 못한 모습을 더 들여다보는 단계예요. 지금 바로 안 하셔도 괜찮아요 — 나중에 다시 와도 정확도는 이어서 쌓여요.
                {gatedNext && ' (구독하면 바로 이어서 받을 수 있어요.)'}
              </p>
              <Button
                variant="secondary"
                fullWidth
                onClick={proceedToDeeper}
                disabled={!accessReady}
                className="mt-4 rounded-2xl h-12 text-[14px] font-bold"
              >
                {!accessReady
                  ? '확인 중…'
                  : gatedNext
                    ? `구독하고 ${targetPhase}차 이어가기`
                    : `${targetPhase}차 검사 이어가기`}
              </Button>
            </div>

            <AssessmentTrendCard childId={selectedChildId} />
          </main>
        </div>
      </div>
    );
  }

  // ── 문항 화면 ────────────────────────────────────────────────────────────
  // 첫 미응답 문항 = 진행 한계선. 검토 중이 아니면 이 문항을 보여준다.
  const frontier = flow.visibleItems.findIndex((item) => cbqResponses[String(item.id)] === undefined);
  // 차수가 바뀌어 reviewIndex 가 낡았을 수 있으므로 한계선 안으로 잘라낸다.
  const currentIndex = reviewIndex !== null && reviewIndex < frontier ? reviewIndex : frontier;
  const q = currentIndex >= 0 ? flow.visibleItems[currentIndex] : null;
  if (!q) return null;
  const storedAnswer = cbqResponses[String(q.id)];
  // 선택 직후에는 저장 전이라도 눌린 보기를 즉시 표시한다.
  const displayAnswer = pendingScore ?? storedAnswer;
  const isAdvancing = pendingScore !== null;
  // 진행 표시는 보고 있는 문항이 속한 차수 기준으로 센다 —
  // visibleItems 는 여러 차수를 합친 목록이라 전체 인덱스를 그대로 쓰면 "2차 · 16/15"가 된다.
  const questionPhase = q.phase ?? flow.currentPhase;
  const phaseItems = flow.visibleItems.filter((item) => (item.phase ?? flow.currentPhase) === questionPhase);
  const positionInPhase = phaseItems.findIndex((item) => item.id === q.id) + 1;
  const totalInPhase = phaseItems.length;
  const phasePct = totalInPhase ? Math.round((positionInPhase / totalInPhase) * 100) : 0;

  const handleExit = async () => {
    if (
      await confirm({
        title: '검사를 그만둘까요?',
        description: '지금까지 답한 내용은 저장돼 있어요. 다음에 이어서 하실 수 있어요.',
        confirmLabel: '나가기',
        cancelLabel: '계속하기',
      })
    ) {
      router.push('/');
    }
  };

  // 답을 저장하면 다음 문항이 같은 자리에 즉시 나타난다 —
  // 잠금이 없으면 더블탭의 두 번째 탭이 '읽지도 않은 다음 문항'에 찍힌다.
  const handleSelect = (score: number) => {
    if (isAdvancing) return;
    const questionId = String(q.id);
    setNavDirection('next');
    setPendingScore(score);
    advanceTimer.current = window.setTimeout(() => {
      setCbqResponse(questionId, score);
      // 검토 중이었다면 한 칸 앞으로, 한계선에 닿으면 자연 흐름으로 복귀.
      setReviewIndex((prev) => (prev === null ? null : prev + 1 < frontier ? prev + 1 : null));
      setPendingScore(null);
      advanceTimer.current = null;
    }, 220);
  };

  const handlePrev = () => {
    if (isAdvancing) return;
    if (currentIndex <= 0) {
      void handleExit();
      return;
    }
    setNavDirection('prev');
    setReviewIndex(currentIndex - 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center font-body dark:!bg-background-dark" style={{ backgroundColor: '#FFF8F0' }}>
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        <Navbar title="우리 아이 기질" showBack onBackClick={handlePrev} />

        <div className="bg-white/80 dark:bg-surface-dark/80 backdrop-blur-sm border-b border-beige-main/20 dark:border-white/10 sticky top-0 z-10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-xs font-semibold text-text-sub">
              {questionPhase}차 · {positionInPhase}/{totalInPhase}
            </span>
            <span className="text-xs font-bold" style={{ color: ACCENT }}>{phasePct}%</span>
          </div>
          <div className="h-1.5 bg-beige-light rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${phasePct}%`, backgroundColor: ACCENT }} />
          </div>
        </div>

        {/* key: 문항이 바뀌면 스크롤 위치를 리셋하고 전환 애니메이션을 다시 태운다. */}
        <main
          key={q.id}
          className={`question-slide question-slide-${navDirection} flex-1 px-5 py-4 overflow-y-auto no-scrollbar`}
        >
          <h2 className="text-[18px] font-extrabold text-text-main leading-snug mb-4 break-keep">
            <span className="mr-2" style={{ color: ACCENT }}>Q.</span>
            {q.context}
          </h2>
          <div className="space-y-2.5">
            {q.choices?.map((choice, idx) => {
              const score = idx + 1;
              const isSelected = displayAnswer === score;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(score)}
                  disabled={isAdvancing}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected ? 'shadow-card' : 'border-transparent bg-white dark:bg-surface-dark shadow-sm hover:-translate-y-0.5'
                  }`}
                  style={isSelected ? { borderColor: ACCENT, backgroundColor: `${ACCENT}08` } : undefined}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black shrink-0"
                    style={isSelected ? { backgroundColor: ACCENT, color: 'white' } : { backgroundColor: '#F0E9DF', color: '#8A7A60' }}
                  >
                    {score}
                  </span>
                  <span className={`text-[14px] leading-snug break-keep flex-1 font-medium ${isSelected ? 'text-text-main' : 'text-text-sub'}`}>
                    {choice}
                  </span>
                </button>
              );
            })}
          </div>
        </main>

        <div className="border-t border-beige-main/20 dark:border-white/10 px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex <= 0 || isAdvancing}
            className="text-text-sub"
            icon={<Icon name="arrow_back" size="sm" />}
          >
            이전 문항
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExit} className="text-text-sub">
            나가기
          </Button>
        </div>
      </div>
    </div>
  );
}

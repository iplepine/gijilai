'use client';

// 차수화(점진적 심화형) 아동 검사 화면 — DRAFT.
// ASSESSMENT_PHASED_ENABLED 플래그 뒤에서만 렌더된다(기본 off).
// 로직은 buildAssessmentFlow(검증됨)에 위임하고, 이 컴포넌트는 표시만 담당.
// ⚠️ 카피·디자인은 1차 초안이며, 인증 플로우 실측 테스트가 필요하다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getFeatureAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { CHILD_ASSESSMENT_BANK } from '@/data/childAssessmentBank';
import { buildAssessmentFlow } from '@/lib/assessmentFlow';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { AssessmentTrendCard } from './AssessmentTrendCard';

const ACCENT = '#E5A150';

export function PhasedChildSurvey() {
  const router = useRouter();
  const { user } = useAuth();
  const { intake, cbqResponses, setCbqResponse, selectedChildId } = useAppStore();
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const savedTerminalRef = useRef(false);

  // 클라이언트 구독/접근 상태 — access.ts 의 hasActiveSubscription 와 동일한 쿼리. 실패 시 fail-closed.
  useEffect(() => {
    if (!user) return;
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

  const currentIndex = useMemo(() => {
    const i = flow.visibleItems.findIndex((q) => cbqResponses[String(q.id)] === undefined);
    return i === -1 ? flow.visibleItems.length : i;
  }, [flow.visibleItems, cbqResponses]);

  const atTerminal = currentIndex >= flow.visibleItems.length;

  // 터미널 도달 시 완료 상태 저장(전부 끝 → COMPLETED, 무료 1차 마감 → IN_PROGRESS).
  useEffect(() => {
    if (!atTerminal || !user || savedTerminalRef.current) return;
    savedTerminalRef.current = true;
    const status = flow.nextAction === 'ALL_DONE' ? 'COMPLETED' : 'IN_PROGRESS';
    db.saveSurveyResponses(user.id, 'CHILD', cbqResponses, status, selectedChildId).catch(() => {});
  }, [atTerminal, user, flow.nextAction, cbqResponses, selectedChildId]);

  const result = useMemo(() => TemperamentClassifier.analyzeChild(flow.scores), [flow.scores]);

  // ── 터미널: 결과 + (잠금 시) 다음 차수 업셀 ───────────────────────────────
  if (atTerminal) {
    const locked = flow.nextAction === 'LOCKED';
    const { confidence } = flow;
    return (
      <div className="min-h-screen flex flex-col items-center font-body" style={{ backgroundColor: '#FFF8F0' }}>
        <div className="w-full max-w-md flex flex-col min-h-screen">
          <Navbar title="우리 아이 기질" showBack onBackClick={() => router.push('/')} />
          <main className="flex-1 px-6 py-8">
            <p className="text-[12px] font-bold tracking-wide" style={{ color: ACCENT }}>
              {flow.completedPhase}차 검사 완료
            </p>
            <h1 className="mt-2 text-[24px] font-black text-text-main">
              {result.emoji} {result.label}
            </h1>
            <p className="mt-2 text-[14px] text-text-sub leading-relaxed">{result.desc}</p>

            <div className="mt-5 rounded-[20px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-text-main">측정 신뢰도</span>
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

            <Button
              size="lg"
              fullWidth
              onClick={() => router.replace('/report?child_only=true')}
              className="mt-6 rounded-2xl h-14 text-[16px] font-bold"
            >
              결과 리포트 보기
            </Button>

            {locked && (
              <div className="mt-4 rounded-[20px] border border-beige-main/40 bg-white p-5">
                <p className="text-[14px] font-bold text-text-main">
                  {flow.lockedPhase}차 검사로 더 정확하게
                </p>
                <p className="mt-1 text-[13px] text-text-sub leading-relaxed">
                  문항을 더 풀면 소분류까지 정밀하게 분석하고, 신뢰도가 올라가요. 구독하면 바로 이어서 할 수 있어요.
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => router.push('/settings/subscription')}
                  className="mt-3 rounded-2xl h-12 text-[14px] font-bold"
                >
                  구독하고 {flow.lockedPhase}차 검사 하기
                </Button>
              </div>
            )}

            <AssessmentTrendCard childId={selectedChildId} />
          </main>
        </div>
      </div>
    );
  }

  // ── 문항 화면 ────────────────────────────────────────────────────────────
  const q = flow.visibleItems[currentIndex];
  const currentAnswer = cbqResponses[String(q.id)];
  const phasePct = flow.totalInCurrentPhase
    ? Math.round((flow.answeredInCurrentPhase / flow.totalInCurrentPhase) * 100)
    : 0;

  return (
    <div className="min-h-screen flex flex-col items-center font-body" style={{ backgroundColor: '#FFF8F0' }}>
      <div className="w-full max-w-md flex flex-col min-h-screen relative">
        <Navbar title="우리 아이 기질" showBack onBackClick={() => router.push('/')} />

        <div className="bg-white/80 backdrop-blur-sm border-b border-beige-main/20 sticky top-0 z-10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-xs font-semibold text-text-sub">
              {flow.currentPhase}차 · {flow.answeredInCurrentPhase + 1}/{flow.totalInCurrentPhase}
            </span>
            <span className="text-xs font-bold" style={{ color: ACCENT }}>{phasePct}%</span>
          </div>
          <div className="h-1.5 bg-beige-light rounded-full overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${phasePct}%`, backgroundColor: ACCENT }} />
          </div>
        </div>

        <main className="flex-1 px-5 py-4 overflow-y-auto no-scrollbar">
          <h2 className="text-[18px] font-extrabold text-text-main leading-snug mb-4 break-keep">
            <span className="mr-2" style={{ color: ACCENT }}>Q.</span>
            {q.context}
          </h2>
          <div className="space-y-2.5">
            {q.choices?.map((choice, idx) => {
              const score = idx + 1;
              const isSelected = currentAnswer === score;
              return (
                <button
                  key={idx}
                  onClick={() => setCbqResponse(String(q.id), score)}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3.5 ${
                    isSelected ? 'shadow-card' : 'border-transparent bg-white shadow-sm hover:-translate-y-0.5'
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

        <div className="border-t border-beige-main/20 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="text-text-sub"
            icon={<Icon name="arrow_back" size="sm" />}
          >
            나가기
          </Button>
        </div>
      </div>
    </div>
  );
}

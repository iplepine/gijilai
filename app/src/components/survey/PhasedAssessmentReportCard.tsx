'use client';

// 아이 리포트 하단의 "심화 검사로 더 정확하게" 발견 카드 — DRAFT.
// 자체 게이팅: ASSESSMENT_PHASED_ENABLED off 이거나 더 받을 차수가 없으면 아무것도 안 그린다
// (리포트 페이지에 한 줄 삽입해도 라이브 무영향).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/auth/AuthProvider';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { getFeatureAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { ASSESSMENT_PHASED_ENABLED, CONFIDENCE_CALIBRATED } from '@/lib/assessmentConfig';
import { CHILD_ASSESSMENT_BANK } from '@/data/childAssessmentBank';
import { buildAssessmentFlow } from '@/lib/assessmentFlow';

export function PhasedAssessmentReportCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { intake, cbqResponses } = useAppStore();
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!ASSESSMENT_PHASED_ENABLED || !user) return;
    let active = true;
    (async () => {
      try {
        const [subRes, latest] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .in('status', ['ACTIVE', 'PAST_DUE'])
            .gte('current_period_end', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          db.getLatestSurveyResponses(user.id),
        ]);
        if (!active) return;
        setHasFullAccess(
          getFeatureAccess({ userCreatedAt: user.created_at, hasSubscription: !!subRes.data }).hasFullAccess,
        );
        const childRow = latest['CHILD'];
        setAnswers((childRow?.answers as Record<string, number>) ?? cbqResponses);
      } catch {
        /* 부가 카드 — 실패 시 조용히 생략 */
      }
    })();
    return () => {
      active = false;
    };
  }, [user, cbqResponses]);

  const flow = useMemo(() => {
    if (!answers) return null;
    return buildAssessmentFlow({
      bank: CHILD_ASSESSMENT_BANK,
      child: { birthDate: intake.birthDate || '2020-01-01' },
      answers,
      hasFullAccess,
    });
  }, [answers, intake.birthDate, hasFullAccess]);

  if (!ASSESSMENT_PHASED_ENABLED || !flow) return null;
  // 1차 이상 했고, 아직 더 받을 차수가 남았을 때만 노출
  if (flow.completedPhase < 1 || flow.completedPhase >= flow.numPhases) return null;

  const { confidence } = flow;
  const nextPhase = flow.completedPhase + 1;
  const gated = flow.nextAction === 'LOCKED';

  return (
    <div className="mt-6 rounded-[20px] border border-secondary/30 bg-secondary/[0.06] p-5">
      {/* 정확도 표기는 캘리브레이션 후에만 노출(§5.4 가짜 신뢰도 금지). */}
      {CONFIDENCE_CALIBRATED && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-text-main">측정 정확도</span>
          <span className="text-[13px] font-black text-secondary">
            {confidence.level} · {confidence.pct}%
          </span>
        </div>
      )}
      <p className="mt-3 text-[15px] font-bold text-text-main">심화 검사로 더 정확하게 보기</p>
      <p className="mt-1.5 text-[13px] text-text-sub leading-relaxed">
        같은 걸 다시 묻는 게 아니에요. 아직 보지 못한 모습을 더 들여다보는 단계라, 문항을 풀수록 측정이 정밀해지고 우리 아이를 더 정확히 볼 수 있어요.
      </p>
      <Button
        size="lg"
        fullWidth
        onClick={() => router.push('/survey')}
        className="mt-4 rounded-2xl h-14 text-[15px] font-bold"
      >
        {gated ? `구독하고 심화 검사 받기 (${nextPhase}차)` : `심화 검사 받기 (${nextPhase}차)`}
      </Button>
    </div>
  );
}

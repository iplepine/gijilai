'use client';

// 성장 추적 카드 — 완료된 검사 cycle들의 차원별 변화를 보여준다. DRAFT.
// 데이터는 검증된 buildAssessmentTrend 가 공급. chart.js 의존 없이 CSS 막대로 렌더(SSR/등록 이슈 회피).
// 트렌드(2회차 이상)가 없으면 빈 상태 안내, 로딩/무자격이면 아무것도 안 그림.
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/db';
import { buildAssessmentTrend, type AssessmentTrend } from '@/lib/assessmentTrend';

const DIMS = [
  { key: 'NS', label: '자극추구', color: '#E5A150' },
  { key: 'HA', label: '위험회피', color: '#7B8CDE' },
  { key: 'RD', label: '사회적 민감성', color: '#E2789B' },
  { key: 'P', label: '인내력', color: '#2F4F3E' },
] as const;

function ym(date: string) {
  return date.slice(0, 7).replace('-', '.');
}

function deltaText(delta: number) {
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return '–';
}

export function AssessmentTrendCard({ childId }: { childId: string | null }) {
  const { user } = useAuth();
  const [trend, setTrend] = useState<AssessmentTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !childId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const cycles = await db.getChildAssessmentCycles(user.id, childId);
        if (active) setTrend(buildAssessmentTrend(cycles));
      } catch {
        /* 트렌드는 부가 정보 — 실패해도 조용히 생략 */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, childId]);

  if (loading || !trend) return null;

  // 트렌드 없음(첫 검사) — 다음 재평가 유도
  if (!trend.hasTrend) {
    return (
      <div className="mt-4 rounded-[20px] border border-dashed border-beige-main/50 bg-white/60 p-5 text-center">
        <p className="text-[14px] font-bold text-text-main">성장 그래프</p>
        <p className="mt-1 text-[13px] text-text-sub leading-relaxed">
          나중에 한 번 더 검사하면, 우리 아이가 어떻게 자라는지 변화를 보여드려요.
        </p>
      </div>
    );
  }

  const { points, deltas, biggestChange, latest } = trend;

  return (
    <div className="mt-4 rounded-[20px] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-text-main">성장 그래프</p>
        <p className="text-[12px] text-text-sub">
          {ym(points[0].date)} → {ym(points[points.length - 1].date)} · {points.length}회
        </p>
      </div>

      {biggestChange && (
        <p className="mt-1 text-[13px] text-text-sub">
          가장 큰 변화 ·{' '}
          <span className="font-bold text-text-main">
            {biggestChange.label} {deltaText(biggestChange.delta)}
          </span>
        </p>
      )}

      <div className="mt-4 space-y-3">
        {DIMS.map((d) => {
          const value = latest ? latest[d.key] : 0;
          const delta = deltas ? deltas[d.key] : 0;
          return (
            <div key={d.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-text-main">{d.label}</span>
                <span className="text-[12px] tabular-nums text-text-sub">
                  {value}
                  <span className="ml-1.5 font-semibold" style={{ color: delta === 0 ? '#9CA3AF' : d.color }}>
                    {deltaText(delta)}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-beige-light overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: d.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

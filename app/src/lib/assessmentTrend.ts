// 성장 추적(longitudinal) — 완료된 검사 cycle 시계열을 차원별 변화로 변환.
// 스펙: docs/spec/phased-temperament-assessment.md §5.7
// 입력은 db.getChildAssessmentCycles(...) 결과(COMPLETED CHILD surveys, created_at asc).
import type { ScoreResult } from './TemperamentScorer';

const DIMS = ['NS', 'HA', 'RD', 'P'] as const;
type Dim = (typeof DIMS)[number];

const DIM_LABEL: Record<Dim, string> = {
  NS: '자극추구',
  HA: '위험회피',
  RD: '사회적 민감성',
  P: '인내력',
};

export interface TrendPoint {
  date: string;
  scores: ScoreResult;
}

export interface AssessmentTrend {
  /** 시간순(오름차순) 데이터 포인트. */
  points: TrendPoint[];
  latest: ScoreResult | null;
  previous: ScoreResult | null;
  /** latest - previous (포인트 2개 이상일 때만). */
  deltas: Record<Dim, number> | null;
  /** 변화 폭이 가장 큰 차원. */
  biggestChange: { dim: Dim; label: string; delta: number } | null;
  /** 트렌드를 그릴 수 있는지(포인트 ≥ 2). */
  hasTrend: boolean;
}

function toScores(raw: unknown): ScoreResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const out = { NS: 0, HA: 0, RD: 0, P: 0 };
  for (const d of DIMS) {
    const v = record[d];
    if (typeof v !== 'number' || Number.isNaN(v)) return null;
    out[d] = v;
  }
  return out;
}

export function buildAssessmentTrend(
  cycles: Array<{ created_at?: string | null; scores?: unknown }>,
): AssessmentTrend {
  const points: TrendPoint[] = [];
  for (const cycle of cycles) {
    const scores = toScores(cycle.scores);
    if (scores && cycle.created_at) points.push({ date: cycle.created_at, scores });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));

  const latest = points.length > 0 ? points[points.length - 1].scores : null;
  const previous = points.length >= 2 ? points[points.length - 2].scores : null;

  let deltas: Record<Dim, number> | null = null;
  let biggestChange: { dim: Dim; label: string; delta: number } | null = null;
  if (latest && previous) {
    deltas = { NS: 0, HA: 0, RD: 0, P: 0 };
    for (const d of DIMS) deltas[d] = latest[d] - previous[d];
    const top = DIMS.map((d) => ({ dim: d, label: DIM_LABEL[d], delta: deltas![d] })).sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
    )[0];
    biggestChange = top;
  }

  return { points, latest, previous, deltas, biggestChange, hasTrend: points.length >= 2 };
}

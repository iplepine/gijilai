// 기질검사 신뢰도 산출(실측 통계). 스펙: docs/spec/phased-temperament-assessment.md §5.4
// 신뢰도 = 현재 8타입 판정이 맞을 추정 확률. 문항이 늘면 표준오차가 줄어 상승한다.
// 단, 점수가 임계값 경계에 있으면 문항을 늘려도 낮게 유지되며 이를 사실대로 안내한다.
import type { ScoreResult } from './TemperamentScorer';
import {
  BOUNDARY_MARGIN,
  CONFIDENCE_BAND_THRESHOLDS,
  SE_CONSTANT,
  TYPE_THRESHOLDS,
} from './assessmentConfig';

type TypeDim = 'NS' | 'HA' | 'RD';
const TYPE_DIMS: readonly TypeDim[] = ['NS', 'HA', 'RD'];

/** 오차 함수 근사 (Abramowitz & Stegun 7.1.26), 최대오차 ~1.5e-7. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** 표준정규 누적분포. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** 차원별 표준오차. 응답 문항이 많을수록 작아진다. 0개면 Infinity. */
export function dimSE(nAnswered: number): number {
  return nAnswered > 0 ? SE_CONSTANT / Math.sqrt(nAnswered) : Infinity;
}

/** 해당 차원의 High/Low 판정이 맞을 확률. 임계값에서 0.5, 멀수록 →1.0. */
export function dimConfidence(score: number, threshold: number, nAnswered: number): number {
  const se = dimSE(nAnswered);
  if (!Number.isFinite(se)) return 0.5;
  return normalCdf(Math.abs(score - threshold) / se);
}

/** 8타입 판정 신뢰도 = NS·HA·RD 세 차원이 모두 맞을 확률(독립 가정). */
export function typeConfidence(
  scores: Pick<ScoreResult, TypeDim>,
  counts: Record<TypeDim, number>,
): number {
  return TYPE_DIMS.reduce(
    (acc, d) => acc * dimConfidence(scores[d], TYPE_THRESHOLDS[d], counts[d]),
    1,
  );
}

export type ConfidenceLevel = '예비' | '정밀' | '정밀+';

/** 신뢰도 확률(0..1)을 등급+퍼센트로 변환. */
export function confidenceBand(p: number): { level: ConfidenceLevel; pct: number } {
  const pct = Math.round(p * 100);
  if (p < CONFIDENCE_BAND_THRESHOLDS.precise) return { level: '예비', pct };
  if (p < CONFIDENCE_BAND_THRESHOLDS.precisePlus) return { level: '정밀', pct };
  return { level: '정밀+', pct };
}

/** 임계값 경계(|score-threshold| < BOUNDARY_MARGIN)에 있는 차원들. 정직한 안내용. */
export function boundaryDimensions(scores: Pick<ScoreResult, TypeDim>): TypeDim[] {
  return TYPE_DIMS.filter((d) => Math.abs(scores[d] - TYPE_THRESHOLDS[d]) < BOUNDARY_MARGIN);
}

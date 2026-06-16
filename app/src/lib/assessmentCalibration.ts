// 기질검사 신뢰도 캘리브레이션 통계 (순수 함수).
// 스펙: docs/spec/phased-temperament-assessment.md §5.4
// 절차: docs/operations/assessment-confidence-calibration.md
//
// 목적: AssessmentConfidence.SE_CONSTANT 를 "임의값(18.0)"이 아니라 실제 응답 데이터로
// 실측 산출한다(고전검사이론). 이 모듈은 데이터 I/O 없이 계산만 담당하고,
// Supabase 연결은 app/scripts/calibrate-assessment-confidence.ts 가 맡는다.
import type { Question } from '../types/survey';

/** typeConfidence가 사용하는 분류 차원(스펙 §5.4: NS·HA·RD 곱). P는 타입판정에 미사용. */
export const CALIBRATION_DIMS = ['NS', 'HA', 'RD'] as const;
export type CalibrationDim = (typeof CALIBRATION_DIMS)[number];

/** 표본분산(n-1). 표본 2 미만이면 0. */
export function sampleVariance(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const ss = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  return ss / (n - 1);
}

export function standardDeviation(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 퍼센타일(선형 보간). 신뢰도 분포 → 밴드 컷 결정 참고용. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Cronbach's α (내적 일관성 신뢰도).
 * matrix: 응답자 × 문항 (역채점은 호출 측에서 이미 적용). k≥2, n≥2 필요. 불충분하면 NaN.
 */
export function cronbachAlpha(matrix: number[][]): number {
  const n = matrix.length;
  const k = matrix[0]?.length ?? 0;
  if (n < 2 || k < 2) return NaN;

  let sumItemVar = 0;
  for (let j = 0; j < k; j++) {
    sumItemVar += sampleVariance(matrix.map((row) => row[j]));
  }
  const totalVar = sampleVariance(matrix.map((row) => row.reduce((a, b) => a + b, 0)));
  if (totalVar === 0) return NaN;

  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

/** 측정표준오차(SEM) = SD × √(1−신뢰도). 고전검사이론. 신뢰도>1이면 0으로 클램프. */
export function semFromReliability(sd: number, reliability: number): number {
  return sd * Math.sqrt(Math.max(0, 1 - reliability));
}

/**
 * SE_CONSTANT 역산. 모델은 dimSE(n)=SE_CONSTANT/√n.
 * n=k 문항일 때의 SEM을 알면 SE_CONSTANT = SEM × √k.
 */
export function seConstantFromSem(sem: number, nItems: number): number {
  return sem * Math.sqrt(nItems);
}

export interface DimensionCalibration {
  dimension: CalibrationDim;
  n: number; // 응답자 수
  k: number; // 문항 수
  alpha: number; // Cronbach α
  scoreSd: number; // 0-100 정규화 점수의 SD
  sem: number; // 측정표준오차(0-100)
  seConstant: number; // 역산된 SE_CONSTANT
}

export interface CalibrationReport {
  perDimension: DimensionCalibration[];
  /** 권장 SE_CONSTANT — 차원별 값의 중앙값(모델은 단일 상수 사용). */
  suggestedSeConstant: number;
  /** 분석에 쓰인 최소 응답자 수(차원 중 최소 n). */
  minDimensionN: number;
}

/** 1점 척도 답을 역채점 반영해 정규화 점수 합산 정의(스코어러와 동일). */
function applyReverse(raw: number, reverse: boolean | undefined): number {
  return reverse ? 6 - raw : raw;
}

/**
 * 응답 집합 → 캘리브레이션 리포트.
 * responses: 응답자별 { questionId(number): 1-5 } (부분응답 허용).
 * bank: 문항뱅크(category/reverse 매핑 출처). 차원별로 "그 차원 문항을 모두 답한 응답자"만 사용.
 *
 * 순수 함수 — Supabase 연결 없이 동일 입력에 동일 출력. 테스트로 수학을 검증한다.
 */
export function calibrateFromResponses(
  responses: Array<Record<number, number>>,
  bank: Question[],
): CalibrationReport {
  const perDimension: DimensionCalibration[] = [];

  for (const dim of CALIBRATION_DIMS) {
    const items = bank.filter((q) => q.category === dim);
    const itemIds = items.map((q) => q.id);
    const k = itemIds.length;

    // 그 차원의 문항을 모두 답한 응답자만(내적 일관성은 동일 문항셋에서 산출).
    const complete = responses.filter((r) => itemIds.every((id) => typeof r[id] === 'number'));

    const matrix = complete.map((r) =>
      items.map((q) => applyReverse(r[q.id], q.reverse)),
    );
    const normalizedScores = matrix.map((row) =>
      k > 0 ? (row.reduce((a, b) => a + b, 0) / (k * 5)) * 100 : 0,
    );

    const alpha = cronbachAlpha(matrix);
    const scoreSd = standardDeviation(normalizedScores);
    const sem = semFromReliability(scoreSd, alpha);
    const seConstant = seConstantFromSem(sem, k);

    perDimension.push({
      dimension: dim,
      n: complete.length,
      k,
      alpha,
      scoreSd,
      sem,
      seConstant,
    });
  }

  const usableSeConstants = perDimension
    .map((d) => d.seConstant)
    .filter((v) => Number.isFinite(v));

  return {
    perDimension,
    suggestedSeConstant: usableSeConstants.length ? median(usableSeConstants) : NaN,
    minDimensionN: Math.min(...perDimension.map((d) => d.n)),
  };
}

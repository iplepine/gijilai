import {
  sampleVariance,
  standardDeviation,
  median,
  percentile,
  cronbachAlpha,
  semFromReliability,
  seConstantFromSem,
  calibrateFromResponses,
} from './assessmentCalibration';
import type { Question } from '../types/survey';

// 테스트용 최소 문항(모듈은 id/category/reverse만 읽는다).
const item = (id: number, category: string, reverse = false): Question =>
  ({ id, type: 'CHILD', category, reverse } as unknown as Question);

describe('기초 통계', () => {
  it('표본분산/표준편차 (n-1)', () => {
    expect(sampleVariance([1, 2, 3])).toBeCloseTo(1, 10);
    expect(standardDeviation([1, 2, 3])).toBeCloseTo(1, 10);
    expect(sampleVariance([5])).toBe(0); // 표본<2
  });

  it('중앙값', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('퍼센타일(선형 보간)', () => {
    expect(percentile([0, 10], 0.5)).toBeCloseTo(5, 10);
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
  });
});

describe('Cronbach α', () => {
  it('완전 동일 문항이면 α=1', () => {
    expect(cronbachAlpha([[1, 1, 1], [2, 2, 2], [3, 3, 3]])).toBeCloseTo(1, 10);
  });

  it('손계산 검증: [[1,2],[2,1],[3,3]] → α=2/3', () => {
    expect(cronbachAlpha([[1, 2], [2, 1], [3, 3]])).toBeCloseTo(2 / 3, 10);
  });

  it('표본/문항 부족이면 NaN', () => {
    expect(cronbachAlpha([[1, 2]])).toBeNaN(); // n<2
    expect(cronbachAlpha([[1], [2]])).toBeNaN(); // k<2
  });
});

describe('SEM / SE_CONSTANT 역산', () => {
  it('SEM = SD√(1−r)', () => {
    expect(semFromReliability(20, 0.75)).toBeCloseTo(10, 10);
    expect(semFromReliability(20, 1)).toBe(0);
    expect(semFromReliability(20, 1.2)).toBe(0); // 클램프
  });

  it('SE_CONSTANT = SEM√k', () => {
    expect(seConstantFromSem(10, 4)).toBeCloseTo(20, 10);
  });
});

describe('calibrateFromResponses', () => {
  const bank: Question[] = [
    item(1, 'NS'),
    item(2, 'NS'),
    item(3, 'HA', true), // 역채점
    item(4, 'HA', true),
  ];
  // NS·HA가 역채점 후 동일 패턴 → 각 차원 α=1, SEM=0, seConstant=0.
  const responses = [
    { 1: 5, 2: 5, 3: 1, 4: 1 },
    { 1: 4, 2: 4, 3: 2, 4: 2 },
    { 1: 2, 2: 2, 3: 4, 4: 4 },
    { 1: 1, 2: 1, 3: 5, 4: 5 },
  ];

  it('차원별 그룹화·역채점·집계가 동작한다', () => {
    const report = calibrateFromResponses(responses, bank);
    const ns = report.perDimension.find((d) => d.dimension === 'NS')!;
    const ha = report.perDimension.find((d) => d.dimension === 'HA')!;

    expect(ns.n).toBe(4);
    expect(ns.k).toBe(2);
    expect(ns.alpha).toBeCloseTo(1, 10);
    // HA: 역채점이 적용돼야 NS와 동일 패턴 → α=1 (적용 안 되면 음의 상관으로 깨짐)
    expect(ha.alpha).toBeCloseTo(1, 10);
    expect(ns.seConstant).toBeCloseTo(0, 10);
    expect(report.suggestedSeConstant).toBeCloseTo(0, 10);
  });

  it('차원 문항을 모두 답한 응답자만 사용한다', () => {
    const partial = [...responses, { 1: 3 }]; // NS 일부만 — 제외돼야
    const report = calibrateFromResponses(partial, bank);
    const ns = report.perDimension.find((d) => d.dimension === 'NS')!;
    expect(ns.n).toBe(4); // 부분응답 1건 제외
  });
});

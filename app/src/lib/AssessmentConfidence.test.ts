import {
  boundaryDimensions,
  confidenceBand,
  dimConfidence,
  dimSE,
  erf,
  normalCdf,
  typeConfidence,
} from './AssessmentConfidence';

describe('erf / normalCdf', () => {
  it('erf is odd and bounded', () => {
    expect(erf(0)).toBeCloseTo(0, 6);
    expect(erf(-1)).toBeCloseTo(-erf(1), 6);
    expect(erf(3)).toBeGreaterThan(0.9999);
  });
  it('normalCdf hits known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });
});

describe('dimSE', () => {
  it('shrinks with more items and is Infinity at zero', () => {
    expect(dimSE(0)).toBe(Infinity);
    expect(dimSE(16)).toBeCloseTo(4.5, 6); // 18 / sqrt(16)
    expect(dimSE(36)).toBeLessThan(dimSE(16));
  });
});

describe('dimConfidence', () => {
  it('is exactly 0.5 at the threshold', () => {
    expect(dimConfidence(64, 64, 10)).toBeCloseTo(0.5, 6);
  });
  it('returns 0.5 when no items are answered', () => {
    expect(dimConfidence(80, 64, 0)).toBe(0.5);
  });
  it('rises as more items are answered away from the threshold', () => {
    expect(dimConfidence(80, 64, 12)).toBeGreaterThan(dimConfidence(80, 64, 4));
    expect(dimConfidence(80, 64, 12)).toBeGreaterThan(0.5);
  });
});

describe('typeConfidence', () => {
  it('is the product of the three type dimensions', () => {
    const scores = { NS: 80, HA: 40, RD: 75 };
    const counts = { NS: 8, HA: 8, RD: 8 };
    const expected =
      dimConfidence(80, 64, 8) * dimConfidence(40, 56, 8) * dimConfidence(75, 60, 8);
    expect(typeConfidence(scores, counts)).toBeCloseTo(expected, 10);
  });
  it('rises overall as item counts grow', () => {
    const scores = { NS: 80, HA: 40, RD: 75 };
    const low = typeConfidence(scores, { NS: 4, HA: 4, RD: 4 });
    const high = typeConfidence(scores, { NS: 12, HA: 12, RD: 12 });
    expect(high).toBeGreaterThan(low);
  });
});

describe('confidenceBand', () => {
  it('maps probabilities to honest bands', () => {
    expect(confidenceBand(0.4)).toEqual({ level: '예비', pct: 40 });
    expect(confidenceBand(0.7)).toEqual({ level: '정밀', pct: 70 });
    expect(confidenceBand(0.9)).toEqual({ level: '정밀+', pct: 90 });
  });
});

describe('boundaryDimensions', () => {
  it('flags only dimensions within the boundary margin', () => {
    expect(boundaryDimensions({ NS: 65, HA: 40, RD: 75 })).toEqual(['NS']); // |65-64| = 1 < 5
  });
  it('is empty when all scores clear their thresholds', () => {
    expect(boundaryDimensions({ NS: 80, HA: 40, RD: 75 })).toEqual([]);
  });
});

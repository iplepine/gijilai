import { buildAssessmentTrend } from './assessmentTrend';

const s = (NS: number, HA: number, RD: number, P: number) => ({ NS, HA, RD, P });

describe('buildAssessmentTrend', () => {
  it('returns no trend for empty input', () => {
    const t = buildAssessmentTrend([]);
    expect(t.hasTrend).toBe(false);
    expect(t.latest).toBeNull();
    expect(t.deltas).toBeNull();
  });

  it('exposes latest but no deltas for a single cycle', () => {
    const t = buildAssessmentTrend([{ created_at: '2026-01-01', scores: s(70, 40, 60, 50) }]);
    expect(t.hasTrend).toBe(false);
    expect(t.latest).toEqual(s(70, 40, 60, 50));
    expect(t.previous).toBeNull();
    expect(t.deltas).toBeNull();
  });

  it('computes deltas and the biggest change across two cycles', () => {
    const t = buildAssessmentTrend([
      { created_at: '2026-01-01', scores: s(60, 50, 60, 50) },
      { created_at: '2026-04-01', scores: s(72, 48, 61, 50) },
    ]);
    expect(t.hasTrend).toBe(true);
    expect(t.deltas).toEqual({ NS: 12, HA: -2, RD: 1, P: 0 });
    expect(t.biggestChange).toEqual({ dim: 'NS', label: '자극추구', delta: 12 });
  });

  it('sorts unordered cycles chronologically', () => {
    const t = buildAssessmentTrend([
      { created_at: '2026-06-01', scores: s(80, 40, 60, 50) },
      { created_at: '2026-01-01', scores: s(60, 40, 60, 50) },
    ]);
    expect(t.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-06-01']);
    expect(t.latest?.NS).toBe(80);
    expect(t.previous?.NS).toBe(60);
  });

  it('skips cycles with malformed or missing scores', () => {
    const t = buildAssessmentTrend([
      { created_at: '2026-01-01', scores: s(60, 40, 60, 50) },
      { created_at: '2026-02-01', scores: { NS: 70 } }, // incomplete → skipped
      { created_at: '2026-03-01', scores: null },
      { created_at: null, scores: s(99, 99, 99, 99) }, // no date → skipped
    ]);
    expect(t.points).toHaveLength(1);
    expect(t.hasTrend).toBe(false);
  });
});

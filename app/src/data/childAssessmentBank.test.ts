import { CHILD_ASSESSMENT_BANK, DRAFT_CHILD_ITEM_IDS } from './childAssessmentBank';
import { completedPhase, selectItems } from '../lib/AssessmentPhase';
import { ASSESSMENT_PHASES_CHILD, PHASE_ITEM_COUNTS } from '../lib/assessmentConfig';

const child = { birthDate: '2021-06-13' };
const AT = new Date('2026-06-13');

describe('CHILD_ASSESSMENT_BANK composition (스펙 §5.2)', () => {
  it('has 45 items with unique ids', () => {
    expect(CHILD_ASSESSMENT_BANK).toHaveLength(45);
    const ids = CHILD_ASSESSMENT_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(45);
  });

  it('every item is fully tagged (phase, category, facet, 5 choices)', () => {
    for (const q of CHILD_ASSESSMENT_BANK) {
      expect(q.type).toBe('CHILD');
      expect([1, 2, 3]).toContain(q.phase);
      expect(['NS', 'HA', 'RD', 'P']).toContain(q.category);
      expect(typeof q.facet).toBe('string');
      expect(q.choices).toHaveLength(5);
    }
  });

  it('matches the per-phase item counts from config', () => {
    for (let k = 1; k <= ASSESSMENT_PHASES_CHILD; k += 1) {
      const count = CHILD_ASSESSMENT_BANK.filter((q) => q.phase === k).length;
      expect(count).toBe(PHASE_ITEM_COUNTS[k - 1]);
    }
  });

  it('has the target per-dimension distribution (NS12 / HA12 / RD12 / P9)', () => {
    const by = (c: string) => CHILD_ASSESSMENT_BANK.filter((q) => q.category === c).length;
    expect(by('NS')).toBe(12);
    expect(by('HA')).toBe(12);
    expect(by('RD')).toBe(12);
    expect(by('P')).toBe(9);
  });

  it('marks every HA item as reverse-scored', () => {
    for (const q of CHILD_ASSESSMENT_BANK.filter((x) => x.category === 'HA')) {
      expect(q.reverse).toBe(true);
    }
  });

  it('covers all 5 facets in every dimension', () => {
    for (const dim of ['NS', 'HA', 'RD', 'P']) {
      const facets = new Set(
        CHILD_ASSESSMENT_BANK.filter((q) => q.category === dim).map((q) => q.facet),
      );
      expect(facets.size).toBe(5);
    }
  });

  it('flags exactly the 25 new items as DRAFT for clinical review', () => {
    expect(DRAFT_CHILD_ITEM_IDS).toHaveLength(25);
    expect(Math.min(...DRAFT_CHILD_ITEM_IDS)).toBeGreaterThan(100);
  });
});

describe('CHILD_ASSESSMENT_BANK works with the phase engine', () => {
  it('selectItems resolves the full bank without BankIncompleteError', () => {
    const selected = selectItems(CHILD_ASSESSMENT_BANK, child, 0, ASSESSMENT_PHASES_CHILD, AT);
    expect(selected).toHaveLength(45);
    expect(selected.filter((q) => q.phase === 1)).toHaveLength(15);
  });

  it('completedPhase advances as each cumulative phase is answered', () => {
    const selected = selectItems(CHILD_ASSESSMENT_BANK, child, 0, ASSESSMENT_PHASES_CHILD, AT);
    const idsUpTo = (p: number) =>
      new Set(selected.filter((q) => (q.phase ?? 0) <= p).map((q) => q.id));
    expect(completedPhase(idsUpTo(1), selected, 3)).toBe(1);
    expect(completedPhase(idsUpTo(2), selected, 3)).toBe(2);
    expect(completedPhase(idsUpTo(3), selected, 3)).toBe(3);
  });
});

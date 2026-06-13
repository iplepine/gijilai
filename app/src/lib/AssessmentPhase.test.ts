import {
  ageBandOf,
  BankIncompleteError,
  completedPhase,
  reassessmentDue,
  selectItems,
} from './AssessmentPhase';
import type { Question } from '../types/survey';

function q(
  id: number,
  phase: 1 | 2 | 3,
  category: string,
  facet: string,
  ageBand?: '3-4' | '5-7' | 'all',
): Question {
  return { id, type: 'CHILD', category, facet, phase, ageBand };
}

const PHASES = [1, 2, 3] as const;
const DIMS = ['NS', 'HA', 'RD', 'P'] as const;
// 3 phases × 4 dims, one facet/slot each = 12-item minimal complete bank
const BANK: Question[] = PHASES.flatMap((p) =>
  DIMS.map((c) => q(p * 10 + DIMS.indexOf(c), p, c, `${c}-f`)),
);
const child = { birthDate: '2021-06-13' }; // age 5 on 2026-06-13 → '5-7'
const AT = new Date('2026-06-13');

describe('ageBandOf', () => {
  it('returns 3-4 under age 5', () => {
    expect(ageBandOf('2022-06-13', AT)).toBe('3-4'); // age 4
  });
  it('returns 5-7 at age 5+', () => {
    expect(ageBandOf('2021-06-13', AT)).toBe('5-7'); // age 5
  });
  it('falls back to 5-7 on an invalid date', () => {
    expect(ageBandOf('not-a-date', AT)).toBe('5-7');
  });
});

describe('selectItems', () => {
  it('selects one item per slot across all phases', () => {
    const sel = selectItems(BANK, child, 0, 3, AT);
    expect(sel.length).toBe(12);
    expect(sel.filter((x) => x.phase === 1).length).toBe(4);
    expect(sel.filter((x) => x.phase === 3).length).toBe(4);
  });

  it('rotates deterministically by cycleIndex within a multi-candidate slot', () => {
    const rotBank: Question[] = [
      q(11, 1, 'NS', 'NS-f'),
      q(12, 1, 'NS', 'NS-f'), // phase1 NS slot has 2 candidates
      q(13, 1, 'HA', 'HA-f'),
      q(14, 1, 'RD', 'RD-f'),
      q(15, 1, 'P', 'P-f'),
      q(21, 2, 'NS', 'NS-f'),
      q(31, 3, 'NS', 'NS-f'),
    ];
    const pick = (cycle: number) =>
      selectItems(rotBank, child, cycle, 3, AT).find((x) => x.phase === 1 && x.category === 'NS')!
        .id;
    expect(pick(0)).toBe(11);
    expect(pick(1)).toBe(12);
    expect(pick(2)).toBe(11); // wraps
  });

  it('excludes items whose ageBand does not match the child', () => {
    const bank: Question[] = [
      q(11, 1, 'NS', 'NS-f', '3-4'), // wrong band for a 5-7 child
      q(12, 1, 'NS', 'NS-f', '5-7'),
      q(13, 1, 'HA', 'HA-f'),
      q(14, 1, 'RD', 'RD-f'),
      q(15, 1, 'P', 'P-f'),
      q(21, 2, 'NS', 'NS-f'),
      q(31, 3, 'NS', 'NS-f'),
    ];
    const nsPhase1 = selectItems(bank, child, 0, 3, AT).filter(
      (x) => x.phase === 1 && x.category === 'NS',
    );
    expect(nsPhase1.map((x) => x.id)).toEqual([12]);
  });

  it('throws BankIncompleteError when a phase has no items', () => {
    const incomplete = BANK.filter((x) => x.phase !== 3);
    expect(() => selectItems(incomplete, child, 0, 3, AT)).toThrow(BankIncompleteError);
  });
});

describe('completedPhase', () => {
  const selected = selectItems(BANK, child, 0, 3, AT);
  const idsOfPhase = (p: number) =>
    selected.filter((x) => (x.phase ?? 0) <= p).map((x) => x.id);

  it('is 0 when nothing is answered', () => {
    expect(completedPhase(new Set(), selected, 3)).toBe(0);
  });
  it('advances one phase at a time as cumulative items are answered', () => {
    expect(completedPhase(new Set(idsOfPhase(1)), selected, 3)).toBe(1);
    expect(completedPhase(new Set(idsOfPhase(2)), selected, 3)).toBe(2);
    expect(completedPhase(new Set(idsOfPhase(3)), selected, 3)).toBe(3);
  });
  it('does not advance on a partially-answered phase', () => {
    const partial = new Set([...idsOfPhase(1), idsOfPhase(2)[idsOfPhase(2).length - 1]]);
    expect(completedPhase(partial, selected, 3)).toBe(1);
  });
});

describe('reassessmentDue', () => {
  it('is false with no completed cycle', () => {
    expect(reassessmentDue(null, child, AT)).toBe(false);
  });
  it('is true after the interval elapses', () => {
    expect(reassessmentDue({ created_at: '2026-01-01' }, child, AT)).toBe(true); // >90 days
  });
  it('is false within the interval and same age band', () => {
    const stable = { birthDate: '2020-01-01' }; // age 6 at both dates — band unchanged
    expect(reassessmentDue({ created_at: '2026-05-20' }, stable, AT)).toBe(false); // ~24 days
  });
  it('is true when the age band changes within the interval', () => {
    const c = { birthDate: '2021-03-01' };
    // created 2026-02-01 → age 4 ('3-4'); now 2026-04-01 → age 5 ('5-7'); ~59 days
    expect(reassessmentDue({ created_at: '2026-02-01' }, c, new Date('2026-04-01'))).toBe(true);
  });
});

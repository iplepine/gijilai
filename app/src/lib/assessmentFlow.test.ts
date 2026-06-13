import { buildAssessmentFlow } from './assessmentFlow';
import { selectItems } from './AssessmentPhase';
import { CHILD_ASSESSMENT_BANK } from '../data/childAssessmentBank';

const child = { birthDate: '2021-06-13' };
const AT = new Date('2026-06-13');
const selected = selectItems(CHILD_ASSESSMENT_BANK, child, 0, 3, AT);
const phaseIds = (p: number) => selected.filter((q) => (q.phase ?? 0) <= p).map((q) => q.id);
const answersFor = (ids: number[], score = 5): Record<string, number> =>
  Object.fromEntries(ids.map((id) => [String(id), score]));

const base = { bank: CHILD_ASSESSMENT_BANK, child, at: AT };

describe('buildAssessmentFlow', () => {
  it('starts a free user on phase 1 with 15 visible items', () => {
    const s = buildAssessmentFlow({ ...base, answers: {}, hasFullAccess: false });
    expect(s.currentPhase).toBe(1);
    expect(s.accessiblePhase).toBe(1);
    expect(s.visibleItems).toHaveLength(15);
    expect(s.nextAction).toBe('CONTINUE');
  });

  it('locks a free user at phase 2 after finishing phase 1', () => {
    const s = buildAssessmentFlow({ ...base, answers: answersFor(phaseIds(1)), hasFullAccess: false });
    expect(s.completedPhase).toBe(1);
    expect(s.nextAction).toBe('LOCKED');
    expect(s.lockedPhase).toBe(2);
  });

  it('lets a full-access user continue into phase 2', () => {
    const s = buildAssessmentFlow({ ...base, answers: answersFor(phaseIds(1)), hasFullAccess: true });
    expect(s.accessiblePhase).toBe(3);
    expect(s.currentPhase).toBe(2);
    expect(s.visibleItems).toHaveLength(45);
    expect(s.nextAction).toBe('CONTINUE');
  });

  it('reports ALL_DONE when every phase is answered', () => {
    const s = buildAssessmentFlow({ ...base, answers: answersFor(phaseIds(3)), hasFullAccess: true });
    expect(s.completedPhase).toBe(3);
    expect(s.nextAction).toBe('ALL_DONE');
  });

  it('produces a valid confidence band that does not drop with more phases', () => {
    const p1 = buildAssessmentFlow({ ...base, answers: answersFor(phaseIds(1)), hasFullAccess: true });
    const p3 = buildAssessmentFlow({ ...base, answers: answersFor(phaseIds(3)), hasFullAccess: true });
    expect(['예비', '정밀', '정밀+']).toContain(p3.confidence.level);
    expect(p3.confidence.pct).toBeGreaterThanOrEqual(p1.confidence.pct);
  });
});

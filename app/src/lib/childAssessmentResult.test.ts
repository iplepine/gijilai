import { CHILD_ASSESSMENT_BANK } from '../data/childAssessmentBank';
import { CHILD_QUESTIONS } from '../data/questions';
import { buildAssessmentFlow } from './assessmentFlow';
import { getChildAssessmentResult } from './childAssessmentResult';
import { TemperamentScorer } from './TemperamentScorer';

const birthDate = '2021-06-13';
const at = new Date('2026-06-13');
const legacyAnswers = Object.fromEntries(CHILD_QUESTIONS.map((question) => [question.id, 1]));

describe('child assessment results across survey, home and report', () => {
  it('preserves the legacy 20-question scores and completion without phased evidence', () => {
    const result = getChildAssessmentResult(legacyAnswers);
    expect(result.mode).toBe('legacy');
    expect(result.scores).toEqual(TemperamentScorer.calculate(CHILD_QUESTIONS, legacyAnswers));
    expect(result.status).toBe('COMPLETED');
    expect(result.isReportReady).toBe(true);
  });

  it('does not infer a new assessment version from a legacy partial response', () => {
    const result = getChildAssessmentResult({ 1: 5, 3: 4 });
    expect(result.mode).toBe('legacy');
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.isReportReady).toBe(false);
  });

  it('lets a restored complete first phase open its report without version metadata', () => {
    const answers = Object.fromEntries(CHILD_ASSESSMENT_BANK
      .filter((question) => question.phase === 1).map((question) => [question.id, 3]));
    const result = getChildAssessmentResult(answers, { allowPhaseOneReport: true });
    expect(result.isReportReady).toBe(true);
    expect(result.mode).toBe('legacy');
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.scores).toEqual(TemperamentScorer.calculate(CHILD_QUESTIONS, answers));
    delete answers[1];
    expect(getChildAssessmentResult(answers, { allowPhaseOneReport: true }).isReportReady).toBe(false);
  });

  it.each([1, 2, 3])('matches the checkpoint scores at phase %i', (phase) => {
    const answers = Object.fromEntries(CHILD_ASSESSMENT_BANK
      .filter((question) => question.phase! <= phase)
      .map((question) => [question.id, question.id > 100 ? 5 : 1]));
    const checkpoint = buildAssessmentFlow({
      bank: CHILD_ASSESSMENT_BANK, child: { birthDate }, answers, hasFullAccess: true, at,
    });
    const result = getChildAssessmentResult(answers, { phase, birthDate, at });
    expect(result.scores).toEqual(checkpoint.scores);
    expect(result.completedPhase).toBe(phase);
    expect(result.isReportReady).toBe(true);
    expect(result.status).toBe(phase === 3 ? 'COMPLETED' : 'IN_PROGRESS');
  });

  it('includes additional answered items even when persisted version metadata is absent', () => {
    const answers = Object.fromEntries(CHILD_ASSESSMENT_BANK.map((question) => [question.id, question.id > 100 ? 5 : 1]));
    const result = getChildAssessmentResult(answers, { birthDate, at });
    expect(result.mode).toBe('phased');
    expect(result.scores).toEqual({ NS: 67, HA: 53, RD: 67, P: 56 });
    expect(result.scores).not.toEqual(TemperamentScorer.calculate(CHILD_QUESTIONS, answers));
  });

  it('keeps phase 2 in progress at the overlapping 20-answer boundary', () => {
    const result = getChildAssessmentResult(legacyAnswers, { mode: 'phased', birthDate, at });
    expect(result.completedPhase).toBe(1);
    expect(result.status).toBe('IN_PROGRESS');
  });

  it('recognizes an explicit persisted phased version without additional item ids', () => {
    expect(getChildAssessmentResult(legacyAnswers, { assessmentVersion: 'phased-v1' }).mode).toBe('phased');
    expect(getChildAssessmentResult(legacyAnswers, { assessment_version: 'phased-v1' }).mode).toBe('phased');
  });

  it('does not let unrelated ids convert an incomplete legacy response to completed', () => {
    expect(getChildAssessmentResult({ 1: 5, 9999: 5 }).status).toBe('IN_PROGRESS');
  });
});

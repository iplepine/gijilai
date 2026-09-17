import { CHILD_ASSESSMENT_BANK } from '../data/childAssessmentBank';
import { CHILD_QUESTIONS } from '../data/questions';
import { completedPhase, selectItems } from './AssessmentPhase';
import { ASSESSMENT_PHASES_CHILD } from './assessmentConfig';
import { TemperamentScorer } from './TemperamentScorer';

export interface ChildAssessmentContext {
  mode?: 'legacy' | 'phased';
  phase?: number | null;
  assessmentVersion?: string | null;
  assessment_version?: string | null;
  birthDate?: string | null;
  cycleIndex?: number;
  at?: Date;
  /** A complete free first phase can show a report without reclassifying legacy answers. */
  allowPhaseOneReport?: boolean;
}

const legacyIds = new Set(CHILD_QUESTIONS.map((question) => String(question.id)));
const additionalIds = new Set(
  CHILD_ASSESSMENT_BANK.filter((question) => !legacyIds.has(String(question.id)))
    .map((question) => String(question.id)),
);

/** Keep old assessments unchanged unless the answers or caller identify the phased flow. */
export function getChildAssessmentResult(
  answers: Record<string, number>,
  context: ChildAssessmentContext = {},
) {
  const phased = context.mode === 'phased'
    || (context.mode !== 'legacy' && (
      (context.phase ?? 0) > 0
      || !!(context.assessmentVersion || context.assessment_version)
      || Object.keys(answers).some((id) => additionalIds.has(id))
    ));
  const phasedQuestions = phased || context.allowPhaseOneReport
    ? selectItems(
      CHILD_ASSESSMENT_BANK,
      { birthDate: context.birthDate || '2020-01-01' },
      context.cycleIndex ?? 0,
      ASSESSMENT_PHASES_CHILD,
      context.at,
    )
    : [];
  const questions = phased ? phasedQuestions : CHILD_QUESTIONS;
  const answeredPhase = phasedQuestions.length
    ? completedPhase(new Set(Object.keys(answers).map(Number)), phasedQuestions, ASSESSMENT_PHASES_CHILD)
    : 0;
  const phase = phased ? answeredPhase : 0;
  const complete = phased
    ? phase === ASSESSMENT_PHASES_CHILD
    : questions.every((question) => answers[String(question.id)] !== undefined);

  return {
    mode: phased ? 'phased' as const : 'legacy' as const,
    scores: TemperamentScorer.calculate(questions, answers),
    completedPhase: phase,
    isReportReady: phased ? phase >= 1 : complete || (!!context.allowPhaseOneReport && answeredPhase >= 1),
    status: complete ? 'COMPLETED' as const : 'IN_PROGRESS' as const,
  };
}

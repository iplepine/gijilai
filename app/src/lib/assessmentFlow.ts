// 차수화 검사 플로우의 순수 selector — UI가 소비하는 "두뇌".
// 스펙: docs/spec/phased-temperament-assessment.md §5.1, §5.4, §5.6
import type { Question } from '../types/survey';
import { TemperamentScorer, type ScoreResult } from './TemperamentScorer';
import { completedPhase, selectItems } from './AssessmentPhase';
import { boundaryDimensions, confidenceBand, typeConfidence } from './AssessmentConfidence';
import { ASSESSMENT_PHASES_CHILD, FREE_PHASE_MAX } from './assessmentConfig';

export type AssessmentNextAction = 'CONTINUE' | 'LOCKED' | 'ALL_DONE';

export interface AssessmentFlowState {
  /** 이번 cycle에 선택된 전체 문항(차수순). */
  selected: Question[];
  /** 현재 접근 가능한 차수까지의 문항(게이팅 반영). */
  visibleItems: Question[];
  numPhases: number;
  /** 완전히 응답된 최고 차수(0=없음). */
  completedPhase: number;
  /** 게이팅상 답할 수 있는 최고 차수(무료=FREE_PHASE_MAX, 풀=numPhases). */
  accessiblePhase: number;
  /** 지금 답해야 하는 차수(1-based). */
  currentPhase: number;
  answeredInCurrentPhase: number;
  totalInCurrentPhase: number;
  /** 현재까지 응답으로 산출한 점수. */
  scores: ScoreResult;
  confidence: {
    p: number;
    level: '예비' | '정밀' | '정밀+';
    pct: number;
    boundaryDims: Array<'NS' | 'HA' | 'RD'>;
  };
  nextAction: AssessmentNextAction;
  /** 게이팅으로 잠긴 차수(LOCKED일 때만). */
  lockedPhase: number | null;
}

export function buildAssessmentFlow(params: {
  bank: Question[];
  child: { birthDate: string };
  answers: Record<string, number>;
  hasFullAccess: boolean;
  cycleIndex?: number;
  numPhases?: number;
  at?: Date;
}): AssessmentFlowState {
  const { bank, child, answers, hasFullAccess } = params;
  const numPhases = params.numPhases ?? ASSESSMENT_PHASES_CHILD;
  const cycleIndex = params.cycleIndex ?? 0;
  const at = params.at ?? new Date();

  const selected = selectItems(bank, child, cycleIndex, numPhases, at);
  const answeredIds = new Set(Object.keys(answers).map(Number));

  const accessiblePhase = hasFullAccess ? numPhases : Math.min(FREE_PHASE_MAX, numPhases);
  const visibleItems = selected.filter((q) => (q.phase ?? Infinity) <= accessiblePhase);
  const compPhase = completedPhase(answeredIds, selected, numPhases);
  const currentPhase = Math.min(compPhase + 1, numPhases);

  const phaseItems = (p: number) => selected.filter((q) => q.phase === p);
  const totalInCurrentPhase = phaseItems(currentPhase).length;
  const answeredInCurrentPhase = phaseItems(currentPhase).filter((q) => answeredIds.has(q.id)).length;

  const numericAnswers: Record<number, number> = {};
  for (const [k, v] of Object.entries(answers)) numericAnswers[Number(k)] = v;
  const scores = TemperamentScorer.calculate(selected, numericAnswers);

  const counts: Record<'NS' | 'HA' | 'RD', number> = { NS: 0, HA: 0, RD: 0 };
  for (const q of selected) {
    if (answeredIds.has(q.id) && (q.category === 'NS' || q.category === 'HA' || q.category === 'RD')) {
      counts[q.category] += 1;
    }
  }
  const p = typeConfidence(scores, counts);
  const band = confidenceBand(p);
  const confidence = { p, level: band.level, pct: band.pct, boundaryDims: boundaryDimensions(scores) };

  const allVisibleAnswered =
    visibleItems.length > 0 && visibleItems.every((q) => answeredIds.has(q.id));
  let nextAction: AssessmentNextAction = 'CONTINUE';
  let lockedPhase: number | null = null;
  if (compPhase >= numPhases) {
    nextAction = 'ALL_DONE';
  } else if (allVisibleAnswered && accessiblePhase < numPhases) {
    nextAction = 'LOCKED';
    lockedPhase = accessiblePhase + 1;
  }

  return {
    selected,
    visibleItems,
    numPhases,
    completedPhase: compPhase,
    accessiblePhase,
    currentPhase,
    answeredInCurrentPhase,
    totalInCurrentPhase,
    scores,
    confidence,
    nextAction,
    lockedPhase,
  };
}

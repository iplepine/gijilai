// 기질검사 차수(phase) 파생 · 문항 선택 · 재평가 주기 판정.
// 스펙: docs/spec/phased-temperament-assessment.md §5.1, §5.2, §5.7
import type { AgeBand, Question } from '../types/survey';
import { ASSESSMENT_PHASES_CHILD, REASSESSMENT_INTERVAL_DAYS } from './assessmentConfig';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 만나이 기준 연령밴드. 5세 미만 → '3-4', 그 이상 → '5-7'. 잘못된 날짜는 '5-7'. */
export function ageBandOf(birthDate: string, at: Date): Exclude<AgeBand, 'all'> {
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return '5-7';
  let age = at.getFullYear() - born.getFullYear();
  const m = at.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < born.getDate())) age -= 1;
  return age < 5 ? '3-4' : '5-7';
}

export class BankIncompleteError extends Error {
  constructor(public readonly phase: number) {
    super(`Assessment bank incomplete: phase ${phase} has no eligible items`);
    this.name = 'BankIncompleteError';
  }
}

/**
 * 한 cycle에서 사용할 문항을 선택한다.
 * - 연령밴드에 맞는 문항만 후보로 둔다('all' 또는 미지정은 항상 포함).
 * - (phase, category, facet) 슬롯별로 cycleIndex 로 결정적 로테이션.
 * - 1..numPhases 각 차수에 최소 1문항이 없으면 BankIncompleteError.
 */
export function selectItems(
  bank: Question[],
  child: { birthDate: string },
  cycleIndex: number,
  numPhases: number = ASSESSMENT_PHASES_CHILD,
  at: Date = new Date(),
): Question[] {
  const ageBand = ageBandOf(child.birthDate, at);
  const groups = new Map<string, Question[]>();
  for (const q of bank) {
    if (!q.phase || q.phase > numPhases) continue;
    if (q.ageBand && q.ageBand !== 'all' && q.ageBand !== ageBand) continue;
    const key = `${q.phase}|${q.category}|${q.facet ?? ''}`;
    const arr = groups.get(key);
    if (arr) arr.push(q);
    else groups.set(key, [q]);
  }

  const selected: Question[] = [];
  for (const key of [...groups.keys()].sort()) {
    const candidates = groups.get(key)!.slice().sort((a, b) => a.id - b.id);
    const idx = ((cycleIndex % candidates.length) + candidates.length) % candidates.length;
    selected.push(candidates[idx]);
  }

  for (let k = 1; k <= numPhases; k += 1) {
    if (!selected.some((q) => q.phase === k)) throw new BankIncompleteError(k);
  }

  return selected.sort((a, b) => a.phase! - b.phase! || a.id - b.id);
}

/**
 * 응답한 문항 집합으로 완료된 최고 차수를 파생한다(0 = 완료 차수 없음).
 * 차수 k는 "phase===k 문항이 존재 && phase≤k 문항이 모두 응답됨"일 때 완료.
 */
export function completedPhase(
  answeredIds: Set<number>,
  selected: Question[],
  numPhases: number = ASSESSMENT_PHASES_CHILD,
): number {
  let phase = 0;
  for (let k = 1; k <= numPhases; k += 1) {
    if (!selected.some((q) => q.phase === k)) break;
    const required = selected.filter((q) => (q.phase ?? Infinity) <= k);
    if (required.every((q) => answeredIds.has(q.id))) phase = k;
    else break;
  }
  return phase;
}

/** 마지막 완료 cycle 기준 재평가가 필요한지. 90일 경과 또는 연령밴드 변경 시 true. */
export function reassessmentDue(
  latestCompleted: { created_at: string } | null,
  child: { birthDate: string },
  now: Date,
): boolean {
  if (!latestCompleted) return false;
  const created = new Date(latestCompleted.created_at);
  if (Number.isNaN(created.getTime())) return false;
  const days = (now.getTime() - created.getTime()) / DAY_MS;
  if (days >= REASSESSMENT_INTERVAL_DAYS) return true;
  return ageBandOf(child.birthDate, created) !== ageBandOf(child.birthDate, now);
}

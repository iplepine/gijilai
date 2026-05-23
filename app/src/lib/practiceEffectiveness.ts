/**
 * 실천 미션 효과 카운터 (자기보고 기반)
 *
 * 의료광고법·표시광고법 회피를 위해 "효과 X%" 표현을 절대 사용하지 않는다.
 * 대신 "효과 있었어요 N회 / 기록 M회" 식 자기보고 카운터로 노출한다.
 * 즉, 이 함수는 사용자가 직접 입력한 child_reaction_type / parent_impression_type
 * 신호 중 긍정 라벨이 붙은 기록의 개수만을 셀 뿐이다.
 */

import type { PracticeLogData } from "@/lib/db";

// 자기보고에서 "이번엔 통했다"는 신호로 해석 가능한 라벨
const POSITIVE_CHILD_REACTIONS: ReadonlySet<NonNullable<PracticeLogData["child_reaction_type"]>> =
  new Set(["cooperated", "resisted_then_settled"]);
const POSITIVE_PARENT_IMPRESSIONS: ReadonlySet<NonNullable<PracticeLogData["parent_impression_type"]>> =
  new Set(["this_is_it", "seems_right"]);

export const PRACTICE_EFFECTIVENESS_MIN_LOGS = 3;

export type PracticeEffectivenessSummary = {
  /** 사용자가 "효과 있었다"고 자기보고한 횟수 */
  feltEffectiveCount: number;
  /** 실천 완료(`done`) 기록 횟수 */
  doneCount: number;
  /** 전체 로그 수 (시도 + 미시도) */
  totalLogged: number;
  /** 노출 임계치 충족 여부 */
  meetsDisplayThreshold: boolean;
};

export function summarizePracticeEffectiveness(
  logs: PracticeLogData[],
): PracticeEffectivenessSummary {
  let feltEffectiveCount = 0;
  let doneCount = 0;
  for (const log of logs) {
    if (log.done) doneCount += 1;
    const childPositive =
      log.child_reaction_type !== null &&
      POSITIVE_CHILD_REACTIONS.has(log.child_reaction_type);
    const parentPositive =
      log.parent_impression_type !== null &&
      POSITIVE_PARENT_IMPRESSIONS.has(log.parent_impression_type);
    if (childPositive || parentPositive) {
      feltEffectiveCount += 1;
    }
  }
  const totalLogged = logs.length;
  return {
    feltEffectiveCount,
    doneCount,
    totalLogged,
    meetsDisplayThreshold: totalLogged >= PRACTICE_EFFECTIVENESS_MIN_LOGS,
  };
}

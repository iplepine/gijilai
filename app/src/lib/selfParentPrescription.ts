// 양육자 자기 상담(self-parent)의 처방 타입과 파싱.
// 아이 상담 처방(interpretation/chemistry/3 actionItems)과 구조가 다르다.
// 핵심 원칙: 짧은 acknowledgment + 나에게 해줄 한 마디 + 오늘 나를 위한 한 가지.

// 7가지 자기 작업 도구 (정책: docs/product/policies/self-parent.md)
export const SELF_PARENT_TOOLS = [
  'SELF_AWARENESS', // 자기 알아채기 (이름 붙이기)
  'SELF_COMPASSION', // 자기 연민 멘트
  'SELF_CARE', // 작은 자기 돌봄 (30초~5분)
  'SET_LIMIT', // 한계 정하기
  'ASK_HELP', // 도움 요청 연습
  'ALLOW_REST', // 휴식 허락
  'ACKNOWLEDGE_NOW', // 현재 인정 (이미 잘하고 있는 한 가지)
] as const;

export type SelfParentTool = (typeof SELF_PARENT_TOOLS)[number];

export function isSelfParentTool(value: unknown): value is SelfParentTool {
  return typeof value === 'string' && (SELF_PARENT_TOOLS as readonly string[]).includes(value);
}

export function formatSelfParentTool(tool: SelfParentTool): string {
  switch (tool) {
    case 'SELF_AWARENESS':
      return '내 마음 알아채기';
    case 'SELF_COMPASSION':
      return '나에게 다정하기';
    case 'SELF_CARE':
      return '작은 자기 돌봄';
    case 'SET_LIMIT':
      return '오늘의 한계 정하기';
    case 'ASK_HELP':
      return '도움 요청해보기';
    case 'ALLOW_REST':
      return '쉬어도 괜찮아';
    case 'ACKNOWLEDGE_NOW':
      return '이미 잘하고 있는 것';
  }
}

export type SelfParentAction = {
  tool: SelfParentTool;
  title: string; // 오늘 나를 위한 한 가지 (한 줄)
  description: string; // 왜 이게 도움이 되는지 (1~2줄)
  duration: number; // 권장 기간 (일, 1~7)
};

export type SelfParentPrescription = {
  acknowledgment: string; // 짧은 인정 (1~2줄). 평가 X.
  reflection: string; // 마음을 비춰주는 한 단락 (3~4줄). 진단 X.
  magicWordForSelf: string; // 나에게 해줄 한 마디 (따옴표 없이)
  action: SelfParentAction; // 오늘 나를 위한 단 하나의 행동
  sessionTitle?: string; // 이 마음을 한 줄로 (15자 이내)
};

function isAction(value: unknown): value is SelfParentAction {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return (
    isSelfParentTool(a.tool) &&
    typeof a.title === 'string' &&
    typeof a.description === 'string' &&
    typeof a.duration === 'number'
  );
}

export function isSelfParentPrescription(value: unknown): value is SelfParentPrescription {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.acknowledgment === 'string' &&
    typeof p.reflection === 'string' &&
    typeof p.magicWordForSelf === 'string' &&
    isAction(p.action) &&
    (p.sessionTitle === undefined || typeof p.sessionTitle === 'string')
  );
}

// LLM 응답을 안전하게 정규화. duration 범위 보정.
export function normalizeSelfParentPrescription(
  value: SelfParentPrescription,
): SelfParentPrescription {
  const duration = Math.min(7, Math.max(1, Math.round(value.action.duration || 3)));
  return {
    ...value,
    action: { ...value.action, duration },
  };
}

// 양육자 자기 상담(self-parent)의 임상 경계 가드레일.
// 입력에서 위기 신호를 감지하면 상담 처방 대신 전문기관 안내로 분기한다.
// 정책: docs/product/policies/self-parent.md
//
// 중요: 이 모듈은 진단 도구가 아니다. 키워드 기반 1차 안전망이며,
// false negative(놓침)를 줄이는 쪽으로 보수적으로 설계한다.
// 감지되면 상담을 막는 게 아니라, 전문기관 안내를 "함께" 우선 노출한다.

export type SafetyCategory = 'SELF_HARM' | 'VIOLENCE' | 'PERSISTENT_DISTRESS';

export type SafetyResource = {
  name: string;
  contact: string;
  note?: string;
};

export type SelfReflectionSafetyResult =
  | { safe: true }
  | {
      safe: false;
      category: SafetyCategory;
      // 사용자에게 보여줄 안내 (자유 텍스트 원문은 절대 포함하지 않음)
      resources: SafetyResource[];
    };

// 한국 전문기관 리소스 (카테고리별)
const RESOURCES: Record<SafetyCategory, SafetyResource[]> = {
  SELF_HARM: [
    { name: '자살예방상담전화', contact: '109', note: '24시간 · 무료' },
    { name: '정신건강상담전화', contact: '1577-0199', note: '24시간' },
    { name: '청소년전화', contact: '1388', note: '양육·가족 고민 포함' },
  ],
  VIOLENCE: [
    { name: '아동학대 신고·상담', contact: '112', note: '긴급 시' },
    { name: '아이지킴콜', contact: '112', note: '아동보호전문기관 연계' },
    { name: '정신건강상담전화', contact: '1577-0199', note: '양육 스트레스 상담' },
  ],
  PERSISTENT_DISTRESS: [
    { name: '정신건강상담전화', contact: '1577-0199', note: '24시간' },
    { name: '정신건강복지센터', contact: '지역 보건소 문의', note: '가까운 센터 연계' },
  ],
};

// 정규화: 공백 제거 + 소문자(영문 대비)
function normalize(input: string): string {
  return input.replace(/\s+/g, '').toLowerCase();
}

// 카테고리별 위기 신호 패턴.
// 한국어 구어 표현을 폭넓게 포함하되, 일상적 과장("힘들어 죽겠다")과
// 진짜 위기 신호를 구분하기 위해 가능한 한 구체적 표현을 쓴다.
const SELF_HARM_PATTERNS: RegExp[] = [
  /죽고싶/,
  /죽어버리고싶/,
  /사라지고싶/,
  /없어지고싶/,
  /끝내고싶/,
  /살기싫/,
  /살고싶지않/,
  /자해/,
  /목숨을끊/,
  /생을마감/,
  /내가없어지면/,
  /더이상살/,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /때리고싶/,
  /때려버리/,
  /손이올라/,
  /손이올라가/,
  /애를때리/,
  /아이를때리/,
  /목을조르/,
  /던져버리고싶/,
  /해치고싶/,
  /애가무서워질/,
  /내가무서워/,
  /통제가안돼때/,
];

const PERSISTENT_DISTRESS_PATTERNS: RegExp[] = [
  /매일울/,
  /계속울고싶/,
  /몇주째/,
  /몇달째힘들/,
  /일어나기가힘들/,
  /아무것도하기싫/,
  /숨고싶/,
  /도망치고싶/,
  /다포기하고싶/,
];

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// 자해/폭력 신호는 가장 우선. 그다음 지속적 디스트레스.
export function checkSelfReflectionSafety(input: string): SelfReflectionSafetyResult {
  const text = normalize(input);
  if (!text) return { safe: true };

  if (matchAny(text, SELF_HARM_PATTERNS)) {
    return { safe: false, category: 'SELF_HARM', resources: RESOURCES.SELF_HARM };
  }
  if (matchAny(text, VIOLENCE_PATTERNS)) {
    return { safe: false, category: 'VIOLENCE', resources: RESOURCES.VIOLENCE };
  }
  if (matchAny(text, PERSISTENT_DISTRESS_PATTERNS)) {
    return {
      safe: false,
      category: 'PERSISTENT_DISTRESS',
      resources: RESOURCES.PERSISTENT_DISTRESS,
    };
  }

  return { safe: true };
}

// 카테고리별 안내 헤드라인 (UI 표시용)
export function safetyHeadline(category: SafetyCategory): string {
  switch (category) {
    case 'SELF_HARM':
      return '지금 많이 힘드시군요. 혼자 견디지 않으셔도 돼요.';
    case 'VIOLENCE':
      return '많이 지치고 한계에 다다른 순간이 있으셨던 것 같아요.';
    case 'PERSISTENT_DISTRESS':
      return '꽤 오래 무거운 마음을 안고 계셨던 것 같아요.';
  }
}

export function safetyBody(category: SafetyCategory): string {
  switch (category) {
    case 'SELF_HARM':
      return 'AI 상담보다 지금은 사람의 도움이 더 필요한 순간일 수 있어요. 아래로 연결하면 24시간 이야기를 들어줄 분이 있어요. 양육자님의 안전이 무엇보다 먼저예요.';
    case 'VIOLENCE':
      return '그런 마음이 든다는 게 양육자님이 나쁜 사람이라는 뜻은 아니에요. 다만 아이와 양육자님 모두의 안전을 위해, 지금은 전문기관의 도움을 받는 것이 가장 좋아요.';
    case 'PERSISTENT_DISTRESS':
      return '이 정도로 오래 힘드셨다면 양육 기술의 문제가 아니라 양육자님 자신을 먼저 돌봐야 할 때예요. 전문 상담은 약함의 표시가 아니라 회복의 시작이에요.';
  }
}

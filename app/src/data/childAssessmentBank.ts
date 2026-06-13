import { Question } from '../types/survey';
import { CHILD_QUESTIONS } from './questions';

// ============================================================================
// 아동 기질검사 차수(phase) 문항뱅크 — 점진적 심화형
// 스펙: docs/spec/phased-temperament-assessment.md §5.2
//
// 구성: NS 12 / HA 12 / RD 12 / P 9 = 45문항, 3차수(누적 15·30·45).
// 차수당 NS4·HA4·RD4·P3 = 15. 1차에 변별력 높은 문항(tier 1) 배치.
//
// ⚠️ DRAFT — 신규 문항(id 101~125)은 기존 문항 패턴을 따른 초안이며,
//    출시 전 임상/콘텐츠 검수(CBQ/ATQ 결, 연령 적합성, 척도 보정)가 필요하다.
//    기존 문항(id 1~20)은 이미 사용 중인 검증 문항을 차수로 재태깅한 것.
//
// 라이브 survey 는 아직 CHILD_QUESTIONS(20문항)를 사용한다. 이 뱅크는
// 차수 UI 배선 시 전환된다(현재는 깨뜨리지 않도록 별도 모듈).
// ============================================================================

// 기존 20문항 → [phase, tier] 재태깅. 1차=tier1(변별력 우선), 잔여 facet은 2차.
const EXISTING_TAGS: Record<number, [1 | 2 | 3, number]> = {
  // NS
  1: [1, 1], 3: [1, 1], 4: [1, 1], 5: [1, 1], 2: [2, 2],
  // HA (역채점)
  6: [1, 1], 8: [1, 1], 9: [1, 1], 7: [1, 1], 10: [2, 2],
  // RD
  11: [1, 1], 12: [1, 1], 13: [1, 1], 15: [1, 1], 14: [2, 2],
  // P
  16: [1, 1], 18: [1, 1], 19: [1, 1], 17: [2, 2], 20: [2, 2],
};

const taggedExisting: Question[] = CHILD_QUESTIONS.map((q) => {
  const tag = EXISTING_TAGS[q.id];
  return tag ? { ...q, phase: tag[0], tier: tag[1], ageBand: 'all' as const } : q;
});

// 신규 DRAFT 문항 (id 101~125). 모두 ageBand 'all'(연령별 변형은 후속).
const NEW_CHILD_ITEMS: Question[] = [
  // --- NS (자극추구) ---
  { id: 101, type: 'CHILD', category: 'NS', facet: '새로운 자극 접근성', phase: 2, tier: 2, ageBand: 'all',
    context: '가족 여행으로 처음 가보는 곳에 도착했을 때, 우리 아이는?',
    choices: ['낯설어 부모 곁에서 떨어지지 않는다.', '한참 살핀 뒤에야 조금 움직인다.', '부모가 함께 가주면 둘러본다.', '관심 가는 곳으로 먼저 가보려 한다.', '도착하자마자 여기저기 뛰어다니며 탐색한다.'] },
  { id: 102, type: 'CHILD', category: 'NS', facet: '활동 수준', phase: 2, tier: 2, ageBand: 'all',
    context: '비 오는 날 실내에서 하루 종일 지내야 할 때, 우리 아이는?',
    choices: ['가만히 앉아 조용한 놀이로도 만족한다.', '대체로 차분히 지낸다.', '가끔 몸을 움직이고 싶어 한다.', '자주 뛰거나 점프할 곳을 찾는다.', '잠시도 가만있지 못하고 계속 움직인다.'] },
  { id: 103, type: 'CHILD', category: 'NS', facet: '충동성', phase: 2, tier: 2, ageBand: 'all',
    context: '마트에서 사기로 약속한 것 외에 다른 장난감을 보았을 때, 우리 아이는?',
    choices: ['약속을 떠올리며 쳐다보지도 않는다.', '잠깐 보고 스스로 지나친다.', '사고 싶다 말하지만 안 된다 하면 수긍한다.', '갖고 싶다고 조르기 시작한다.', '그 자리에서 떼를 쓰며 가지려 한다.'] },
  { id: 104, type: 'CHILD', category: 'NS', facet: '자유분방함', phase: 3, tier: 3, ageBand: 'all',
    context: '순서와 규칙이 있는 보드게임을 할 때, 우리 아이는?',
    choices: ['규칙을 정확히 지키며 순서를 기다린다.', '대체로 규칙대로 한다.', '가끔 자기 방식대로 바꾸려 한다.', '규칙보다 하고 싶은 대로 하려 한다.', '규칙을 무시하고 마음대로 놀려 한다.'] },
  { id: 105, type: 'CHILD', category: 'NS', facet: '지루함 민감성', phase: 3, tier: 3, ageBand: 'all',
    context: '같은 만화나 같은 책을 반복해서 볼 때, 우리 아이는?',
    choices: ['같은 것을 몇 번이고 즐겁게 본다.', '반복해도 잘 본다.', '몇 번 보면 다른 걸 찾는다.', '금세 시시해하며 새것을 원한다.', '한 번 본 것은 곧바로 지루해한다.'] },
  { id: 106, type: 'CHILD', category: 'NS', facet: '새로운 자극 접근성', phase: 3, tier: 3, ageBand: 'all',
    context: '처음 보는 놀이기구 앞에 섰을 때, 우리 아이는?',
    choices: ['무서워 타지 않으려 한다.', '한참 구경만 한다.', '다른 아이가 타는 걸 보고 따라 한다.', '조심스레 먼저 타본다.', '망설임 없이 바로 올라탄다.'] },
  { id: 107, type: 'CHILD', category: 'NS', facet: '활동 수준', phase: 3, tier: 3, ageBand: 'all',
    context: '아침에 일어나 하루를 시작할 때, 우리 아이는?',
    choices: ['느릿느릿 천천히 움직인다.', '차분하게 준비한다.', '보통의 활기로 움직인다.', '아침부터 에너지가 넘친다.', '눈 뜨자마자 뛰어다닌다.'] },

  // --- HA (위험회피) · 역채점 ---
  { id: 108, type: 'CHILD', category: 'HA', facet: '수줍음 및 불안', phase: 2, tier: 2, reverse: true, ageBand: 'all',
    context: '익숙하지 않은 사람들이 모인 친척 모임에서, 우리 아이는?',
    choices: ['부모 뒤에 숨어 낯을 가린다.', '한참 지나야 조금 어울린다.', '시간이 지나면 자연스러워진다.', '먼저 다가가 인사하기도 한다.', '처음 보는 사람과도 금세 잘 어울린다.'] },
  { id: 109, type: 'CHILD', category: 'HA', facet: '변화 적응성', phase: 2, tier: 2, reverse: true, ageBand: 'all',
    context: '갑자기 일정이 바뀌어 예정에 없던 곳에 가게 됐을 때, 우리 아이는?',
    choices: ['당황하며 가지 않으려 한다.', '불편해하지만 따라온다.', '잠시 후 받아들인다.', '별 거부감 없이 따라온다.', '오히려 새 일정을 반긴다.'] },
  { id: 110, type: 'CHILD', category: 'HA', facet: '위험 감지', phase: 2, tier: 2, reverse: true, ageBand: 'all',
    context: '조금 높은 곳이나 처음 해보는 신체 활동 앞에서, 우리 아이는?',
    choices: ['위험할까 봐 시도하지 않는다.', '많이 망설인다.', '도와주면 해본다.', '스스로 조심하며 시도한다.', '겁내지 않고 거침없이 한다.'] },
  { id: 111, type: 'CHILD', category: 'HA', facet: '감각 역치', phase: 3, tier: 3, reverse: true, ageBand: 'all',
    context: '옷의 태그나 시끄러운 소리 같은 감각 자극에 대해, 우리 아이는?',
    choices: ['작은 자극에도 크게 불편해한다.', '예민하게 반응하는 편이다.', '가끔 신경 쓴다.', '대체로 개의치 않는다.', '웬만한 자극은 거의 느끼지 못한다.'] },
  { id: 112, type: 'CHILD', category: 'HA', facet: '피로 용이성', phase: 3, tier: 3, reverse: true, ageBand: 'all',
    context: '활동을 많이 한 뒤 우리 아이의 모습은?',
    choices: ['금세 지쳐 예민해진다.', '쉽게 피곤해한다.', '보통이다.', '비교적 오래 버틴다.', '좀처럼 지치지 않는다.'] },
  { id: 113, type: 'CHILD', category: 'HA', facet: '수줍음 및 불안', phase: 3, tier: 3, reverse: true, ageBand: 'all',
    context: '발표나 사람들 앞에 나서야 하는 상황에서, 우리 아이는?',
    choices: ['부끄러워 한사코 피한다.', '매우 쑥스러워한다.', '떨지만 해낸다.', '비교적 편하게 한다.', '주목받는 걸 즐긴다.'] },
  { id: 114, type: 'CHILD', category: 'HA', facet: '변화 적응성', phase: 3, tier: 3, reverse: true, ageBand: 'all',
    context: '새 어린이집이나 새 반처럼 환경이 바뀌었을 때, 우리 아이는?',
    choices: ['오래도록 적응을 힘들어한다.', '한동안 불안해한다.', '며칠이면 익숙해진다.', '빠르게 적응한다.', '새 환경을 즐거워한다.'] },

  // --- RD (사회적 민감성) ---
  { id: 115, type: 'CHILD', category: 'RD', facet: '사회적 보상 민감성', phase: 2, tier: 2, ageBand: 'all',
    context: '잘했다고 스티커나 칭찬을 받았을 때, 우리 아이는?',
    choices: ['별 반응이 없다.', '살짝 좋아한다.', '기뻐한다.', '더 잘하려고 의욕을 보인다.', '무척 기뻐하며 계속 칭찬받고 싶어 한다.'] },
  { id: 116, type: 'CHILD', category: 'RD', facet: '정서적 감수성', phase: 2, tier: 2, ageBand: 'all',
    context: '곁에 있던 친구가 다쳐서 우는 것을 보았을 때, 우리 아이는?',
    choices: ['별로 신경 쓰지 않는다.', '쳐다보지만 가만있다.', '걱정스러워한다.', '다가가 살핀다.', '같이 울먹이며 위로하려 한다.'] },
  { id: 117, type: 'CHILD', category: 'RD', facet: '관계 지향성', phase: 2, tier: 2, ageBand: 'all',
    context: '놀이터에서 또래들이 모여 놀고 있을 때, 우리 아이는?',
    choices: ['혼자 노는 걸 더 좋아한다.', '곁에서 따로 논다.', '끼워주면 함께한다.', '먼저 같이 놀자고 한다.', '늘 무리 속에서 어울리려 한다.'] },
  { id: 118, type: 'CHILD', category: 'RD', facet: '따뜻한 의사소통', phase: 3, tier: 3, ageBand: 'all',
    context: '자기가 좋아하는 간식을 나눠야 하는 상황에서, 우리 아이는?',
    choices: ['절대 나누지 않으려 한다.', '마지못해 조금 준다.', '권하면 나눈다.', '먼저 나눠주기도 한다.', '기꺼이 먼저 챙겨 나눈다.'] },
  { id: 119, type: 'CHILD', category: 'RD', facet: '타인 의존성', phase: 3, tier: 3, ageBand: 'all',
    context: '무언가를 하기 전에 부모의 표정이나 반응을, 우리 아이는?',
    choices: ['거의 살피지 않고 자기대로 한다.', '가끔 본다.', '종종 확인한다.', '자주 눈치를 살핀다.', '늘 부모 반응을 먼저 확인한다.'] },
  { id: 120, type: 'CHILD', category: 'RD', facet: '사회적 보상 민감성', phase: 3, tier: 3, ageBand: 'all',
    context: '그림이나 만들기를 한 뒤 어른에게 보여줄 때, 우리 아이는?',
    choices: ['굳이 보여주지 않는다.', '물어보면 보여준다.', '보여주고 반응을 기다린다.', '칭찬을 기대하며 보여준다.', '꼭 보여주고 인정받고 싶어 한다.'] },
  { id: 121, type: 'CHILD', category: 'RD', facet: '정서적 감수성', phase: 3, tier: 3, ageBand: 'all',
    context: '슬픈 장면이 나오는 동화나 영상을 볼 때, 우리 아이는?',
    choices: ['별 감흥이 없다.', '잠깐 멈칫한다.', '안타까워한다.', '마음 아파한다.', '눈물을 보일 만큼 깊이 느낀다.'] },

  // --- P (인내력) ---
  { id: 122, type: 'CHILD', category: 'P', facet: '과제 지속성', phase: 2, tier: 2, ageBand: 'all',
    context: '여러 조각을 맞춰야 하는 긴 만들기를 할 때, 우리 아이는?',
    choices: ['금방 그만둔다.', '조금 하다 흥미를 잃는다.', '중간까지는 한다.', '거의 끝까지 해낸다.', '완성할 때까지 끈기 있게 매달린다.'] },
  { id: 123, type: 'CHILD', category: 'P', facet: '근면성', phase: 3, tier: 3, ageBand: 'all',
    context: '정해진 양치·정리 같은 습관을, 우리 아이는?',
    choices: ['매번 시켜야 한다.', '자주 잊는다.', '가끔 스스로 한다.', '대체로 알아서 한다.', '시키지 않아도 꼬박꼬박 한다.'] },
  { id: 124, type: 'CHILD', category: 'P', facet: '좌절 내성', phase: 3, tier: 3, ageBand: 'all',
    context: '블록이 자꾸 무너지는 것처럼 뜻대로 안 될 때, 우리 아이는?',
    choices: ['울거나 포기해 버린다.', '쉽게 짜증 낸다.', '속상해하다 다시 한다.', '곧 마음을 추스르고 시도한다.', '될 때까지 침착하게 다시 한다.'] },
  { id: 125, type: 'CHILD', category: 'P', facet: '주의 집중력', phase: 3, tier: 3, ageBand: 'all',
    context: '주변이 어수선한 곳에서 무언가에 집중해야 할 때, 우리 아이는?',
    choices: ['금세 산만해진다.', '자주 한눈판다.', '가끔 흐트러진다.', '비교적 잘 집중한다.', '주변에 상관없이 몰입한다.'] },
];

/** 임상 검수가 필요한 신규 DRAFT 문항 id. */
export const DRAFT_CHILD_ITEM_IDS: readonly number[] = NEW_CHILD_ITEMS.map((q) => q.id);

/** 아동 차수 문항뱅크(45문항). 기존 20 재태깅 + 신규 25 DRAFT. */
export const CHILD_ASSESSMENT_BANK: Question[] = [...taggedExisting, ...NEW_CHILD_ITEMS];

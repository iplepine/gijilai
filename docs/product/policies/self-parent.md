# 양육자 자신을 위한 상담 (Self-Parent) 정책

마지막 갱신일: 2026-05-31

## 목적

아이 행동 상담을 넘어, 양육자 본인의 마음과 자기 작업을 같은 상담→실천 루프 안에서 다룬다. 부모의 자기 조절·자기 연민이 아이 발달의 베이스라는 발달심리 합의를 제품으로 옮긴다.

기획 전문: [`../SELF_PARENT_CONSULTATION_PLAN.html`](../SELF_PARENT_CONSULTATION_PLAN.html) · 결정: ADR 2026-05-31

## 캐치프라이즈 (제품 톤 약속)

> **더 좋은 사람이 되기 위해 고민하는 것만으로 당신은 이미 좋은 사람입니다.**

이것은 마케팅 카피가 아니라 모든 인터랙션의 톤을 정의하는 약속이다. 한 군데라도 평가/수치심 톤이 들어가면 약속이 깨진다.

- i18n: `catchphrase.main`, `catchphrase.short`
- 노출 위치(Phase 0): pricing 헤더, 아이 상담 결과 footer, 양육자 분석 탭 footer, self-parent 결과 화면. (상담 빈 상태·체험 만료는 후속 확장.)

## 톤 원칙

| 하지 않는다 | 대신 한다 |
|---|---|
| "실천 완료율이 낮네요" | "오늘 와주신 것 자체가 의미" |
| "당신을 고치면 아이가 좋아져요" | "양육자님이 안정되면 아이도 그 자장에 머물러요" |
| "부족한 부모" / "잘했어요·못했어요" | "같이 그 마음을 들여다볼까요" |
| "매일 해야 합니다" (숙제) | "오늘 본인을 위해 한 번 해볼래요? 안 해도 괜찮아요" |

추가 원칙: 양육자를 fix 대상으로 다루지 않는다. 위로만 늘어놓지 말고 마음을 정확히 비춰준 뒤 아주 작은 한 걸음을 제안한다.

## 임상 경계 (신뢰 베이스)

### 한다
- 양육 맥락의 감정·욕구·자기 패턴 reflect
- 작은 자기 돌봄 실천 제안 (30초~5분)
- 자기 연민·자기 인정 언어 제공
- 도움 요청 안내

### 절대 안 한다
- 어린 시절·원가족·트라우마 깊이 파기
- 진단·치료 톤, 진단명 부여 ("불안 애착", "번아웃" 등)
- 부부 관계 분석, 결혼 상담, 이별 조언
- 우울·자해·폭력 자체 처리

### 위기 감지 → 전문기관 우선
입력·답변에서 위기 키워드 감지 시 처방을 생성하지 않고 전문기관 안내를 우선 노출한다. 구현: `lib/selfReflectionGuardrail.ts`.

| 카테고리 | 트리거 (예시) | 안내 |
|---|---|---|
| `SELF_HARM` | "사라지고 싶다", "죽고 싶다", "자해" | 자살예방 109·1393, 정신건강 1577-0199 |
| `VIOLENCE` | "애한테 손이 올라간다", "때리고 싶다" | 아동학대 112, 정신건강 1577-0199 |
| `PERSISTENT_DISTRESS` | "몇 주째 일어나기 힘들다", "매일 울고 싶다" | 정신건강 1577-0199, 지역 정신건강복지센터 |

- 우선순위: `SELF_HARM` > `VIOLENCE` > `PERSISTENT_DISTRESS`.
- 보수적 설계: false negative(놓침)를 줄이는 쪽. 일상적 과장과 진짜 신호를 구분하려 구체적 표현을 쓰되, 의심되면 안내한다.
- **개인정보**: `self_reflection_safety_events`에는 카테고리와 시점만 저장한다. 자유 텍스트 원문은 절대 저장하지 않는다.

## 자기 작업 도구 박스 (7개)

처방의 `action.tool`은 다음 7개 중 하나. 아이 상담의 행동 변화 도구와 다른, 양육자 본인을 위한 도구다.

| 코드 | 이름 | 언제 |
|---|---|---|
| `SELF_AWARENESS` | 내 마음 알아채기 | 감정이 흐릿할 때, 표면 감정 뒤 진짜 마음에 이름 붙이기 |
| `SELF_COMPASSION` | 나에게 다정하기 | 자기 비난이 강할 때, 친구에게 하듯 자신에게 |
| `SELF_CARE` | 작은 자기 돌봄 | 만성 피로·고갈, 30초~5분 회복 |
| `SET_LIMIT` | 오늘의 한계 정하기 | 모든 걸 다 하려 할 때 |
| `ASK_HELP` | 도움 요청해보기 | 혼자 다 짊어질 때 |
| `ALLOW_REST` | 쉬어도 괜찮아 | 죄책감 없이 쉬기 |
| `ACKNOWLEDGE_NOW` | 이미 잘하고 있는 것 | 변화 압박이 강할 때 |

## 처방 구조

아이 상담 처방과 다른 스키마 (`lib/selfParentPrescription.ts`).

```ts
{
  acknowledgment: string;   // 짧은 인정 1~2줄, 평가 X
  reflection: string;       // 마음 비춰주는 한 단락 3~4줄, 진단 X
  magicWordForSelf: string; // 나에게 해줄 한 마디 (따옴표 없이)
  action: {                 // 오늘 나를 위한 단 하나
    tool: SelfParentTool;
    title: string;          // 30초~5분 크기
    description: string;    // 왜 도움 되는지 1~2줄
    duration: number;       // 1~7일
  };
  sessionTitle?: string;    // 이 마음을 한 줄로 (15자 이내)
}
```

원칙: action은 **반드시 양육자 본인을 위한 행동**(아이를 위한 게 아님). "오늘 못 해도 괜찮다"는 여백을 남긴다.

## 데이터 모델

- `consultation_sessions.type`, `consultations.type`, `practice_items.type` = `'CHILD' | 'SELF_PARENT'` (기본 CHILD). 마이그레이션 019.
- self-parent 상담은 `child_id`가 없을 수 있다(양육자 본인 중심). 선택적으로 연결해 Phase 3 cross-context에 쓴다.
- **CHILD 흐름 분리**: 아이 상담 기록 목록(`/consultations`), 실천 목록, 활성 세션/실천 카운트(3개·5개 제한)는 모두 `type='CHILD'`만 본다. self-parent가 섞이지 않는다.

## 프라이버시 — 공동양육자에게 절대 공개되지 않음

self-parent 상담은 양육자 **본인의 사적 내면 작업**이다. 공동양육자(co-parent)에게 공유되는 범위에 **포함되지 않는다.**

- self-parent 상담에 `child_id`가 연결돼 있어도, co-parent는 이를 읽을 수 없다.
- 강제 수단: 마이그레이션 020이 co-parent RLS SELECT/UPDATE 정책을 모두 `type='CHILD'`로 좁힌다. self-parent(`type='SELF_PARENT'`) 행은 co-parent 정책에 매칭되지 않는다.
- 작성자 본인은 기존 `user_id` 기반 정책으로 계속 접근한다.
- 이것은 UI 차원이 아니라 **DB 권한(RLS) 차원의 보장**이다. 향후 child_id로 조회하는 기능이 추가돼도 self-parent는 노출되지 않는다.
- self-parent를 co-parent와 공유하는 것은 Phase 4에서 별도 동의·요약(원문 X) 설계로만 검토한다. 기본은 항상 비공개.

## 진입점

self-parent 상담을 시작하는 경로(중복 진입):
- 아이 상담 결과 화면 하단 CTA → `/consult/self?from=child_consult`
- 홈 "오늘의 나" 카드 — 진행 중 자기 돌봄이 **없을 때**는 부드러운 초대 카드(점선, → `/consult/self?from=home_invite`), **있을 때**는 내 마음 기록(이번 주 후속)으로
- 상담 입력 화면 상단 **"아이 마음 / 내 마음" 토글** — `/consult` ↔ `/consult/self` 상호 전환(새 상담 시작 시에만 노출, 이어서 상담 중엔 숨김)

## 단계

- **Phase 1**: one-shot reflection(입력→2질문→처방). 기록 저장.
- **Phase 2 (현재)**: self practice loop.
  - 결과 화면 "마음에 담기" → action을 `practice_items`(type='SELF_PARENT')로 저장.
  - **"내 마음 기록"** 화면(`/consult/self/records`): 진행 중 자기 돌봄 + 지난 마음 기록 목록. Phase 1에서 기록이 보이지 않던 문제를 닫는다.
  - **"이번 주 어떠셨어요?"** 후속: 평가가 아닌 안부. `도움이 됐어요 / 잘 모르겠어요 / 못 했지만 괜찮아요` 3선택 + 선택 메모. 한 번의 부드러운 마무리(데일리 체크·streak 없음 — 숙제화 방지). 마무리 시 실천 COMPLETED + 회고 저장.
  - 홈 **"오늘의 나"** 카드: 진행 중 자기 돌봄 있으면 노출, 없으면 self-hide(빈 상태 적극 유도 X).
- Phase 3: 자기 상태가 아이 상담 컨텍스트에 흘러감.
- Phase 4: co-parent 결합 (두 양육자 patterns 가볍게 공유 — 항상 동의·요약 기반, 원문 X).

### 후속 루프 원칙
self-parent 실천은 아이 실천과 달리 **매일 체크하지 않는다.** 며칠 뒤 한 번의 안부로 부드럽게 마무리하는 episodic 모델이다. "오늘 못 해도 괜찮다"는 여백을 항상 남긴다.

## 구독 권한

- self-parent 상담도 아이 상담과 동일하게 구독/체험 활성 시 사용. childId가 있으면 co-parent 커버리지(owner 활성 구독)도 반영(`getServerFeatureAccessForChild`).

## 측정 이벤트

```
self_parent_entry_cta_click   { source }
self_parent_consult_opened    { from }
self_parent_questions_received {}
self_parent_prescription_received { tool }
self_parent_consult_done      { tool }
self_parent_safety_triggered  { category, stage }
```

이벤트에 자유 텍스트 원문·아이 이름을 넣지 않는다.

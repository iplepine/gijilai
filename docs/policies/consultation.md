# 상담 및 관찰 일지 정책

## 하단 네비게이션 탭 구조

5탭 구조: 홈(`/`) | 관찰일지(`/observations`) | 상담(`/consult`, 중앙 FAB) | 기록(`/consultations`) | 내 정보(`/settings/profile`)

- 관찰일지 탭: 라벨 "관찰일지", 아이콘 `edit_note`
- 상담 탭: 중앙 원형 FAB 버튼, 아이콘 `add` (활성 시 `chat_bubble`)
- 기록 탭: 라벨 "기록", 아이콘 `folder_open` — 지난 상담 목록/상세 열람 전용 페이지

## 상담 시스템

### 상담 흐름

1. **INPUT**: 양육자가 고민 상황을 자유 텍스트로 입력. 아이의 나이/성별에 맞는 예시 칩 5개를 표시하여 입력 보조 (→ `consult-examples.md` 참조)
2. **DIAGNOSTIC**: AI가 공감 멘트 + 상황 분석 질문 3~5개 생성 (객관식 CHOICE / 주관식 TEXT). 1차 질문 완료 후 follow-up 판정 API를 호출하여 심층 질문 1~2개를 추가할 수 있음 (최대 1회)
3. **RESULT**: 마음 처방전 생성

### API 구조

| 엔드포인트 | 역할 | 모델 |
|-----------|------|------|
| `/api/consult/questions/initial` | 공감 멘트 + 기초 질문 3~5개 생성 | gpt-4o |
| `/api/consult/questions/followup` | 1차 답변 분석 후 심층 질문 필요 여부 판단 | gpt-4o |
| `/api/consult/prescription` | 마음 처방전 생성 | gpt-4o |

### 처방전 구조

```json
{
  "interpretation": "아이의 속마음 통역 — 아이의 1인칭 시점, 5~7줄",
  "chemistry": "양육자-아이 기질 역동 설명, 4~6줄",
  "questionAnalysis": [
    { "question": "질문 원문", "answer": "답변 원문", "analysis": "기질 관점 해설 1~2줄" }
  ],
  "magicWord": "상황 반전 대화 스크립트",
  "actionItem": "오늘부터 실천 가능한 구체적 행동 1개"
}
```

### 결과 화면 (RESULT) 카드 구성

1. **날짜 · 이름 뱃지**: 상담 날짜 + 아이 이름
2. **그날의 고민**: 양육자가 입력한 고민 원문
3. **문진 해설** (questionAnalysis): 각 질문-답변의 기질 관점 해설 (있을 때만 표시)
4. **마음 처방전**: 속마음 통역 / 아이와 나 / 실천 과제
5. **마법의 한마디**: 틸 그린 배경 강조 카드
6. **홈으로 돌아가기** 버튼
7. **앱 다운로드 유도**: 결과 하단에 앱 설치 CTA 표시

### 상담 저장

- 완료된 상담은 `consultations` 테이블에 저장 (status: COMPLETED)
- 저장 항목: user_id, child_id (selectedChildId), category ("자유 입력"), problem_description, ai_options (질문 목록), user_response (답변), selected_reaction_id ("DYNAMIC_FLOW"), ai_prescription (처방전 JSON), status

### 지난 상담 보기 (`/consultations`)

- 별도 페이지로 구현 (하단 네비게이션 "기록" 탭)
- 목록: 날짜 · 아이 이름, 고민 요약 (2줄 말줄임), 마법의 한마디 미리보기
- 상세: 상담 결과 화면과 동일한 카드 레이아웃 (날짜 뱃지 → 그날의 고민 → 마음 처방전 → 마법의 한마디)
- 상세에서 상담 기록 삭제 가능 (confirm 후 삭제)
- URL 쿼리 `?view={id}`로 특정 상담 바로 열기 지원

## 육아 관찰 일지

### 기록 구조

관찰 기록은 ABC Recording (Antecedent-Behavior-Consequence) 기반 3단계:

- **상황** (situation): 어떤 일이 있었나 — 필수, 최대 200자
- **내 행동** (my_action): 양육자가 어떻게 대응했나 — 필수, 최대 200자
- **아이 반응** (child_reaction): 아이가 어떻게 반응했나 — 필수, 최대 200자
- **느낀 점** (note): 메모 — 선택, 최대 300자

### 상담 연결

- 관찰 기록은 상담 처방전과 선택적으로 연결 가능 (consultation_id)
- 상담 없이도 독립적으로 관찰 기록 작성 가능
- 연결 시 최근 상담 3건을 드롭다운으로 제공

### 아이별 필터

- 다자녀 시 아이별 필터 칩 제공 (전체 | 아이1 | 아이2 ...)
- 아이가 1명이면 필터 칩 미표시, 자동 선택

### 작성 UI

- 바텀시트 모달 방식 (페이지 이동 없음, 기록 허들 최소화)
- 기록이 있을 때 FAB 버튼으로 새 기록 작성

## LLM 컨텍스트 주입

### 관찰 기록 → 상담 연계

- 상담 시작 시(INPUT → DIAGNOSTIC 전환) 및 처방전 생성 시 해당 사용자의 최근 관찰 기록 5건을 자동 조회
- 조회 실패 시 관찰 기록 없이 진행

### 주입 위치

- `/api/consult/questions/initial`: 시스템 프롬프트의 [응답 원칙] 앞에 [최근 양육 관찰 기록] 섹션 삽입
- `/api/consult/prescription`: 시스템 프롬프트의 [분석 재료]에 관찰 기록 추가, [응답 가이드]에 "관찰 기록 연계" 지침 추가

### 주입 포맷

```
[날짜] 상황: ... → 양육자 행동: ... → 아이 반응: ... (메모: ...)
```

### LLM 활용 지침

- 이전에 시도한 방법 중 효과적이었던 것은 강화, 효과 없었던 것은 다른 접근 제안
- "지난번에 ~를 시도하셨는데"와 같이 자연스럽게 언급

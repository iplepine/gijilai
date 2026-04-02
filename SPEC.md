# 기질아이(GIJILAI) - 개발 스펙 문서

> **서비스 컨셉**: 과학적 기질 분석(CBQ/ATQ)과 AI 전문가의 통찰을 결합한 맞춤형 육아 가이드 서비스
> **타겟**: 3~7세 자녀를 둔 부모
> **수익 모델**: 무료 하이라이트 리포트 + 구독(월 12,000원) 기반 프리미엄 서비스 제공

---

## 📱 화면 구성 (8개 스크린)

```
[1] 홈 → [2] 접수 → [3] 설문 → [4] 무료 리포트(요약) → [5] 결제/로딩 → [6] 프리미엄 리포트(심층) → [7] 솔루션 → [8] 공유
```

## 1. 홈/랜딩 화면 (Home)

### 목적
서비스 가치 제안 및 무료 리포트 체험 유도

### 컴포넌트
| 영역 | 내용 |
|------|------|
| Hero Section | 핵심 카피 + 샘플 리포트 이미지 |
| CTA 버튼 | `[우리 아이 기질 무료로 알아보기]` → 접수 화면 이동 |
| Social Proof | "이미 {count}명의 부모님이 확인했습니다" (실시간 카운터) |

### 디자인
- 컬러: 딥그린/크림/골드 (신뢰감 및 따뜻함)
- 레이아웃: 모바일 최적화 원페이지 스크롤

---

## 2. 접수/기본정보 화면 (Intake)

### 목적
연령 세그먼트 및 개인화 리포트용 기초 데이터 수집

### 입력 필드
```typescript
interface IntakeForm {
  // 약관
  privacyAgreed: boolean;        // 개인정보 처리 방침 동의
  disclaimerAgreed: boolean;     // "의학적 진단 아님" 면책 동의

  // 아이 정보
  childName: string;             // 이름 또는 닉네임
  gender: 'male' | 'female';
  birthDate: string;             // 생년월일 (설문 문항 세그먼트 필수)

  // 양육 고민 (최대 3개)
  concerns: ('sleep' | 'eating' | 'tantrum' | 'social' | 'learning')[];
}
```

### 백엔드 로직
- `child_age_months` 자동 계산 → 설문 문항 로딩 & 솔루션 가중치에 활용

---

## 3. 기질 설문 화면 (Survey)

### 목적
CBQ-VSF(아동) 및 ATQ-SV(성인) 데이터 수집

### 기능 요구사항

| 기능 | 설명 |
|------|------|
| 동적 문항 로딩 | 아이 개월 수 기반 CBQ 문항 로드 (3~7세: 36문항) |
| 리커트 척도 | 1(전혀 그렇지 않다) ~ 5(매우 그렇다) |
| Progress Bar | 상단 진행률 표시 (이탈 방지) |
| 임시 저장 | LocalStorage 활용, 브라우저 종료 시에도 유지 |

### 점수 처리 로직
```typescript
// 역채점 문항 처리
const reverseScore = (score: number): number => 6 - score;

// 결측치 처리
const calculateAverage = (scores: number[]): number => {
  return scores.reduce((a, b) => a + b, 0) / scores.length;
};
```

---

## 4. 결제 및 로딩 화면 (Payment & Processing)

### 목적
수익화 + 데이터 분석 수행

### 결제
- 구독제: **월 12,000원**
- 연동: 포트원 V2 (NHN KCP + 토스페이 + 네이버페이)

### 로딩 애니메이션 (UX)
```
"기질 데이터 분석 중..."
"아이의 소중한 신호를 읽고 있어요..."
"맞춤 솔루션 생성 중..."
```

### 백엔드 처리 파이프라인
```
1. 기질 점수 산출 (외향성, 부정적 정서, 의도적 통제 등)
2. 부모-자녀 기질 궁합 분석
3. AI 전문가 큐레이션 로직 실행
4. 맞춤형 마법의 한마디 생성
```

---

## 5. 리포트 메인: 통합 분석 (Integrated Report)

### 목적
핵심 가치 제공 (공유 최적화)

### 컴포넌트

| 영역 | 예시 |
|------|------|
| 통합 성향 카드 | `[열정 탐험가]`, `[세심한 사색가]` 등 |
| 핵심 요약 | "아이는 높은 활동성과 호기심을 타고났습니다. 억제보다 발산이 성장의 핵심입니다." |
| 관계 온도계 | 부모-자녀 적합도 게이지 차트 |

---

## 6. 리포트 상세: 기질 분석 (Detail Analysis)

### 목적
과학적 근거 데이터 상세 확인

### 탭 구성

#### 아이 기질 탭
- 레이더 차트 (Chart.js)
  - 자극추구 / 위험회피 / 사회적 민감성 / 인내력
- 아이의 성격적 강점 설명

#### 양육자 분석 탭
- 양육자의 기질적 특성 분석
- 자녀 기질과의 역동 설명

#### 기질 맞춤 양육 탭
- 부모-자녀 기질 차이 구간 설명 (Goodness of Fit)
- 갈등 지점 예측 및 예방 가이드

---

## 7. 맞춤 솔루션 화면 (Actionable Solutions)

### 목적
실질적인 양육 행동 가이드 제공

### 솔루션 카테고리

| 카테고리 | 예시 |
|----------|------|
| 맞춤 놀이 처방 | 정적인 성향 보완 → 신체 활동 게임 추천 |
| 대화 템플릿 | 고민별 훈육/공감 스크립트 (마법의 한마디) |
| 환경 구성 | 아이 기질에 맞는 방 색상, 조명 배치 제안 |

### 로직
```
솔루션 우선순위 = f(양육 고민 선택, 기질 프로필)
```
- 접수 시 선택한 `concerns`와 분석된 성향을 교차하여 정렬

---

## 8. 공유 및 확장 화면 (Share & Referral)

### 목적
바이럴 마케팅 + 가족 데이터 연결

### 기능

| 기능 | 설명 |
|------|------|
| 리포트 저장 | 이미지 또는 링크 형태로 리포트 저장 |
| 배우자 공유 | "배우자에게 우리 아이 리포트를 공유해보세요" |
| 추천 링크 | UUID 포함 카카오톡 공유 링크 생성 |
| 마법의 한마디 | 상황별 즉시 실천 가능한 육아 스크립트 제공 |

---

## 🗄️ 데이터 모델 (Draft)

```typescript
// 아이 정보
interface Child {
  id: string;
  parent_id: string;      // 사용자(부모) ID
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  ageMonths: number;      // 자동 계산
  image_url: string | null;
}

// 설문 응답 (이력 관리)
interface SurveyResponse {
  id: string;
  childId: string;
  userId: string;
  type: 'CHILD' | 'PARENT' | 'PARENTING_STYLE';
  answers: Record<string, number>;
  scores: Record<string, number>;
  status: 'COMPLETED' | 'IN_PROGRESS';
  completedAt: Date;
}

// 분석 결과 (다중 리포트)
interface AnalysisResult {
  id: string;
  childId: string;
  userId: string;
  surveyId: string;
  type: 'CHILD' | 'PARENT' | 'HARMONY';
  analysis_json: any;     // AI 분석 결과 본문
  is_paid: boolean;       // 결제 여부
  createdAt: Date;
}
```

---

## 📊 정책: 다중 리포트 및 재검사
1. **다중 아이 지원**: 한 계정당 여러 명의 아이를 등록하고 각각의 기질을 검사할 수 있음.
2. **무료 사용자 재검사 주기**:
    *   동일 아이에 대한 무료 재검사는 **1주(7일)**마다 1회 허용됨.
    *   검사 완료 후 7일 이내에는 추가 무료 검사가 제한됨.
3. **구독 사용자 정책**:
    *   구독 중에는 재검사 횟수 제한 없이 이용 가능.
    *   단, 재검사 완료 후에는 아이의 변화 관찰 시간을 고려하여 **최소 24시간(1일)**의 쿨다운이 적용됨.
    *   즉, 구독 사용자라 하더라도 하루에 1회 이상의 무분별한 AI 리포트 생성은 제한됨.
4. **이력 보존**: 모든 검사 결과는 `나의 기록` 탭에서 회차별로 보존되며 삭제하기 전까지 유지됨.

---

## 9. 상담 세션 & 실천 시스템 (Consultation Sessions & Practices)

### 목적
상담을 일회성 이벤트가 아닌 고민별 지속 케어 흐름으로 전환. 실천 항목을 관리 가능한 범위로 유지.

### 핵심 개념

| 개념 | 설명 |
|------|------|
| 상담 세션 | 하나의 고민 주제에 대한 지속적인 케어 스레드. 동시 활성 최대 **3개** |
| 추가 상담 | 기존 세션 안에서 후속 상담. 실천 항목이 진전에 맞게 업데이트됨 |
| 실천 항목 | 상담에서 나온 액션 아이템. 전체 활성 최대 **5개** (3개 세션 합산) |

### 상담 세션

```typescript
interface ConsultationSession {
  id: string;
  child_id: string;
  user_id: string;
  title: string;              // 고민 주제 요약 (LLM 자동 생성)
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  created_at: Date;
  updated_at: Date;
}
```

- 새 상담 시작 시 활성 세션이 3개이면 → "진행 중인 고민이 3개예요. 기존 고민에 이어서 상담하거나, 해결된 고민을 정리해주세요" 안내
- 세션 상태 전환: ACTIVE → RESOLVED (양육자가 "해결됨" 표시) → ARCHIVED (자동, 30일 후)
- 각 세션에 속한 상담 이력(consultations)은 시간순으로 누적

### 추가 상담 흐름

1. 실천 탭 또는 세션 상세에서 "추가 상담하기" 진입
2. 이전 상담 맥락 + 실천 기록이 LLM 컨텍스트로 자동 주입
3. LLM이 기존 실천 항목을 평가하고 업데이트된 실천 항목 제안
4. 기존 실천 항목 중 유지/교체/완료 처리를 양육자가 선택

### 실천 항목

```typescript
interface PracticeItem {
  id: string;
  session_id: string;
  consultation_id: string;     // 이 항목을 생성/갱신한 상담
  title: string;               // 실천 항목 제목 (한 줄)
  description: string;         // 구체적 실천 방법
  duration: number;            // 권장 기간 (일 단위, 1~14)
  encouragement: string;       // 기간 안내 응원 메시지
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  created_at: Date;
}

interface PracticeLog {
  id: string;
  practice_id: string;
  date: string;                // YYYY-MM-DD
  done: boolean;               // 오늘 실천 여부
  memo: string | null;         // 한줄 메모 (선택)
}

interface PracticeReview {
  id: string;
  practice_id: string;
  content: string;             // 종합 회고 (자유 텍스트)
  created_at: Date;
}
```

- 새 실천 등록 시 활성 항목이 5개이면 → 기존 항목 중 완료/포기 처리 후 등록
- 매일 실천 체크: 했다/못했다 + 한줄 메모 (선택)
- 기간 완료 시 종합 회고 유도: "해보니 어떠셨어요?"

### 처방전 JSON 구조 변경

```typescript
// 기존: actionItem (단수 문자열)
// 변경: actionItems (배열)
interface Prescription {
  interpretation: string;
  chemistry: string;
  questionAnalysis?: QuestionAnalysisItem[];
  magicWord: string;
  actionItems: {
    title: string;
    description: string;
    duration: number;          // 1~14일
    encouragement: string;
  }[];
}
```

### 실천 탭 (`/practices`)

| 상태 | 표시 |
|------|------|
| 진행 중인 실천 있음 | 세션별 그룹핑, 아이템마다 진행률 + 오늘 체크 버튼 |
| 기간 완료 | 회고 작성 유도 카드 |
| 진행 중 없음 | 빈 상태 + 상담 시작 CTA |

- 다자녀 시 아이별 필터 칩
- 세션 카드에서 "추가 상담하기" 버튼 → 해당 세션 컨텍스트로 상담 진입

### 홈 화면 연동

- 기존 "오늘의 관찰일지" 카드 → "오늘의 실천" 카드로 교체
- 진행 중인 실천이 있으면: 오늘 체크 안 한 항목 수 표시 + 실천 탭 이동
- 없으면: 카드 미표시

### LLM 컨텍스트 주입

- 추가 상담 시 해당 세션의 전체 상담 이력 + 실천 로그 주입
- 새 세션 시작 시에도 다른 세션의 실천 요약 경량 주입 (교차 참조)
- 주입 포맷: `[세션: {title}] 실천: {item} | {done_days}/{duration}일 실천 | 회고: {review}`

---

## ✅ 개발 체크리스트

- [x] 홈 화면 디자인 하모나이징
- [x] 전역 테마 변수 (Deep Green, Cream) 적용
- [x] 무료 요약 및 유료 심층 리포트 2단계 시스템 구현
- [ ] 다중 아이 등록 및 전환 UI 구현
- [ ] 홈 화면 '새로운 검사 시작' 진입점 추가
- [ ] 리포트 생성 시 데이터 초기화 로직 보완
- [ ] 나의 기록 탭 아이별 필터링 강화
- [ ] PDF 생성 + 공유 기능
- [ ] 추천 시스템 (쿠폰 발급)

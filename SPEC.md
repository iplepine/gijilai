# 기질아이(GIJILAI) - 개발 스펙 문서

> **서비스 컨셉**: 과학적 기질 분석(CBQ/ATQ)과 AI 전문가의 통찰을 결합한 맞춤형 육아 가이드 서비스
> **타겟**: 3~7세 자녀를 둔 부모
> **수익 모델**: 무료 하이라이트 리포트 + 지속관리형 구독(월 12,000원) 기반 프리미엄 서비스 제공

---

## 📱 화면 구성 (8개 스크린)

```
[1] 홈 → [2] 접수 → [3] 설문 → [4] 빠른 아이 리포트(child_only) → [5] 전체 리포트 확장 → [6] 구독/결제 → [7] 상담·실천 → [8] 공유
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
  gender: 'male' | 'female';     // (AI 리포트 생성 시 성별 특성 반영)
  birthDate: string;             // 생년월일 (설문 문항 세그먼트 및 AI 리포트 연령 반영 필수)

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
| 설문 시작 분기 | `빠르게 아이 결과 먼저 보기`와 `처음부터 전체 분석 시작하기` 중 선택 |
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
- 연동: 앱은 Apple/Google IAP, 웹은 포트원 V2 내부 PG 라우팅. 사용자는 PG/카드사를 선택하지 않는다.
- 웹 브라우저에서 앱 설치 랜딩으로 보낼 때 iOS/Android는 감지된 기기에 맞는 스토어 단일 CTA만 보여주고, 데스크톱/기타 브라우저에서만 App Store/Google Play 선택지를 제공한다.
- 앱의 구독 관리 화면은 브라우저 기본 `alert/confirm`이 아니라 앱/서비스 디자인에 맞는 커스텀 다이얼로그를 사용해야 한다.
- 앱 구독(Apple/Google IAP) 해지는 앱 서버가 직접 즉시 종료하지 않고, 각 스토어의 구독 관리 화면으로 안내한 뒤 스토어 상태를 다시 조회해 `cancelled_at`을 반영해야 한다.
- 해지 예약(`cancelled_at` 존재) 상태에서는 결제 출처와 무관하게 사용자가 즉시 "구독 계속하기" 동선을 볼 수 있어야 하며, `PORTONE`은 앱 내 재개 API 호출 버튼을, `APPLE_IAP`/`GOOGLE_PLAY`는 스토어 구독 관리 화면으로 이동하는 버튼을 노출해야 한다.
- 웹 정기결제 등록에는 결제창 호출 시 구매자 이름/휴대폰 번호/이메일을 전달해야 한다. 휴대폰 번호는 구독 버튼을 누른 시점에 다이얼로그로 입력받고 앱 DB에는 저장하지 않는다.
- 결제 이력에는 결제수단과 마스킹된 카드번호만 표시한다. 카드 전체 번호, CVC, 유효기간은 저장하지 않는다.
- 구독 유도는 체험 종료 임박 홈 카드, 리포트 하단 프리미엄 CTA, 상담 결과 후 실천 연결 CTA에 노출한다.
- 요금제 화면은 기능 잠금 해제 목록보다 `리포트 → 상담 → 실천 기록 → 다음 상담` 지속관리 루프를 먼저 설명해야 한다.
- 구독 메시지는 "무제한 이용"보다 "기록이 쌓일수록 다음 상담이 더 정확해진다"는 지속관리 약속을 우선 전달한다.
- 환불 판단을 위해 결제 기간 내 AI 상담 생성, 후속 상담, 구독자 전용 실천 기록 전체 열람 같은 유료 기능 사용 이력을 서버에 기록한다.

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

### 모바일 운영 요구사항
- Flutter 모바일 쉘(`gijilai_app/`)은 Firebase Crashlytics를 연결하여 앱 시작 실패, WebView 로드 실패, 인앱결제 예외를 수집한다.
- Android 릴리스 빌드는 Crashlytics 심볼 업로드가 가능해야 하며, iOS는 dSYM 업로드 스크립트가 포함되어야 한다.

---

## 5. 리포트 메인: 통합 분석 (Integrated Report)

### 목적
핵심 가치 제공 (공유 최적화)

### 빠른 첫 결과
- 아이 설문 완료 직후 `child_only` 모드로 먼저 진입할 수 있어야 한다.
- 이 모드에서는 아이 진단 탭만 먼저 보여주고, 하단 CTA로 양육자 분석/전체 리포트 확장을 유도한다.

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
| 추천 링크 | UUID 포함 카카오톡/링크/OS 공유 링크 생성 |
| 마법의 한마디 | 상황별 즉시 실천 가능한 육아 스크립트 제공 |

- `다른 앱` 공유 버튼은 모바일 브라우저 또는 앱 WebView에서만 노출한다.
- 앱 WebView에서는 웹 공유 API 대신 Flutter `ShareBridge`로 OS 공유 시트를 호출한다.

---

## 8-1. 기본 운영 통계 (Firebase Analytics)

### 목적
- 운영자가 핵심 퍼널 전환율을 확인할 수 있어야 함
- 향후 A/B 테스트 전 기본 기준선 데이터를 확보해야 함

### 측정 범위

| 단계 | 기본 확인 지표 |
|------|---------------|
| 랜딩 | 페이지뷰, CTA 클릭 |
| 로그인 | 로그인 시도/성공, 로그인 수단 비중 |
| 접수 | 접수 완료 수 |
| 설문 | 모듈별 시작/완료 수, 전체 설문 완료 수 |
| 리포트 | 탭별 조회 수 |
| 결제 | 결제 시도/성공, 결제수단별 전환 |
| 상담 | 상담 시작 수, 후속 상담 비중 |

### 구현 요구사항
- 웹 앱은 Firebase에 연결된 Measurement ID를 사용하여 이벤트를 전송한다.
- Flutter 앱 WebView의 루트(`/`) 첫 진입에서는 로그인 세션이 없더라도 바로 `/login`으로 리다이렉트하지 않고, 랜딩 화면을 먼저 보여준다.
- Flutter 앱은 `/login` 도달 시 네이티브 로그인 화면을 오버레이한다. 앱은 `window.__nativeCapabilities.supportedScreens.login`과 `nativeAuthProviders`로 현재 앱 버전이 지원하는 로그인 화면 및 provider별 네이티브 토큰 교환 여부를 명시한다. iOS 카카오/Apple/Google은 네이티브 SDK 토큰을 `/auth/native-session`으로 전달해 WebView Supabase 세션 쿠키와 연결한다. Android Kakao/Apple/Google은 Supabase OAuth authorize URL을 Android Custom Tab으로 열고 `gijilai://auth/callback` 딥링크로 복귀한다.
- 환경변수 `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`가 없는 경우 추적 코드는 동작하지 않아야 한다.
- 이벤트에는 개인식별 가능한 자유 텍스트를 넣지 않는다.
- 페이지 이동 시 `page_view`를 자동으로 기록한다.

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

## 8-2. 공동양육자(Co-Parent) 모드

### 목적
한 아이의 기질·상담·실천 맥락을 두 양육자가 함께 보고, "옆에 있는 사람"이 만드는 관계형 리텐션을 만든다. 자세한 정책: `docs/product/policies/co-parent.md`.

### 권한 모델 (비대칭 초대, ADR 2026-05-31)

| 역할 | 식별 | 권한 |
|------|------|------|
| `owner` | `children.parent_id` | 아이 정보 수정/삭제, 구독 변경, 모든 읽기/쓰기, 협력자 초대/해제 |
| `co_parent` | `child_co_parents.co_parent_id` | 아이 맥락 읽기, 상담 시작/이어가기, 실천 기록·회고 작성, 본인 연결 해제 |

- 한 아이당 `co_parent` 최대 1명 (1:1)
- `co_parent`는 본인 계정으로 가입한다(가족 공유 계정 금지)
- 솔로 사용자 경험은 옵트인 원칙으로 무손상

### 호칭(Label)
- 폐쇄형 enum: `MOM | DAD | CARER` (한국어 매핑: 엄마/아빠/보호자)
- `owner`는 아이 설정에서, `co_parent`는 초대 수락 화면에서 선택
- 두 양육자가 같은 호칭이면 표시에 첫 이름 1자 추가

### 초대 흐름
1. Owner: 아이 설정 → "함께 보는 분 초대" → 토큰 발급(만료 7일) → 카카오톡/링크 공유
2. Co-parent: `/invite/[token]` 진입 → 미리보기 → 비로그인이면 로그인 → 호칭 선택 → 동의 → 수락
3. 결과: `child_co_parents.status = 'ACCEPTED'`, 아이 셀렉터에 노출, 모든 맥락 공유

토큰은 일회용. 한 아이당 동시 `PENDING` 1개. 새 발급 시 기존 `PENDING`은 `REVOKED`.

### 데이터 가시성
다운스트림 9개 테이블(`surveys`, `reports`, `consultation_sessions`, `consultations`, `action_items`, `practice_items`, `practice_logs`, `practice_reviews`, `observations`)은 모두 작성자(`user_id`) RLS에 `is_child_co_parent(child_id)` OR-clause를 추가해 co-parent도 읽기/쓰기 가능. `subscriptions`, `payments`, `profiles`, `referrals`, `child_profile_slots`는 노출하지 않음.

### 구독 권한 (Phase 1)
- owner의 구독·체험 상태로 두 양육자 모두 유료 기능 사용
- co-parent는 결제/구독 관리 화면 접근 불가
- owner 해지/탈퇴 시 grace 흐름은 Phase 2에서 결정

### LLM 컨텍스트
상담 시작·문진·처방 프롬프트에 다음 컨텍스트가 주입된다(공동양육자 연결 시에만):
- 현재 작성자 호칭
- 공동양육자 존재 여부와 상대 호칭
- 이전 상담 작성자 라벨
- 처방 톤 가이드: 현재 작성자 시점 1인칭, 상대 양육자를 평가/비교 X

### 의도적 비포함 (Phase 1)
- 자동 푸시 알림 — 1차 검증은 카카오톡 등 외부 채널 수동
- co-parent의 양육자 기질(ATQ) 응답 강제
- 응원/똑똑 반응 UI
- 양육자 분석 리포트 두 명 분리
- 3인 이상 다자

### Feature Flag
`NEXT_PUBLIC_ENABLE_CO_PARENT_INVITES=false`로 전체 기능을 숨길 수 있다. 마이그레이션은 유지(RLS OR-clause는 솔로에 무해).

---

## 8-3. 양육자 자신을 위한 상담 (Self-Parent Consultation)

### 목적
아이 행동 상담을 넘어 양육자 본인의 마음·자기 작업을 같은 상담→실천 루프에서 다룬다. 캐치프라이즈 **"더 좋은 사람이 되기 위해 고민하는 것만으로 당신은 이미 좋은 사람"** 을 제품 톤 약속으로 삼는다. 자세한 정책: `docs/product/policies/self-parent.md`. 기획: `docs/product/SELF_PARENT_CONSULTATION_PLAN.html`.

### 흐름 (Phase 1 — one-shot reflection)
1. 진입: 아이 상담 결과 화면 CTA → `/consult/self?from=child_consult`
2. 입력: "지금 양육에서 마음에 무거운 것" 자유 텍스트
3. 위기 감지: 자해/폭력/지속 디스트레스 키워드 시 처방 대신 전문기관 안내 우선
4. 문진: 양육자 본인을 향한 부드러운 질문 2개 (감정 / 이미 잘하고 있는 것·바라는 작은 변화)
5. 처방: 짧은 acknowledgment + reflection + 나에게 해줄 한 마디 + 오늘 나를 위한 단 하나의 action
6. 기록 저장

### 실천 루프 (Phase 2 — self practice loop)
1. 결과 "마음에 담기" → action을 `practice_items`(type='SELF_PARENT')로 저장
2. `/consult/self/records` "내 마음 기록": 진행 중 자기 돌봄 + 지난 마음 기록
3. "이번 주 어떠셨어요?" 후속: `도움이 됐어요/잘 모르겠어요/못 했지만 괜찮아요` 3선택 + 선택 메모 → 1회 부드러운 마무리(COMPLETED + 회고). **데일리 체크·streak 없음** (숙제화 방지)
4. 홈 "오늘의 나" 카드: 진행 중 자기 돌봄 있으면 노출, 없으면 self-hide
5. self-parent 실천은 아이 실천 목록·활성 카운트(5개 제한)에 섞이지 않음 (type 분리)

### 처방 구조
```typescript
interface SelfParentPrescription {
  acknowledgment: string;   // 짧은 인정 (평가 X)
  reflection: string;       // 마음 비춰주기 (진단 X)
  magicWordForSelf: string; // 나에게 해줄 한 마디
  action: {
    tool: 'SELF_AWARENESS' | 'SELF_COMPASSION' | 'SELF_CARE' | 'SET_LIMIT'
        | 'ASK_HELP' | 'ALLOW_REST' | 'ACKNOWLEDGE_NOW';
    title: string;          // 30초~5분 크기, 본인을 위한 행동
    description: string;
    duration: number;       // 1~7일
  };
  sessionTitle?: string;
}
```

### 임상 경계 (필수)
- AI가 심리치료를 흉내내지 않는다. 어린 시절·트라우마 깊이 파기, 진단명, 부부 관계 분석 금지.
- 위기 키워드 감지 시 전문기관 안내(자살예방 109/1393, 정신건강 1577-0199, 아동학대 112) 우선.
- 위기 로그(`self_reflection_safety_events`)는 카테고리·시점만 저장, 자유 텍스트 원문 미저장.

### 데이터 분리
- `consultation_sessions/consultations/practice_items.type = 'CHILD' | 'SELF_PARENT'` (마이그레이션 019).
- 아이 상담 기록·실천·활성 카운트(3개·5개 제한)는 `type='CHILD'`만 본다. self-parent는 섞이지 않는다.

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

### 긴 글 입력 보조

- 상담 고민 입력, 문진 주관식 답변, 오늘의 실천 한줄메모, 실천 종합 회고처럼 자유 텍스트를 받는 영역에는 모바일/터치 환경에서 음성 입력 버튼을 제공한다.
- 음성 인식은 브라우저 내장 Web Speech API를 우선 사용하며, 데스크톱 또는 미지원 브라우저에서는 버튼을 숨기거나 비활성화하고 기존 키보드 입력은 그대로 유지한다.
- 음성으로 입력된 텍스트도 각 필드의 기존 최대 글자 수 제한을 따른다.

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
- `duration`은 성공 횟수 목표가 아니라 달력 기준 리뷰 권장 기간이다.
- 마지막 실천 행동일은 가장 최근 `PracticeLog.date`를 기준으로 계산하며, 기록이 없으면 `created_at`을 사용한다.
- 마지막 행동 후 3일 이상 기록이 없으면 "다시 이어가기/다른 방법 찾기"를 제안하고, 실패나 방치로 표현하지 않는다.
- 기간이 지나면 종합 회고를 유도하고, 짧게 연장하거나 다른 방법을 찾을 수 있게 한다.
- 회고 저장 후 연결 상담 세션은 자동 마감하지 않는다. 사용자가 "이 고민은 어느 정도 해결됐어요"를 선택할 때만 세션을 `RESOLVED`로 바꾸고, 같은 세션의 남은 ACTIVE 실천은 `DROPPED`로 정리한다.
- 회고 저장 후 기본 다음 행동은 현재 흐름에 따라 "이 고민 마무리하기", "다음 상담에서 조정하기", "상황이 바뀌었어요" 중 선택하도록 제공한다.

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
| 마지막 행동 후 3일 이상 멈춤 | 다시 기록하기 + 다른 방법 찾기 |
| 기간 완료 | 마감 회고 + 3일 연장 + 다른 방법 찾기 |
| 기간 완료 후 마지막 행동도 3일 이상 없음 | 흐름 정리 + 다른 방법 찾기 |
| 진행 중 없음 | 빈 상태 + 상담 시작 CTA |

- 다자녀 시 아이별 필터 칩
- 세션 카드에서 "추가 상담하기" 버튼 → 해당 세션 컨텍스트로 상담 진입
- 상단에 다음 상담을 위한 실천 기록 요약을 표시한다: 전체 실천률, 누적 완료 횟수, 오늘 미체크 항목 수, 최근 한줄 메모
- 알림 영역에는 현재 리마인더 상태(꺼짐/매일 HH:MM 등)를 함께 노출하고 `/settings/notifications`로 이동할 수 있어야 한다
- 실천 리마인더 설정은 웹에서는 기기 로컬 저장으로 유지하고, Flutter 앱에서는 WebView 브리지로 전달해 매일 반복 로컬 알림을 예약한다
- 로컬 알림은 정상 진행 중인 실천이 있을 때만 유지한다. 마지막 행동 후 3일 이상 멈췄거나 마감 회고가 필요한 실천은 반복 리마인더 대신 앱 안에서 정리/재시작 카드를 보여준다.
- 실천 로그의 `오늘` 기준은 UTC가 아니라 사용자의 로컬 날짜를 사용한다

### 홈 화면 연동

- 기존 "오늘의 관찰일지" 카드 → "오늘의 실천" 카드로 교체
- 진행 중인 실천이 있으면: 오늘 체크 안 한 항목 수 표시 + 실천 탭 이동
- 마지막 행동 후 3일 이상 멈췄거나 마감 회고가 필요한 실천이 있으면: "정리할 실천"으로 실천 탭 이동을 우선 제안
- 없으면: 카드 미표시

### LLM 컨텍스트 주입

- 추가 상담 시 해당 세션의 전체 상담 이력 + 실천 로그 주입
- 새 세션 시작 시에도 다른 세션의 실천 요약 경량 주입 (교차 참조)
- 주입 포맷: `[세션: {title}] 실천: {item} | {done_days}/{duration}일 실천 | 회고: {review}`
- 상담 프롬프트에는 아이 기본 정보(이름, 연령/개월 수, 성별)를 항상 포함
- 상담 질문과 처방전은 아이의 연령대별 인지·정서 발달 수준을 반영한 표현과 행동 제안으로 개인화
- 성별은 고정관념을 강화하는 근거로 사용하지 않고, 생활 맥락을 구체화하는 보조 정보로만 활용
- 이미 알고 있는 아이 정보(이름, 연령, 성별, 기질 유형)는 다시 묻지 않고 현재 고민의 맥락 파악에 질문을 집중
- 앱 인앱결제는 최초 구매 검증뿐 아니라 Apple 서버 알림과 Google RTDN으로 갱신/해지/환불 상태를 서버에서 동기화

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

---

## 🔔 공동양육자 알림 (Co-Parent Notifications)

> 목적: 한 양육자가 아이 상담을 남기면 상대 양육자에게 알려, "한 명이 잊어도 상대가 끌어오는" 관계형 리텐션(공동양육자 정책 참조)을 강화한다.
> 관련: `docs/product/policies/co-parent.md` §공동양육자 알림, ADR 2026-07-06, 마이그레이션 `026_co_parent_notifications.sql`

### 불변 규칙 (Privacy Invariant)
- **`SELF_PARENT`(양육자 자기 상담)는 절대 알림 대상이 아니다.** 트리거가 `type='CHILD'`만 처리한다.
- 알림은 이미 상담을 공유하는 관계(수락된 공동양육자) 안에서만 발생한다 → 별도 동의 게이트 없이 기존 공유 범위와 일치.
- 솔로 사용자(공동양육자 없음)에게는 알림이 생성되지 않는다.

### Phase 1 — 인앱 알림 ✅ (구현 완료)
- [x] `notifications` 테이블 + RLS(수신자 본인만 조회/읽음/삭제) + 발송은 SECURITY DEFINER 트리거만
- [x] 트리거: 새 `CHILD` 상담 세션 INSERT 시 상대 양육자(들)에게 알림 1건 (소유자↔공동양육자 양방향)
- [x] `GET /api/notifications` (목록 + 안 읽은 개수), `POST /api/notifications/read` (읽음 처리)
- [x] `/notifications` 화면 (목록·읽음·세션으로 이동)
- [x] 홈 상단바 알림 벨 + 안 읽은 뱃지 (co-parent 플래그 OFF면 숨김)
- 트리거 지점 근거: `consult/page.tsx`는 처방 성공 후에만 세션 row를 만들므로, 세션 INSERT = "새 상담 완료"의 정확한 신호.
- 알림 문구는 저장하지 않고 구조 참조(actor/child/session)만 저장 → 표시 시 호칭 모델로 조합(i18n·호칭 변경에 강건).

### Phase 2 — 진짜 푸시 (FCM) — 📋 해야 할 작업 (미착수)
> 인앱 알림은 앱을 열어야 보인다. 실제 푸시로 확장한다. 현재 서버→기기 푸시 인프라는 전무(웹 FCM/서비스워커 없음, Flutter는 로컬 알림만, `firebase_messaging` 미설치).

- [ ] **Flutter: `firebase_messaging` 추가** — 이미 초기화된 Firebase Core에 메시징 패키지 도입(`gijilai_app/pubspec.yaml`)
- [ ] **iOS APNs 세팅** — Apple Developer에서 APNs 인증키(.p8) 발급 → Firebase 콘솔 등록 (유일하게 번거로운 지점)
- [ ] **기기 토큰 저장** — `device_tokens` 테이블(`user_id`, `token`, `platform`, `updated_at`) + 앱 로그인/토큰 갱신 시 upsert API(`POST /api/notifications/token`)
- [ ] **웹뷰↔네이티브 토큰 브릿지** — 기존 `ReminderBridge` 패턴 재사용해 FCM 토큰을 웹으로 전달하거나, 앱에서 직접 Supabase에 저장
- [ ] **발송 트리거 전환/보강** — DB 트리거가 만든 notifications row를 Supabase Edge Function(또는 서버 라우트)이 감지해 수신자 토큰으로 FCM 발송. (권장: `pg_net`/Edge Function `on insert`, 또는 앱 코드에서 세션 저장 직후 발송 호출)
- [ ] **푸시 클릭 딥링크** — 알림 탭 시 `/consultations/{sessionId}`로 진입
- [ ] **권한/설정 연동** — 기존 `settings/notifications`에 공동양육자 푸시 on/off 토글 추가
- [ ] **조용한 시간(방해금지)·중복 억제** — 야간 발송 지연, 동일 세션 중복 발송 방지
- [ ] (선택) **웹푸시/이메일/카카오 알림톡** — 앱 미설치 사용자 대비 fallback 채널

### Phase 1.5 — 후보(옵션, 사용자 결정 대기)
- [ ] 알림 on/off 토글(설정) — 지금은 공유 범위와 일치해 항상 켜짐. 부담되면 옵트아웃 제공
- [ ] 알림 타입 확대 — 새 처방/실천 완료/리포트 생성 (현재 스키마 `type` enum·`data jsonb`로 확장 가능하게 설계됨)
- [ ] 실시간 갱신 — 현재는 화면 진입 시 폴링. Supabase Realtime 구독으로 즉시 뱃지 갱신

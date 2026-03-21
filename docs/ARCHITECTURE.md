# 아키텍처

시스템 구조 및 컴포넌트 책임 정의.
최종 동기화: 2026-03-21

## 개요

기질아이(GIJILAI)는 과학적 기질 검사(아동 CBQ-VSF, 부모 ATQ-SV)와 AI 기반 인사이트를 결합한 맞춤형 육아 가이드 서비스입니다. 부모가 아이와 자신에 대한 설문을 완료하면, "정원" 메타포(아이 = 식물, 부모 = 토양, 관계 = 하모니)를 활용하여 개인화된 리포트와 실천 가능한 양육 솔루션을 제공합니다.

시스템은 Next.js 웹 앱과 Flutter 모바일 쉘(`gijilai_app/`)로 구성되어 있으며, Flutter는 웹앱을 WebView로 감싸는 역할만 합니다. 모든 비즈니스 로직은 Next.js 앱에 있습니다.

## 컴포넌트

### 점수 산출 파이프라인
- **위치**: `app/src/lib/TemperamentScorer.ts`
- **역할**: 설문 응답에서 4개 차원(NS, HA, RD, P)의 기질 원점수를 계산. 역채점 및 결측치 처리 포함
- **의존**: 설문 응답 데이터 (Record<string, number>)
- **사용처**: TemperamentClassifier, ParentClassifier, 리포트 페이지

### 아동 분류기
- **위치**: `app/src/lib/TemperamentClassifier.ts`
- **역할**: 아동의 NS/HA/RD/P 점수를 7가지 식물 유형 중 하나로 매핑 (예: "에너지 넘치는 탐험가형"). 씨앗/토양/하모니 분석 포함
- **의존**: TemperamentScorer 출력값
- **사용처**: PrescriptionData, 리포트 페이지, AI 프롬프트

### 부모 분류기
- **위치**: `app/src/lib/ParentClassifier.ts`
- **역할**: 동일한 4개 차원으로 부모 기질을 프로파일링. 제목, 분석, 마법의 계절, 가뭄 시기, 영양분, 편지 등을 포함한 ParentReport 생성
- **의존**: TemperamentScorer 출력값 (부모 설문)
- **사용처**: 리포트 페이지, AI 프롬프트

### 처방 엔진
- **위치**: `app/src/lib/PrescriptionData.ts`
- **역할**: 7가지 아동 유형별 템플릿 기반 양육 가이드 제공 — 해석(interpretation), 마법의 한마디(대화 스크립트), 정원 테마 메타데이터
- **의존**: TemperamentClassifier 출력값
- **사용처**: 리포트 페이지, 솔루션 UI

### AI 리포트 생성기
- **위치**: `app/src/lib/prompts.ts`, `app/src/lib/openai.ts`
- **역할**: OpenAI API를 통한 개인화 내러티브 리포트 생성. 6가지 프롬프트 변형 관리 (CHILD, PARENT, HARMONY x 전체/프리뷰)
- **의존**: 설문 점수, 질문/응답 컨텍스트
- **사용처**: `/api/llm/report` 라우트, 리포트 페이지

### 설문 시스템
- **위치**: `app/src/data/questions.ts`, `app/src/store/surveyStore.ts`, `app/src/app/survey/`
- **역할**: 총 123개 설문 문항 관리 (아동 36 + 부모 77 + 양육태도 10), 진행 상황 추적, 중간 응답을 localStorage에 저장
- **의존**: 문항 정의, Zustand 스토어
- **사용처**: 점수 산출 파이프라인, 리포트 생성

### 데이터베이스 레이어
- **위치**: `app/src/lib/db.ts`
- **역할**: Supabase 클라이언트를 통한 프로필, 아이, 설문, 리포트, 액션 아이템, 추천, 쿠폰 CRUD 작업
- **의존**: Supabase 클라이언트 (`supabase.ts`, `supabaseServer.ts`)
- **사용처**: API 라우트, 설정 페이지, 리포트 페이지

### 상태 관리
- **위치**: `app/src/store/useAppStore.ts`, `app/src/store/surveyStore.ts`
- **역할**: Zustand 기반 클라이언트 상태 관리 (localStorage 영속화). 두 개의 스토어: appStore (접수 데이터, 분석 결과, 결제 상태) / surveyStore (문항별 진행 상태)
- **의존**: Zustand
- **사용처**: 모든 클라이언트 페이지

### 인증
- **위치**: `app/src/lib/supabase.ts`, `app/src/lib/supabaseServer.ts`, `app/src/components/auth/AuthProvider.tsx`
- **역할**: Supabase Auth를 통한 인증 (Google, Kakao OAuth)
- **의존**: Supabase Auth, Kakao JS SDK
- **사용처**: API 라우트 (세션 검증), 보호된 페이지

### 결제
- **위치**: `app/src/app/api/payment/create-intent/route.ts`, `app/src/components/payment/CheckoutForm.tsx`
- **역할**: 프리미엄 리포트 구매를 위한 Stripe PaymentIntent 생성 (990원)
- **의존**: Stripe SDK
- **사용처**: 결제 페이지, 리포트 접근 제어

## 외부 의존성

### Supabase
- **용도**: 인증 (OAuth2), PostgreSQL 데이터베이스, 파일 저장소 (아바타)
- **프로토콜**: REST (@supabase/supabase-js)
- **인증**: 클라이언트용 Anon Key, 서버용 Service Role Key

### OpenAI
- **용도**: AI 기반 내러티브 리포트 생성 (기질 분석, 양육 조언)
- **프로토콜**: REST (openai SDK)
- **인증**: API Key (서버 전용)

### Stripe
- **용도**: 프리미엄 리포트 결제 처리
- **프로토콜**: REST (stripe SDK)
- **인증**: Secret Key (서버 전용)

### Kakao SDK
- **용도**: 소셜 로그인 (OAuth), 공유 기능
- **프로토콜**: JavaScript SDK (layout.tsx에서 주입)
- **인증**: Supabase Auth에 설정된 App Key

## 데이터 흐름

```
[접수 폼] → appStore (아이 이름, 생년월일, 성별, 고민)
      ↓
[설문 페이지] → surveyStore (문항별 응답)
      ↓
[TemperamentScorer] → 원점수 {NS, HA, RD, P}
      ↓
[분류기] → 유형 결정 (아이 식물 유형, 부모 프로필)
      ↓
[OpenAI API] → AI 내러티브 리포트 (JSON)
      ↓
[Supabase DB] → 리포트 + 설문 데이터 저장
      ↓
[리포트 페이지] → 차트, 분석, 처방 표시
      ↓
[공유/PDF] → 내보내기 및 소셜 공유
```

## 데이터베이스 테이블

| 테이블 | 용도 |
|--------|------|
| profiles | 사용자 계정 데이터 |
| children | 아이 프로필 (프로필 이미지 포함) |
| surveys | 설문 응답 + 계산된 점수 (JSON), 상태 |
| reports | 분석 결과 (analysis_json), 결제 여부 |
| action_items | 실천 과제 완료 추적 |
| referrals | 코드 기반 추천 시스템 |
| coupons | 할인 쿠폰 (만료일 포함) |

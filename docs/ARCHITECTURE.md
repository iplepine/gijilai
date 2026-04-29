# 아키텍처

시스템 구조 및 컴포넌트 책임 정의.
최종 동기화: 2026-04-19

## 개요

기질아이(GIJILAI)는 과학적 기질 검사(아동 CBQ-VSF, 부모 ATQ-SV)와 AI 기반 인사이트를 결합한 맞춤형 육아 가이드 서비스입니다. 부모가 아이와 자신에 대한 설문을 완료하면, "정원" 메타포(아이 = 식물, 부모 = 토양, 관계 = 하모니)를 활용하여 개인화된 리포트와 실천 가능한 양육 솔루션을 제공합니다.

시스템은 Next.js 웹 앱과 Flutter 모바일 쉘(`gijilai_app/`)로 구성되어 있으며, Flutter는 웹앱을 WebView로 감싸는 역할만 합니다. 모든 비즈니스 로직은 Next.js 앱에 있습니다.

웹 앱 내부의 모듈 구조, 의존 방향, 상태 관리 기준은 별도 문서 [WEB-ARCHITECTURE.md](WEB-ARCHITECTURE.md)에서 정의합니다.

## 컴포넌트

### 점수 산출 파이프라인
- **위치**: `app/src/lib/TemperamentScorer.ts`
- **역할**: 설문 응답에서 4개 차원(NS, HA, RD, P)의 기질 원점수를 계산. 역채점 및 결측치 처리 포함
- **의존**: 설문 응답 데이터 (Record<string, number>)
- **사용처**: TemperamentClassifier, 리포트 페이지

### 기질 분류기 (아동 + 부모)
- **위치**: `app/src/lib/TemperamentClassifier.ts`
- **역할**: 단일 클래스에 `analyzeChild()`와 `analyzeParent()` 두 정적 메서드. NS/HA/RD 조합으로 아동 8유형, 부모 8유형 분류. 라벨, 이모지, 이미지 경로, 키워드, 설명 반환
- **의존**: TemperamentScorer 출력값 (0-100 스케일)
- **사용처**: 리포트 페이지, 상담 AI 프롬프트

### AI 리포트 생성기
- **위치**: `app/src/lib/prompts.ts`, `app/src/lib/openai.ts`
- **역할**: OpenAI API를 통한 개인화 내러티브 리포트 생성. 3가지 프롬프트 변형 관리 (CHILD, PARENT, HARMONY)
- **의존**: 설문 점수, 질문/응답 컨텍스트
- **사용처**: `/api/llm/report` 라우트, 리포트 페이지

### 설문 시스템
- **위치**: `app/src/data/questions.ts`, `app/src/lib/surveyQuestions.ts`, `app/src/store/surveyStore.ts`, `app/src/app/survey/`
- **역할**: 설문 문항 관리 (아동 CBQ + 양육태도 + 부모 ATQ), 진행 상황 추적, 중간 응답을 localStorage에 저장. `surveyQuestions.ts`는 리커트 척도 옵션 및 원문 문항 정의, `questions.ts`는 앱 내 표시용 문항
- **의존**: 문항 정의, Zustand 스토어
- **사용처**: 점수 산출 파이프라인, 리포트 생성

### 데이터베이스 레이어
- **위치**: `app/src/lib/db.ts`
- **역할**: Supabase 클라이언트를 통한 프로필, 아이, 설문, 리포트, 관찰 기록, 상담, 실천, 구독/결제 CRUD 작업
- **의존**: Supabase 클라이언트 (`supabase.ts`, `supabaseServer.ts`)
- **사용처**: API 라우트, 설정 페이지, 리포트 페이지

### 상태 관리
- **위치**: `app/src/store/useAppStore.ts`, `app/src/store/surveyStore.ts`
- **역할**: Zustand 기반 클라이언트 상태 관리 (localStorage 영속화). 두 개의 스토어: appStore (접수 데이터, 분석 결과, 결제 상태) / surveyStore (문항별 진행 상태)
- **의존**: Zustand
- **사용처**: 모든 클라이언트 페이지

### 인증
- **위치**: `app/src/lib/supabase.ts`, `app/src/lib/supabaseServer.ts`, `app/src/components/auth/AuthProvider.tsx`
- **역할**: Supabase Auth를 통한 인증 (Apple OAuth, Google OAuth, Kakao OAuth, 이메일/비밀번호)
- **앱 WebView**: `/login` 도달 시 Flutter 네이티브 로그인 화면을 오버레이한다. 카카오 버튼은 Kakao Flutter SDK 앱투앱 로그인을 먼저 사용하고, Kakao ID 토큰을 `/auth/native-session`으로 전달해 Supabase 세션 쿠키를 WebView에 설정한다. Apple/Google 로그인과 카카오 ID 토큰을 받을 수 없는 환경에서는 Supabase OAuth authorize URL + `gijilai://auth/callback` 딥링크 경로를 사용한다. 웹 `AuthBridge` 경로는 fallback으로 유지한다.
- **의존**: Supabase Auth
- **사용처**: API 라우트 (세션 검증), 보호된 페이지

### 상담 시스템
- **위치**: `app/src/app/consult/page.tsx`, `app/src/app/api/consult/`, `app/src/data/consultExamples.ts`
- **역할**: AI 기반 육아 상담 — 고민 입력 → 상황 문진 → 기질 맞춤 처방전 생성. 처방전은 `consultation_sessions` 테이블에 저장. 예시 고민 데이터 제공 (`consultExamples.ts`)
- **의존**: OpenAI API, TemperamentScorer, TemperamentClassifier, 관찰 기록 (컨텍스트 주입)
- **사용처**: 상담 페이지, 상담 기록 페이지 (`/consultations`)

### 실천 시스템
- **위치**: `app/src/app/practices/page.tsx`, `app/src/components/practices/`
- **역할**: 상담 처방전의 액션 아이템을 일정 기간 반복 실천하고 기록. 매일 실천 체크 + 한줄 메모(`PracticeCheckModal`), 기간 완료 시 종합 회고(`PracticeReviewModal`)
- **의존**: Supabase (practice_items, practice_logs, practice_reviews 테이블)
- **사용처**: 실천 탭, 상담 시 LLM 컨텍스트 주입

### 관찰 기록
- **위치**: `app/src/app/observations/page.tsx`
- **역할**: 아이의 행동/상황을 자유롭게 기록. 상담 시 컨텍스트로 주입
- **의존**: Supabase (observations 테이블)
- **사용처**: 관찰 기록 페이지, 상담 컨텍스트

### 결제
- **위치**: `app/src/lib/portone.ts`, `app/src/lib/subscription.ts`, `app/src/app/api/payment/`
- **역할**: 포트원 V2 기반 결제 처리. 구독제(월/연) 전용. 빌링키 기반 정기결제, 웹훅 검증, 구독 라이프사이클 관리
- **의존**: @portone/server-sdk, Supabase (subscriptions/payments 테이블)
- **PG사**: KG 이니시스 (한국 웹 정기결제 운영), NHN KCP (한국 웹 계약 진행 중), Stripe (글로벌 웹), Apple/Google IAP (앱)
- **사용처**: 결제 페이지 (`/payment`), 요금제 페이지 (`/pricing`), 구독 관리, 리포트/상담 접근 제어

### 유틸리티
- **위치**: `app/src/lib/dateUtils.ts`, `app/src/lib/imageUtils.ts`, `app/src/lib/koreanUtils.ts`
- **역할**: 날짜 포맷/계산, 이미지 처리, 한국어 조사 처리 등 공통 유틸

## 네비게이션 구조

하단 탭 바(`BottomNav.tsx`) 5탭 구성:

| 탭 | 경로 | 아이콘 | 설명 |
|----|------|--------|------|
| 홈 | `/` | home | 가족 정원, 미션, 관찰 기록 |
| 실천 | `/practices` | checklist | 실천 아이템 체크 |
| 상담 | `/consult` | add (중앙 버튼) | AI 육아 상담 |
| 기록 | `/consultations` | folder_open | 상담 이력 |
| 내 정보 | `/settings/profile` | person | 프로필/설정 |

## 컴포넌트 디렉토리 구조

```
app/src/components/
├── auth/          AuthProvider (인증 컨텍스트)
├── home/          홈 화면 위젯 (FamilyGardenHero, DailyMissionCard, GardenRecords 등)
├── landing/       LandingPage (비로그인 랜딩)
├── layout/        BottomNav, BottomNavigation, Navbar, ReferralHandler, SurveyRestoreProvider
├── payment/       결제 관련 UI
├── practices/     PracticeCheckModal, PracticeReviewModal
├── report/        리포트 관련 UI
├── survey/        설문 관련 UI (QuestionCard, SurveyLayout)
└── ui/            공통 UI (Button, DatePicker, DarkModeToggle, Icon, ProgressBar, FeatureCard)
```

## API 라우트

| 라우트 | 메서드 | 설명 |
|--------|--------|------|
| `/api/account/delete` | POST | 계정 삭제 |
| `/api/consult/options` | POST | 상담 선택지 생성 |
| `/api/consult/questions/initial` | POST | 초기 문진 질문 |
| `/api/consult/questions/followup` | POST | 후속 문진 질문 |
| `/api/consult/prescription` | POST | 기질 맞춤 처방전 생성 |
| `/api/consult/session-context` | POST | 상담 세션 컨텍스트 |
| `/api/llm/report` | POST | AI 리포트 생성 |
| `/api/payment/billing` | POST | 빌링키 발급 |
| `/api/payment/subscribe` | POST | 구독 시작 |
| `/api/payment/subscription` | GET | 구독 상태 조회 |
| `/api/payment/cancel-subscription` | POST | 구독 취소 |
| `/api/payment/verify` | POST | 결제 검증 |
| `/api/payment/webhook` | POST | 포트원 웹훅 |
| `/api/report/shared/[id]` | GET | 공유 리포트 조회 |
| `/auth/native-session` | POST | 앱 네이티브 소셜 로그인 토큰을 Supabase 세션 쿠키로 교환 |

## 외부 의존성

### Supabase
- **용도**: 인증 (OAuth2 + 이메일/비밀번호), PostgreSQL 데이터베이스, 파일 저장소 (아바타)
- **프로토콜**: REST (@supabase/supabase-js, @supabase/ssr)
- **인증**: 클라이언트용 Anon Key, 서버용 Service Role Key

### OpenAI
- **용도**: AI 기반 내러티브 리포트 생성 (기질 분석, 양육 조언), 상담 문진/처방
- **프로토콜**: REST (openai SDK)
- **인증**: API Key (서버 전용)

### PortOne (포트원 V2)
- **용도**: 결제 통합 플랫폼 (구독 정기결제 전용)
- **프로토콜**: REST (@portone/server-sdk) + 브라우저 SDK (CDN)
- **인증**: API Secret (서버), Store ID (클라이언트)
- **PG사**: KG 이니시스 (한국 웹 정기결제 운영), NHN KCP (한국 웹 계약 진행 중), Stripe (글로벌 웹), Apple/Google IAP (앱)

### Kakao SDK
- **용도**: 소셜 로그인, 공유 기능
- **프로토콜**: 웹은 JavaScript SDK, Flutter 앱은 `kakao_flutter_sdk_user`
- **인증**: 웹 JavaScript 키, 앱 Native App Key, Supabase Auth provider 설정

### Apple Developer
- **용도**: Sign in with Apple OAuth 설정, App Store 심사 요구사항 충족
- **프로토콜**: Supabase Auth와 연결된 Apple OAuth / Sign in with Apple
- **인증**: Apple Team ID, Service ID, Key ID, private key, Supabase Auth provider 설정

### Firebase
- **용도**: 웹/모바일 분석, 푸시 알림, 크래시 수집 (`Firebase Analytics`, `FCM`, `Crashlytics`)
- **프로토콜**: 웹은 Google tag 기반 Measurement ID 연동, 모바일은 FlutterFire SDK + Android/iOS 네이티브 Firebase SDK
- **인증**: `gijilai_app/android/app/google-services.json`, `gijilai_app/ios/Runner/GoogleService-Info.plist`
- **웹 구성**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` 환경변수로 초기화, `app/src/lib/analytics.ts`와 `app/src/components/analytics/FirebaseAnalytics.tsx`에서 페이지뷰/핵심 이벤트 전송

## 데이터 흐름

```
[접수 폼] → appStore (아이 이름, 생년월일, 성별, 고민)
      ↓
[설문 페이지] → surveyStore (문항별 응답)
      ↓
[TemperamentScorer] → 원점수 {NS, HA, RD, P}
      ↓
[TemperamentClassifier] → 유형 결정 (아이 8유형, 부모 8유형)
      ↓
[OpenAI API] → AI 내러티브 리포트 (JSON)
      ↓
[Supabase DB] → 리포트 + 설문 데이터 저장
      ↓
[리포트 페이지] → 차트, 분석, 처방 표시
      ↓
[공유/PDF] → 내보내기 및 소셜 공유

[상담 페이지] → 고민 입력 + 최근 실천/관찰 기록 자동 첨부
      ↓
[OpenAI API] → 공감 + 문진 질문 → 기질 맞춤 처방전 (JSON)
      ↓
[Supabase DB] → consultation_sessions 테이블에 저장
      ↓
[실천 탭] → 액션 아이템 매일 실천 체크 + 기간 완료 시 회고
      ↓
[다음 상담] → 축적된 실천 기록이 LLM 컨텍스트로 주입 (피드백 루프)
```

## 데이터베이스 테이블

| 테이블 | 용도 |
|--------|------|
| profiles | 사용자 계정 데이터 |
| children | 아이 프로필 (프로필 이미지 포함) |
| surveys | 설문 응답 + 계산된 점수 (JSON), 상태 |
| reports | 분석 결과 (analysis_json), 결제 여부 |
| observations | 아이 행동/상황 관찰 기록 |
| consultation_sessions | 상담 이력 (고민, 문진, 처방전) |
| practice_items | 실천 액션 아이템 |
| practice_logs | 실천 일일 체크 + 메모 |
| practice_reviews | 실천 기간 완료 후 종합 회고 |
| referrals | 코드 기반 추천 시스템 |
| coupons | 할인 쿠폰 (만료일 포함) |
| subscriptions | 구독 정보 (플랜, 빌링키, 기간, 상태) |
| payments | 결제 이력 (구독/갱신, 포트원 ID) |
| subscription_usage_events | 환불 판단용 구독 유료 기능 사용 이력 |

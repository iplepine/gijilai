# 외부 서비스 인벤토리

프로젝트가 의존하는 외부 서비스와 각 서비스의 책임, 코드 접점, 운영 포인트를 한곳에 정리한 문서.
최종 동기화: 2026-04-16

## 목적

- 어떤 외부 서비스가 왜 필요한지 빠르게 파악
- 장애 발생 시 어디를 먼저 확인해야 하는지 정리
- 환경변수, 설정 파일, 관리자 콘솔 위치를 연결

## 서비스 목록

| 서비스 | 역할 | 주요 사용 영역 | 관리자 문서 |
|--------|------|----------------|-------------|
| Vercel | 웹 호스팅 / 배포 / 환경변수 | Next.js 웹 앱 배포 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| Supabase | DB / Auth / Storage | 사용자 데이터, 세션, 파일 저장 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| Firebase | 웹 분석 / 모바일 분석 / FCM / Crashlytics | 웹 퍼널 추적, 앱 푸시, 앱 크래시 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| OpenAI | AI 리포트 / AI 상담 생성 | 리포트, 상담 질문, 처방전 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| PortOne | 결제 오케스트레이션 | 웹 구독 결제, 웹훅 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| Stripe | 해외 결제 PG | 해외 구독 결제 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| NHN KCP | 국내 카드 PG | 한국 카드 결제 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| KG 이니시스 | 국내 카드 PG | 한국 카드 결제 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| Kakao Developers | 카카오 로그인 / 공유 | 소셜 로그인, 공유 SDK | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| Google Cloud Console | Google OAuth | 구글 로그인 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |
| GitHub | 소스 저장소 / 협업 | 코드 저장, 배포 연계 | [ADMIN-LINKS.md](ADMIN-LINKS.md) |

## 서비스별 상세

### Vercel

- **역할**: `app/` Next.js 웹 앱의 배포, 프리뷰, 프로덕션 호스팅, 환경변수 관리
- **코드 접점**: `app/next.config.ts`, `app/package.json`
- **운영 포인트**
- 배포 실패 시 Vercel 빌드 로그 확인
- 환경변수 누락 시 서버 API 라우트와 클라이언트 초기화가 함께 깨질 수 있음
- Cron이 필요하면 Vercel Cron 또는 외부 스케줄러를 사용

### Supabase

- **역할**: 인증, PostgreSQL DB, Storage
- **코드 접점**
- `app/src/lib/supabase.ts`
- `app/src/lib/supabaseServer.ts`
- `app/src/lib/db.ts`
- `app/src/types/supabase.ts`
- `docs/migrations/`
- **데이터 영역**
- 사용자 프로필, 자녀, 설문, 리포트, 상담, 실천, 구독/결제
- **운영 포인트**
- RLS/테이블 변경 시 `docs/migrations/`와 타입 정의 동기화 필요
- Auth 세션 문제는 OAuth provider 설정과 리다이렉트 URL을 함께 점검

### Firebase

- **역할**
- 웹 앱 퍼널 이벤트 수집
- Flutter 모바일 앱 분석
- FCM 푸시 토큰/메시징
- Crashlytics 크래시 수집
- **코드 접점**
- 웹: `app/src/lib/analytics.ts`, `app/src/components/analytics/FirebaseAnalytics.tsx`
- 모바일: `gijilai_app/lib/main.dart`, `gijilai_app/lib/firebase_options.dart`
- Android 설정: `gijilai_app/android/app/google-services.json`
- iOS 설정: `gijilai_app/ios/Runner/GoogleService-Info.plist`, `gijilai_app/ios/firebase_app_id_file.json`
- **운영 포인트**
- 웹은 `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`가 필요
- 모바일 iOS는 dSYM 업로드 스크립트가 있어야 Crashlytics 심볼이 정상 해석됨
- 이벤트 스키마 변경 시 [docs/policies/analytics.md](policies/analytics.md)도 같이 갱신

### OpenAI

- **역할**: 리포트 생성, 상담 질문 생성, 상담 처방전 생성
- **코드 접점**
- `app/src/lib/openai.ts`
- `app/src/lib/prompts.ts`
- `app/src/lib/consult-model.ts`
- `app/src/app/api/llm/report/route.ts`
- `app/src/app/api/consult/`
- **운영 포인트**
- 모델 변경 시 비용, 응답 시간, 품질 영향을 함께 검토
- 프롬프트 정책 변경 시 관련 정책 문서와 ADR 반영 여부 확인

### PortOne

- **역할**: 웹 결제 진입점, 빌링키 발급, 정기결제 흐름, 웹훅 연동
- **코드 접점**
- `app/src/lib/portone.ts`
- `app/src/lib/subscription.ts`
- `app/src/app/api/payment/`
- `docs/spec/payment-portone-v2.md`
- `docs/policies/payment.md`
- **운영 포인트**
- 결제 이슈는 PortOne 로그와 서버 `payments`/`subscriptions` 상태를 같이 봐야 함
- PG사별 이슈가 있을 수 있어 PortOne 문제와 실제 PG 문제를 분리해서 확인

### Stripe

- **역할**: PortOne을 통한 해외 결제 처리의 실제 PG
- **코드 접점**: 직접 SDK 의존은 크지 않고 PortOne 설정에 종속
- **운영 포인트**
- 해외 결제 실패는 PortOne과 Stripe 대시보드를 같이 확인

### NHN KCP

- **역할**: 한국 카드결제 PG
- **코드 접점**: PortOne 설정에 종속
- **운영 포인트**
- 국내 카드 승인/실패 원인 확인 시 PortOne과 KCP 운영 콘솔을 함께 확인

### KG 이니시스

- **역할**: 한국 카드결제 PG
- **코드 접점**: PortOne 설정에 종속
- **운영 포인트**
- 운영 MID: `MOI8434775`
- 국내 카드 승인/실패 원인 확인 시 PortOne과 KG 이니시스 운영 콘솔을 함께 확인

### Kakao Developers

- **역할**: 카카오 OAuth 및 공유 SDK 설정
- **코드 접점**
- `app/src/types/kakao.d.ts`
- `app/src/components/auth/AuthProvider.tsx`
- `app/src/app/layout.tsx`
- **운영 포인트**
- 도메인, JavaScript 키, Redirect URI 불일치가 흔한 장애 원인

### Google Cloud Console

- **역할**: Google OAuth 설정
- **코드 접점**: Supabase Auth의 Google provider 설정과 연결
- **운영 포인트**
- 승인된 리디렉션 URI와 Supabase 설정을 함께 맞춰야 함
- Supabase 커스텀 도메인을 쓰지 않으면 Google 로그인 동의/계정 선택 화면에 Supabase 프로젝트 도메인이 표시됨. 유료 커스텀 도메인 도입 전까지 Google 로그인은 보조 옵션으로 낮게 노출한다.

### GitHub

- **역할**: 소스 저장소, 배포 연계, 변경 이력 관리
- **코드 접점**: 저장소 전체
- **운영 포인트**
- 브랜치 보호, Actions, 배포 연동 여부는 저장소 설정에서 관리

## 빠른 분류

### 앱 런타임/배포

- Vercel
- GitHub

### 데이터/인증

- Supabase
- Kakao Developers
- Google Cloud Console

### 분석/모니터링

- Firebase

### AI

- OpenAI

### 결제

- PortOne
- Stripe
- NHN KCP
- KG 이니시스

## 관련 문서

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ADMIN-LINKS.md](ADMIN-LINKS.md)
- [policies/analytics.md](policies/analytics.md)
- [policies/payment.md](policies/payment.md)
- [spec/payment-portone-v2.md](spec/payment-portone-v2.md)

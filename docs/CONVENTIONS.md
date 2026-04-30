# 코드 컨벤션

프로젝트의 코드 규칙 및 패턴 정의.
최종 동기화: 2026-03-21

웹 앱의 디렉토리 책임, 의존 방향, 상태/모듈 분리 원칙은 [WEB-ARCHITECTURE.md](WEB-ARCHITECTURE.md)를 우선 참고한다. 이 문서는 코드 스타일과 구현 규칙 중심으로 유지한다.

## 클라이언트 컴포넌트
- 훅이나 브라우저 API를 사용하는 모든 페이지 컴포넌트에 `'use client'` 지시어 필수
- 서버 컴포넌트는 API 라우트에서 `createClient()`를 통한 인증 확인 용도로만 사용

## 상태 관리
- 역할이 다른 두 개의 Zustand 스토어 운영:
  - `surveyStore`: 문항 단위 상태 (currentStep, answers, surveyType)
  - `useAppStore`: 앱 전역 상태 (접수 데이터, 분석 결과, 결제 상태)
- 두 스토어 모두 `persist` 미들웨어로 localStorage 영속화
- 스토어 키: "survey-storage", "temperament-storage"
- `useAppStore`는 `partialize`로 선택적 영속화 (모든 필드가 저장되는 것은 아님)

## API 라우트
- 모든 API 라우트는 `app/src/app/api/`에 위치 (Next.js App Router 규칙)
- POST 전용 엔드포인트, JSON 요청/응답
- `createClient()` + `getSession()`으로 서버 측 세션 검증 후 처리
- 에러 응답은 `NextResponse.json()`에 적절한 상태 코드 사용
- try-catch로 감싸고 범용 에러 폴백 처리

## 스타일링
- Tailwind CSS v4, 커스텀 색상 토큰: primary, beige-main, text-main, text-sub, surface-dark, background-light/dark
- 모바일 퍼스트 반응형 (`max-w-md` 컨테이너)
- 다크 모드: 클래스 기반 `dark:` 변형
- 폰트: Lexend + Noto Sans KR (본문), Jua (강조), Material Icons (아이콘)

## 네비게이션
- 내부 전환 시 `router.replace()` 사용 (WebView 뒤로가기 호환)
- Navbar 컴포넌트: absolute positioning으로 타이틀 중앙 정렬
- BottomNav: 메인 탭 네비게이션

## 모바일 Safe Area / Edge-to-Edge
- Flutter 앱 WebView와 모바일 웹 화면은 edge-to-edge 환경을 기본 전제로 레이아웃한다.
- `Navbar` 기반 일반 세로 스크롤 화면은 공통 하단 여백 유틸리티를 사용한다. 현재 기본 패턴은 `app-page-scroll`.
- 하단 고정 버튼/CTA가 있는 입력 화면은 본문과 CTA 컨테이너를 분리해 safe area를 처리한다. 현재 기본 패턴은 `app-fixed-cta-scroll` + `app-fixed-cta`.
- 개별 화면에서 `pb-*` 값을 임의로 늘리기보다 공통 유틸리티나 CSS 변수(`--safe-area-top`, `--safe-area-bottom`)를 우선 사용한다.
- 새 화면을 만들거나 기존 화면 구조를 바꿀 때는 다음을 확인한다:
  - 마지막 카드/문단/폼 요소가 하단 시스템 제스처 영역에 붙지 않는가
  - 마지막 CTA 버튼이 홈 인디케이터/네비게이션 바와 겹치지 않는가
  - sticky/fixed UI가 있을 때 스크롤 컨테이너 쪽에도 대응 padding이 함께 들어가는가
- 공통 패턴으로 해결되지 않는 화면별 예외는 해당 페이지 코드에 이유가 드러나게 남기고, 필요하면 `docs/policies/navigation.md`에 규칙을 추가한다.

## 정원 메타포 체계
- 아동 분류 = "식물" 유형 (7가지)
- 부모 분류 = "토양" 유형
- 부모-자녀 궁합 = "하모니" 분석
- 처방에는 gardenTheme (토양 이름, 식물 이름, 색상) 포함
- 이 메타포는 UI, 프롬프트, 데이터 구조 전체에서 일관되게 적용

## 테스트
- Jest + ts-jest로 유닛 테스트
- 테스트 파일은 소스와 같은 위치에 배치: `*.test.ts`를 `*.ts` 옆에

## 타입 정의
- 커스텀 타입은 `app/src/types/` 디렉토리에 정의:
  - `index.ts`: 핵심 도메인 타입 (Child, AnalysisResult 등)
  - `survey.ts`: 설문 관련 타입 (Question, SurveyType)
  - `supabase.ts`: 데이터베이스 스키마 타입
  - `kakao.d.ts`: Kakao SDK 타입 선언
- TypeScript enum 대신 `Record<string, string>` 패턴 사용 (예: CONCERN_LABELS)

## 점수 구현
- 점수 배열은 문항 ID를 키로 하는 `Record<string, number>` 사용
- 차원별 점수는 카테고리 기반 그룹핑 (NS, HA, RD, P)
- 역채점은 문항 정의에 `reverse: true` 플래그로 처리 (인라인 로직 아님)

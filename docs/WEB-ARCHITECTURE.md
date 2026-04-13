# 웹 아키텍처

Next.js 웹 앱(`app/`)의 모듈 구조, 책임 분리, 의존 방향, 상태 관리 원칙을 정의한다.
최종 동기화: 2026-04-13

## 목적

- 페이지가 커질수록 UI, 상태, 데이터 접근, 외부 서비스 호출이 한 파일에 섞이는 것을 방지한다.
- App Router 환경에서 서버/클라이언트 경계를 명확히 한다.
- 기능 추가 시 "어디에 무엇을 둬야 하는가"를 빠르게 판단할 수 있게 한다.

## 적용 범위

- `app/src/app/`
- `app/src/components/`
- `app/src/hooks/`
- `app/src/lib/`
- `app/src/store/`
- `app/src/types/`
- `app/src/data/`

## 레이어 원칙

웹 앱은 아래 레이어를 기본으로 본다.

1. 라우트 레이어
   - 위치: `app/src/app/**`
   - 역할: URL 진입점, 화면 조립, 서버/클라이언트 경계 정의, 화면 전환
2. UI 레이어
   - 위치: `app/src/components/**`
   - 역할: 재사용 가능한 시각 컴포넌트, 뷰 조합, 입력 인터랙션
3. 상태/훅 레이어
   - 위치: `app/src/store/**`, `app/src/hooks/**`
   - 역할: 전역 상태, 클라이언트 동기화, 화면 로직 재사용
4. 도메인/인프라 레이어
   - 위치: `app/src/lib/**`, `app/src/data/**`, `app/src/types/**`, `app/src/constants/**`
   - 역할: 도메인 규칙, 외부 서비스 래핑, DB 접근, 타입, 상수

## 의존 방향

허용 방향:

- `app -> components -> hooks/store -> lib/data/types/constants`
- `app -> lib`
- `hooks/store -> lib/data/types/constants`
- `components -> lib/types/constants`

금지 방향:

- `lib`가 `app` 또는 특정 페이지 컴포넌트를 import 하는 것
- `store`가 페이지 라우트를 직접 참조하는 것
- 공통 `ui` 컴포넌트가 기능별 페이지 상태를 아는 것
- API 라우트가 클라이언트 store나 브라우저 API에 의존하는 것

## 디렉토리 책임

### `app/src/app`

- 라우트 엔트리만 둔다.
- 페이지 파일은 가능한 한 "얇게" 유지한다.
- 역할:
  - URL 파라미터 읽기
  - 인증/구독 상태에 따른 진입 분기
  - 서버 API 호출 트리거
  - feature 컴포넌트 조립
- 한 페이지 파일에 아래가 동시에 과도하게 들어가기 시작하면 분리한다.
  - 2개 이상 원격 데이터 호출
  - 3개 이상 모달/상태 머신
  - UI 블록 300줄 이상
  - 동일 타입 정의가 여러 개 필요

### `app/src/components`

- 화면 재사용 단위다.
- 하위 구조는 다음 원칙을 따른다.
  - `ui/`: 버튼, 아이콘, 카드처럼 도메인 의미가 없는 순수 UI
  - `layout/`: Navbar, BottomNav, Provider처럼 화면 골격
  - `home/`, `survey/`, `practices/` 등: 기능별 UI
- 컴포넌트는 가능하면 props 기반으로 만들고, page 전용 상태는 page에 둔다.

### `app/src/hooks`

- 여러 페이지/컴포넌트에서 반복되는 클라이언트 로직만 둔다.
- 예:
  - localStorage 복원
  - 설문 자동 동기화
  - 인증/세션 기반 초기화
- 단순히 한 페이지 내부에서만 쓰는 로직이면 먼저 페이지 내부 함수로 둔다.

### `app/src/store`

- 전역 상태만 둔다.
- 저장 기준:
  - 페이지 이동 후에도 유지되어야 함
  - 여러 화면이 동시에 참조함
  - 로컬 state로 넘기면 props drilling 비용이 큼
- 저장하지 않을 것:
  - 모달 open/close
  - 단일 페이지 임시 입력값
  - 서버에서 다시 쉽게 읽을 수 있는 일회성 상태

현재 store 역할:

- `useAppStore`
  - 접수 데이터
  - 선택된 아이
  - 일부 앱 전역 상태
- `surveyStore`
  - 설문 진행 상태
  - 문항 응답

### `app/src/lib`

- 도메인 규칙과 외부 서비스 접점을 둔다.
- 대표 역할:
  - `db.ts`: Supabase CRUD 집약
  - `openai.ts`, `portone.ts`: 외부 SDK 래핑
  - `TemperamentScorer.ts`, `TemperamentClassifier.ts`: 핵심 도메인 로직
- 규칙:
  - 페이지 UI import 금지
  - 브라우저 DOM 접근 금지
  - 가능하면 입력/출력 타입을 명시

### `app/src/data`

- 정적 데이터, 질문 집합, 예시 목록 등 "코드에 가까운 데이터"를 둔다.
- API 응답이나 사용자의 런타임 상태는 여기 두지 않는다.

### `app/src/types`

- 페이지 바깥에서 재사용되는 타입만 둔다.
- 파일 내부에서만 쓰는 타입은 해당 파일 상단에 둔다.
- 외부 시스템 타입:
  - Supabase 스키마 타입
  - Kakao SDK 타입
- 도메인 타입:
  - 설문, 리포트, 공유 데이터 등

## App Router 원칙

### 페이지와 API

- 화면 라우트: `app/src/app/**/page.tsx`
- API 라우트: `app/src/app/api/**/route.ts`

### 서버/클라이언트 경계

- 브라우저 API, Zustand, 이벤트 핸들러를 쓰면 클라이언트 컴포넌트다.
- 인증된 서버 작업, 외부 API 비밀키 접근, 결제 검증은 API 라우트에서 처리한다.
- 페이지에서 직접 비밀키 기반 로직을 호출하지 않는다.

### 라우트 파일 분리 기준

한 페이지가 아래 조건 중 2개 이상이면 feature 컴포넌트나 hook 분리를 우선 검토한다.

- API 호출이 2개 이상
- 상태 변수가 10개 이상
- JSX 블록이 3개 이상의 독립 섹션으로 나뉨
- 로컬 타입 선언이 4개 이상

## API 라우트 규칙

- 모든 API는 요청/응답 shape를 파일 상단 타입으로 정의한다.
- `unknown` 또는 구체 타입으로 파싱하고, `any`는 새 코드에서 추가하지 않는다.
- 공통 원칙:
  - 세션 확인
  - 입력 검증
  - 도메인 호출
  - `NextResponse.json()` 반환
- 외부 서비스 호출은 가능하면 `lib/` 함수 경유로 수행한다.
- API 라우트 안에서 긴 프롬프트 문자열, 복잡한 매핑, DB 후처리가 커지면 별도 `lib/` 모듈로 분리한다.

## 페이지 설계 원칙

### 페이지는 orchestration, 컴포넌트는 rendering

- 페이지:
  - 데이터 로딩
  - 분기
  - submit 핸들러
  - route transition
- 컴포넌트:
  - 표시
  - 입력 이벤트 위임
  - 단순 UI 상태

### 페이지 파일에 남겨도 되는 것

- 해당 페이지에서만 쓰는 로컬 타입
- 간단한 submit handler
- 한두 개의 `useEffect`

### 분리해야 하는 것

- 여러 페이지가 같이 쓰는 카드/섹션
- 외부 서비스 호출 로직
- JSON 파싱/정규화
- 반복되는 폼 검증

## 상태 관리 원칙

### local state

- 모달 열림 여부
- 탭 선택
- textarea 입력
- 로딩 스피너 상태

### store

- 설문 응답
- 접수 데이터
- 선택된 아이
- 페이지를 넘겨도 유지해야 하는 값

### 서버 상태

- 프로필, 아이 목록, 리포트, 구독, 상담 이력
- 가능하면 DB/API를 source of truth로 둔다.
- store에 영구 캐시하지 않고 필요 시 다시 읽는다.

## 타입 원칙

- 외부 입력은 바로 사용하지 않고 정규화한다.
- `analysis_json`, `ai_prescription` 같이 JSON 컬럼인 값은 파서 함수를 둔다.
- 페이지 파일에서 반복되는 shape는 작은 로컬 타입으로 선언한다.
- `as any` 대신:
  - 구체 타입 선언
  - `unknown` + 타입 가드
  - Supabase generated type 활용

## i18n 원칙

- 모든 사용자 노출 문자열은 `useLocale().t()`로 관리한다.
- 문서/법적 고정 문구 페이지를 제외하면 하드코딩 문구를 추가하지 않는다.
- 라벨 생성 로직이 복잡하면 먼저 번역 키를 정의하고 조합한다.

## 스타일/UI 원칙

- 모바일 우선 `max-w-md` 컨테이너를 기본으로 유지한다.
- 공통 버튼/아이콘/네비게이션은 기존 `components/ui`, `components/layout`을 우선 사용한다.
- 같은 의미의 카드/섹션이 반복되면 공통 컴포넌트로 뺀다.
- `<img>`는 새 코드에서 기본적으로 `next/image`를 우선 검토한다.

## 파일 배치 기준

### 새 기능 추가 시

1. 페이지 진입점 생성: `app/src/app/...`
2. 공통 표시 블록이 있으면 `components/<feature>/`
3. 외부 서비스/DB 호출은 `lib/`
4. 전역 유지 상태가 필요하면 `store/`
5. 정적 질문/옵션 데이터면 `data/`
6. 재사용 타입이면 `types/`, 아니면 파일 내부 타입

### 기존 기능 확장 시

- 먼저 같은 도메인의 기존 디렉토리를 재사용한다.
- 새 폴더를 만드는 기준은 "책임이 독립적이고 재사용될 때"다.
- 단순 파일 수 증가만으로 feature 폴더를 쪼개지 않는다.

## 현재 구조에서의 권장 리팩터링 방향

- `app/src/app/page.tsx`
  - 홈 전용 데이터 정규화와 카드 섹션 분리 여지가 큼
- `app/src/app/practices/page.tsx`
  - 데이터 로딩/그룹핑/렌더링 분리 여지 있음
- `app/src/app/report/page.tsx`
  - 탭별 섹션과 분석 파서 분리 후보
- `app/src/app/settings/**`
  - 프로필/아이 수정 폼 공통 입력 로직 정리 여지 있음

## 문서 관계

- 시스템 전체 구조: [ARCHITECTURE.md](ARCHITECTURE.md)
- 코드 규칙: [CONVENTIONS.md](CONVENTIONS.md)
- 비즈니스 정책: [policies/index.md](policies/index.md)
- 결정 이력: [ADR.md](ADR.md)

# 네비게이션 및 UI 정책

## 하단 네비게이션 (BottomNav)

5개 탭 구성:

| 순서 | 라벨 | 경로 | 아이콘 | 비고 |
|------|------|------|--------|------|
| 1 | 홈 | `/` | home | |
| 2 | 실천 | `/practices` | checklist | |
| 3 | 상담 | `/consult` | add / chat_bubble | 중앙 플로팅 버튼, active 시 아이콘 변경 |
| 4 | 기록 | `/consultations` | folder_open | |
| 5 | 내 정보 | `/settings/profile` | person | |

- 중앙 상담 버튼은 다른 탭보다 위로 올라온 플로팅 원형 버튼
- BottomNav는 `fixed bottom-0`, backdrop-blur 적용, 최대 폭 `max-w-md`

## 라우트 구조

```
/                           # 홈
/login                      # 로그인
/intake                     # 접수 폼
/survey/                    # 설문 메인
  intro/                    # 설문 안내 (quick/full 시작 선택)
  child/                    # 아이 기질 설문
  parent/                   # 양육자 기질 설문
  parenting-style/          # 양육 스타일 설문
/report                     # 리포트 (`child_only=true` quick-start 모드 지원)
/consult                    # 마음 통역소 (AI 상담)
/consultations/             # 상담 기록 목록
  [id]/                     # 상담 기록 상세
/practices                  # 실천 목록
/observations               # 관찰 기록
/share                      # 공유
/shared/[id]                # 공유된 리포트 보기
/pricing                    # 요금제
/payment/                   # 결제
  success/                  # 결제 완료
/settings/
  profile/                  # 내 정보
    edit/                   # 프로필 수정
  child/
    new/                    # 아이 등록
    [id]/                   # 아이 정보 수정
  notifications/            # 알림 설정
  subscription/             # 구독 관리
/legal/
  about/                    # 서비스 소개
  privacy/                  # 개인정보처리방침
  terms/                    # 이용약관
  refund/                   # 환불 정책
  support/                  # 고객지원
/auth/auth-code-error       # 인증 오류
/test/llm-connection        # LLM 연결 테스트 (개발용)
```

## 네비게이션 규칙

- 내부 페이지 전환 시 `router.replace()` 사용 (`router.push()` 대신, WebView 뒤로가기 스택 이슈 방지)
- 헤더/상단바의 기질아이 로고는 모든 위치에서 홈(`/`)으로 이동한다. 로고 홈 이동은 WebView 뒤로가기 스택을 늘리지 않도록 `router.replace('/')`를 사용하고, 접근성 라벨은 `홈으로 이동`으로 둔다.
- 상담 입력/문진이 진행 중인 상태에서 로고로 홈 이동을 시도하면 현재 입력 내용이 사라질 수 있음을 확인한 뒤 이동한다. 결과 생성·저장 후에는 별도 확인 없이 홈 이동을 허용한다.
- 설문 안내 화면은 `3분으로 아이 기질 검사`와 `처음부터 전체 분석 시작하기` 두 경로를 명시적으로 제공한다.
- `flow=quick` 설문은 아이 설문 완료 후 `/report?child_only=true`로 이동한다.
- `flow=full` 설문은 아이 설문 후 즉시 양육자/양육 스타일 설문으로 이어진다.
- 리포트의 다시 분석 플로우에서 진입한 설문은 `refresh=child` 또는 `refresh=all` 값을 유지해, 설문 완료 후 `/report`가 이전 캐시 대신 새 응답 기준 리포트를 생성한다.
- 모든 헤더는 absolute positioning으로 타이틀 중앙 정렬
- 노치/상태표시줄 대응을 위한 상단 여백 통일 (pt-12, pb-4)
- Flutter 앱 WebView의 루트(`/`) 진입 시 로그인 세션이 없으면 웹 랜딩 화면을 먼저 보여준다. 로그인 세션이 있으면 홈을 그대로 렌더링한다.
- 앱 로그인은 랜딩 CTA 이후 `/login`에서 네이티브 로그인 화면 오버레이로 시작한다.
- 앱 설치 유도 화면(`/install-app`)과 앱 설치/다운로드 CTA는 웹 브라우저 전용이다. 네이티브 앱 WebView에서는 렌더링하지 않고, `/install-app`이 앱 안에서 열리면 `from` 값에 따라 `/pricing`, `/payment`, 또는 홈으로 되돌린다.
- PC 웹의 `/install-app`은 OS를 직접 선택하게 하는 화면이 아니라 QR 코드와 설치 링크 복사로 휴대폰에서 이어가게 한다. 모바일 웹의 `/install-app`은 `gijilai://open?path=...` 딥링크를 먼저 시도하고, 앱이 열리지 않으면 iOS는 App Store, Android는 Google Play로 이동한다.
- Flutter 앱은 `gijilai://open` 딥링크를 받으면 WebView를 전달된 내부 path로 이동한다. 인증 콜백(`gijilai://auth/callback`)은 기존처럼 `/auth/callback`으로만 소비한다.
- 노치/상태표시줄/시스템 제스처 영역 대응은 웹 CSS `env(safe-area-inset-*)`와 Flutter WebView가 주입하는 `--native-safe-area-top/bottom`을 함께 사용한다.
- Android edge-to-edge WebView에서 native bottom inset이 `0px`로 보고되는 3-button navigation 환경이 있으므로, 하단 탭/고정 CTA는 Android 전용 fallback bottom inset을 함께 적용해 OS 내비게이션 버튼과 겹치지 않게 한다.
- Flutter 앱은 WebView 문서마다 `window.__nativeCapabilities`를 주입해 현재 앱이 네이티브로 지원하는 화면 집합(`supportedScreens`)과 네이티브 토큰 교환을 시도할 수 있는 로그인 수단(`nativeAuthProviders`)을 명시한다.
- 웹은 `isAppWebView()` 같은 단순 앱 여부만으로 네이티브 분기를 결정하지 않고, `window.__nativeCapabilities.supportedScreens`와 provider별 `nativeAuthProviders`를 우선 확인한다.
- `window.__nativeAppInfo.version/buildNumber`는 장애 우회, 분석, 강제 업데이트 안내에만 사용하고, 기능 분기의 기본 기준은 capability로 둔다.
- 강제 업데이트는 `/api/app-version`의 `minSupportedBuild` 정책으로 판단한다. 새 Flutter 앱은 WebView 로드 전에 차단하고, 기존 앱은 웹 전역 업데이트 오버레이가 `window.__nativeAppInfo.buildNumber`를 기준으로 차단한다.
- Flutter 앱은 Next.js client-side route 변경(`pushState`/`replaceState`/`popstate`)도 `RouteBridge`로 감지해 `/login` 같은 네이티브 인터셉트 대상 화면을 full page load와 동일하게 처리한다.
- 로그인 외 네이티브 전환 후보 화면(`/payment`, `/settings/subscription`, `/settings/notifications`, `/settings/profile`)은 capability가 없는 앱 버전과 모바일 웹에서 기존 웹 라우트를 fallback으로 유지한다.
- `Navbar` 기반 일반 스크롤 화면은 `app-page-scroll`로 하단 safe area + 여유 패딩을 공통 적용한다.
- 하단 탭바는 edge-to-edge 배경을 유지하되 탭 아이콘/라벨/중앙 버튼의 실제 터치 영역은 native bottom inset을 반영한 `app-bottom-nav` padding 위에 둔다.
- 하단 고정 CTA가 있는 화면은 본문에 `app-fixed-cta-scroll`, 하단 컨테이너에 `app-fixed-cta`를 사용해 마지막 입력 필드와 버튼이 시스템 내비게이션 영역에 가려지지 않게 한다. 입력 포커스 중 모바일 키보드가 올라오면 `visualViewport`로 계산한 `--keyboard-inset-bottom`을 함께 반영해 CTA가 키보드 위에 자연스럽게 붙도록 한다.
- 하단 고정 CTA 높이가 일반 CTA보다 큰 화면은 `app-large-fixed-cta-scroll`처럼 CTA 실측 높이에 맞춘 공통 변형을 사용한다.
- 바텀시트/모달은 페이지 스크롤 유틸리티의 보호를 받지 않으므로 오버레이에 `app-modal-overlay`, 패널에 `app-modal-panel` 또는 `app-modal-panel-scroll`을 사용한다.
- 화면 하단에 붙는 작성 바텀시트는 `app-bottom-sheet-panel`, `app-bottom-sheet-scroll`, `app-bottom-sheet-actions`를 함께 사용해 저장 버튼과 마지막 입력 필드가 시스템 내비게이션 영역에 가려지지 않게 한다.
- Android 앱에서 WebView 현재 URL이 홈(`/`)이면 백키 1회 입력 시 "한번 더 누르면 종료됩니다" 안내를 띄우고, 3초 안에 한 번 더 누르면 앱을 종료한다.
- 홈이 아닌 URL에서는 앱 종료보다 WebView 뒤로가기를 우선한다.
- Android 런처 아이콘은 adaptive icon(`mipmap-anydpi-v26/ic_launcher.xml`)으로 제공하고, 배경색과 전경 이미지를 분리해 런처 마스크 안에서 작게 축소되지 않도록 한다.
- Flutter 앱 WebView에서 웹 JavaScript `alert`, `confirm`, `prompt`가 호출되면 플랫폼 기본 시스템 다이얼로그 대신 앱 테마의 Flutter 다이얼로그로 표시한다.
- Flutter 앱 WebView는 `HapticBridge`를 통해 웹 공통 CTA/내비게이션 탭에 가벼운 네이티브 햅틱을 연결한다. 웹은 bridge/capability가 확인된 경우에만 요청하고, 네이티브 로그인/다이얼로그 버튼도 같은 강도의 탭 피드백을 사용한다.
- 알림 설정의 리마인더 시간 선택은 브라우저/WebView 기본 `input type="time"` picker를 쓰지 않고, 웹 커스텀 모달로 표시해 앱/웹에서 동일한 시각 언어를 유지한다.
- Flutter 앱 WebView가 `/login`에 도달하면 WebView 위에 네이티브 로그인 화면을 오버레이한다.
- Next.js 클라이언트 라우팅으로 `/login`에 도달하는 경우도 `RouteBridge`가 `history.pushState/replaceState/popstate`를 감지해 네이티브 로그인 오버레이 상태를 동기화한다.
- 네이티브 로그인 화면과 이메일 로그인 화면은 로그인 전에도 `기질아이 알아보기`, `개인정보처리방침`, `이용약관` 링크를 제공한다. 링크를 누르면 WebView의 `/legal/about`, `/legal/privacy`, `/legal/terms` 공개 페이지를 앱 안에서 열고, 뒤로 가면 로그인 흐름으로 돌아온다.
- 네이티브 로그인 화면은 iOS에서 카카오톡, Apple, Google, 이메일 진입점을 제공하고 Android에서 카카오톡, Google, 이메일 진입점을 제공한다. 사용자가 보는 로그인/회원가입 화면은 Flutter 네이티브 화면이어야 하며, 웹 `/login` 폼을 직접 노출하지 않는다.
- 카카오 버튼은 iOS에서 Kakao Flutter SDK 앱투앱 로그인을 먼저 시도하고, 카카오톡이 설치되어 있지 않거나 앱투앱 로그인을 완료할 수 없으면 Kakao SDK의 카카오계정 로그인으로 전환한다. Kakao ID 토큰을 받으면 `/auth/native-session`으로 전달해 Supabase 세션 쿠키를 WebView에 설정한다. Android는 Play 서명/키 해시 불일치나 Kakao SDK Activity 설정 예외가 앱 크래시로 이어지지 않도록 Supabase Kakao OAuth URL을 Android Custom Tab으로 열고 `gijilai://auth/callback` 딥링크로 복귀한다.
- Apple은 iOS에서 `sign_in_with_apple` 네이티브 SDK를 우선 사용해 ID 토큰(+ nonce)을 받고 `/auth/native-session`으로 세션을 교환한다. Android는 Apple 네이티브 SDK가 없으므로 Supabase Apple OAuth URL을 Android Custom Tab으로 열고 `gijilai://auth/callback` 딥링크로 앱에 복귀한다.
- Google은 iOS에서 `google_sign_in` 네이티브 SDK를 우선 사용해 ID 토큰을 받고 `/auth/native-session`으로 세션을 교환한다. Android는 Play Services SignIn Activity 설정/서명 예외가 앱 크래시로 이어지지 않도록 Supabase Google OAuth URL을 Android Custom Tab으로 열고 `gijilai://auth/callback` 딥링크로 앱에 복귀한다.
- 이메일 로그인/회원가입은 Flutter 네이티브 폼에서 입력을 받고 WebView 내부의 `/auth/native-email` API를 호출해 Supabase 세션 쿠키만 설정한다.
- `GOOGLE_WEB_CLIENT_ID` dart define은 Google 네이티브 로그인에서 ID token audience를 Supabase Google provider와 맞추는 값이다. 현재 앱은 이 값이 있을 때 Google 로그인 진입점을 노출하고, iOS에서만 이 값을 `serverClientId`로 주입해 네이티브 토큰 교환 capability를 광고한다.
- Android와 iOS에서는 Supabase OAuth authorize URL, Google/Apple/Kakao OAuth 도메인, WebView `AuthBridge` OAuth URL을 기본적으로 외부 브라우저나 인앱 브라우저로 열지 않는다. WebView에서 소셜 OAuth URL이 발생하면 지원 가능한 네이티브 SDK 로그인으로 다시 라우팅하고, 네이티브 경로가 없으면 앱 안에서 실패를 안내한다. 단, Android의 Kakao/Apple/Google 로그인은 SDK/서명 설정 예외가 앱 크래시로 이어지는 것을 피하기 위해 Android Custom Tab handoff를 허용한다.
- 앱 WebView의 웹 `/login` 화면은 네이티브 로그인 오버레이 뒤에서만 존재한다. 웹 소셜 로그인 버튼은 숨기고, 이메일 폼도 사용자가 보는 주 로그인 화면으로 쓰지 않는다.
- iOS에서 OAuth 후 앱이 콜드 스타트되는 경우를 위해 `AppDelegate`는 `launchOptions`의 초기 URL을 `app_links`로 직접 브리지한다.
- iOS `Info.plist`의 `FlutterDeepLinkingEnabled`는 `false`로 유지해 Flutter 기본 딥링크 처리와 `app_links`가 같은 커스텀 스킴을 중복 처리하지 않게 한다.
- 기존 웹 `/login`의 `AuthBridge` 경로는 브라우저 fallback이 아니라 네이티브 로그인 재라우팅 안전장치로 유지한다.
- 외부 OAuth 앱에서 사용자가 로그인하지 않고 앱으로 돌아와 딥링크 콜백이 없는 경우, 앱은 로그인 취소로 간주하고 네이티브 로그인 로딩 상태를 해제해 재시도할 수 있게 한다.
- Apple/Google/Kakao OAuth 도메인으로 WebView가 직접 이동하려는 경우 앱/브라우저로 강제 전환하지 않고 네이티브 로그인 경로로 재라우팅하거나 차단한다. Android Kakao/Apple/Google OAuth는 예외적으로 Custom Tab handoff를 허용한다.
- Supabase Auth Redirect URL allow list에는 `gijilai://auth/callback`을 반드시 포함한다.
- Apple OAuth는 `name email` scope를 요청해 최초 가입 시 이름/이메일을 수신할 수 있게 한다.
- OAuth 콜백 서버 라우트는 localhost 계열 host 헤더를 신뢰하지 않고 `NEXT_PUBLIC_APP_URL` 또는 `https://gijilai.com`으로 복귀시켜 앱 로그인 후 localhost로 이동하지 않게 한다.

## 접수 폼

- 양육 고민 최대 3개 선택 가능
- 고민 카테고리 5종: 수면, 식사, 떼쓰기, 사회성, 학습
- 개인정보 처리방침 동의 + 면책 동의 필수
- 아이 나이(개월)는 생년월일에서 자동 계산

## 이미지 업로드

- 아이 프로필 이미지는 업로드 전 800x800px로 리사이즈
- JPEG 압축 품질: 0.8
- 저장 버킷: /avatars (Supabase Storage)

## 다자녀 지원

- 7일 체험 중이거나 구독 중인 계정은 여러 명의 아이 등록 가능
- 무료 플랜은 1명 영구 슬롯만 제공한다. 아이를 삭제해도 무료 슬롯은 초기화되지 않으며, 마지막 아이 삭제도 막아 새 아이로 기질검사를 반복하는 우회를 방지한다.
- 각 아이별 독립적인 설문 이력 및 리포트 관리
- 모든 검사 결과는 수동 삭제 전까지 보존
- **아이 선택**: Zustand `selectedChildId`로 전역 관리, localStorage에 persist되어 새로고침/페이지 이동 시에도 유지
- **홈 아이 전환**: 이름 옆 드롭다운 (아이 2명 이상일 때만 표시)
- **양육자 기질**: 아이 선택과 무관하게 하나만 존재, 독립적으로 표시
- **아이별 데이터**: 마법의 한마디, 상담 기록은 선택된 아이 기준으로 필터링
- **마음 통역소**: 선택된 아이 이름으로 상담 진행, 상담 저장 시 `selectedChildId` 사용

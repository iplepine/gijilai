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
  intro/                    # 설문 안내
  child/                    # 아이 기질 설문
  parent/                   # 양육자 기질 설문
  parenting-style/          # 양육 스타일 설문
/report                     # 리포트
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
- 모든 헤더는 absolute positioning으로 타이틀 중앙 정렬
- 노치/상태표시줄 대응을 위한 상단 여백 통일 (pt-12, pb-4)
- Flutter 앱 WebView의 루트(`/`) 진입 시 로그인 세션이 없으면 소개 화면을 보여주지 않고 `/login`으로 이동한다. 로그인 세션이 있으면 홈을 그대로 렌더링한다.
- Android 앱에서 WebView 현재 URL이 홈(`/`)이면 백키 1회 입력 시 "한번 더 누르면 종료됩니다" 안내를 띄우고, 3초 안에 한 번 더 누르면 앱을 종료한다.
- 홈이 아닌 URL에서는 앱 종료보다 WebView 뒤로가기를 우선한다.
- Android 런처 아이콘은 adaptive icon(`mipmap-anydpi-v26/ic_launcher.xml`)으로 제공하고, 배경색과 전경 이미지를 분리해 런처 마스크 안에서 작게 축소되지 않도록 한다.
- Flutter 앱 WebView에서 웹 JavaScript `alert`, `confirm`, `prompt`가 호출되면 플랫폼 기본 시스템 다이얼로그 대신 앱 테마의 Flutter 다이얼로그로 표시한다.
- Flutter 앱 WebView가 `/login`에 도달하면 WebView 위에 네이티브 로그인 화면을 오버레이한다.
- 네이티브 로그인 화면은 카카오, Apple, Google, 이메일 진입점을 제공한다.
- 카카오 버튼은 Kakao Flutter SDK 앱투앱 로그인을 먼저 시도하고, Kakao ID 토큰을 `/auth/native-session`으로 전달해 Supabase 세션 쿠키를 WebView에 설정한다.
- Apple/Google 로그인과 Kakao ID 토큰을 받을 수 없는 환경에서는 앱이 WebView의 `AuthProvider` OAuth 훅을 우선 호출해 Supabase auth-js가 PKCE 및 `gijilai://auth/callback` 리다이렉트를 생성하게 한다. 훅을 사용할 수 없는 경우에만 Supabase OAuth authorize URL을 외부 앱/브라우저로 직접 열고, 딥링크를 받아 WebView의 `/auth/callback`으로 다시 로드한다.
- iOS에서 OAuth 후 앱이 콜드 스타트되는 경우를 위해 `AppDelegate`는 `launchOptions`의 초기 URL을 `app_links`로 직접 브리지한다.
- iOS `Info.plist`의 `FlutterDeepLinkingEnabled`는 `false`로 유지해 Flutter 기본 딥링크 처리와 `app_links`가 같은 커스텀 스킴을 중복 처리하지 않게 한다.
- 기존 웹 `/login`의 `AuthBridge` 경로는 fallback으로 유지한다.
- 외부 OAuth 앱/브라우저에서 사용자가 로그인하지 않고 앱으로 돌아와 딥링크 콜백이 없는 경우, 앱은 로그인 취소로 간주하고 네이티브/웹 로그인 로딩 상태를 해제해 재시도할 수 있게 한다.
- Apple/Google/Kakao OAuth 도메인으로 WebView가 직접 이동하려는 경우도 `disallowed_useragent` 방지를 위해 외부 앱/브라우저로 강제 전환한다.
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

- 한 계정에 여러 명의 아이 등록 가능
- 각 아이별 독립적인 설문 이력 및 리포트 관리
- 모든 검사 결과는 수동 삭제 전까지 보존
- **아이 선택**: Zustand `selectedChildId`로 전역 관리, localStorage에 persist되어 새로고침/페이지 이동 시에도 유지
- **홈 아이 전환**: 이름 옆 드롭다운 (아이 2명 이상일 때만 표시)
- **양육자 기질**: 아이 선택과 무관하게 하나만 존재, 독립적으로 표시
- **아이별 데이터**: 마법의 한마디, 상담 기록은 선택된 아이 기준으로 필터링
- **마음 통역소**: 선택된 아이 이름으로 상담 진행, 상담 저장 시 `selectedChildId` 사용

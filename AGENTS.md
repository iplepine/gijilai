# 프로젝트 문서

모든 프로젝트 문서는 [docs/README.md](docs/README.md)를 먼저 참고하세요.

# 공통 개발 워크플로우

모든 AI/Codex 개발 작업은 중앙 워크플로우를 따릅니다.

- 원본: `/Users/basil/Projects/project-manager/PROJECT_WORKFLOW.md`
- 이 repo의 예외/실행 명령: [docs/operations/DEVELOPMENT_WORKFLOW.md](docs/operations/DEVELOPMENT_WORKFLOW.md)

기본 순서:

1. `docs/README.md`와 관련 제품/운영/결정 문서를 확인합니다.
2. 기능, UX, 데이터, 결제, 개인정보, 제품 범위가 바뀌면 스펙을 정리하고 사용자 확인을 받습니다.
3. 승인된 범위만 thin slice 단위로 구현합니다.
4. 각 slice마다 즉시 검증하고 테스트를 추가/수정합니다.
5. 통합 테스트, 정적 분석, 빌드 또는 smoke 검증을 실행합니다.
6. 관련 문서를 갱신합니다.
7. 사용자 요청과 현재 세션의 상위 지시에 따라 커밋하고, 원격이 있으면 푸시합니다.

중요한 제품/기술 결정은 `docs/decisions/DECISIONS.md` 또는 관련 ADR 문서에 남깁니다.

# 모바일 레이아웃 체크리스트

Flutter WebView 앱 화면이나 모바일 웹 화면을 추가/수정할 때는 아래를 기본 점검 항목으로 본다.

1. **Edge-to-edge 전제 확인** → Android/iOS 시스템 바 영역까지 화면이 확장된다는 전제로 레이아웃을 본다.
2. **상단 safe area** → `Navbar` 또는 상단 고정 UI가 상태바/노치와 겹치지 않는지 확인한다.
3. **하단 safe area** → 스크롤 마지막 콘텐츠, 버튼, 입력창, FAQ 마지막 항목이 홈 인디케이터/제스처 바에 붙거나 가려지지 않는지 확인한다.
4. **패턴 재사용** → 일반 스크롤 화면은 공통 safe-area 유틸리티(`app-page-scroll`), 하단 고정 CTA 화면은 전용 패턴(`app-fixed-cta-scroll`, `app-fixed-cta`)을 우선 사용한다.
5. **개별 화면 예외 기록** → 공통 유틸리티로 부족해 화면별 추가 inset/padding이 필요하면 이유를 코드나 정책 문서에 남긴다.
6. **정책 문서 동기화** → safe area 규칙이나 공통 레이아웃 패턴을 바꾸면 `docs/product/policies/navigation.md`와 관련 문서를 같이 갱신한다.

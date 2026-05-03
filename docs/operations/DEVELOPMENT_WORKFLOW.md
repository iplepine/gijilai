# Development Workflow

이 repo의 개발 작업은 project-manager의 공통 워크플로우를 따른다.

공통 원본:

`/Users/basil/Projects/project-manager/PROJECT_WORKFLOW.md`

## 시작 전 확인

- `docs/README.md`
- `docs/product/PRODUCT_BRIEF.md`
- `docs/product/USE_CASES.md`
- `docs/product/FEATURE_MAP.md`
- `docs/product/REPORT_PRODUCT_SPEC.md`
- `docs/product/TRUST_AND_EVIDENCE.md`
- `docs/go-to-market/REVENUE_MODEL.md`
- `docs/go-to-market/FUNNEL_METRICS.md`
- `docs/operations/RELEASE_READINESS.md`
- `docs/decisions/DECISIONS.md`

## repo별 주의점

- 웹, Flutter WebView 앱, 결제, 리포트, 모바일 배포가 함께 있으므로 배포 대상부터 식별한다.
- 결제, 구독, 리포트 신뢰, 개인정보, 점수/해석 로직 변경은 사용자 확인 후 진행한다.
- 모바일 웹 또는 WebView UI 변경은 safe area와 모바일 레이아웃을 확인한다.
- 정책 변경은 `docs/product/policies/`와 함께 갱신한다.
- 배포 요청은 `PROJECT_WORKFLOW.md`의 `배포 명령 처리` 규칙을 따른다.

## 검증 기록

작업 후 최종 보고에 아래를 남긴다.

- 확인한 문서
- 실행한 테스트/빌드 명령
- 수동 확인한 핵심 시나리오
- 갱신한 문서
- 커밋/푸시 여부

<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# 기질아이 문서 홈

이 폴더는 기질아이 제품, 수익화, 운영, 의사결정 문서를 모아 관리한다.
새 문서와 기존 문서는 아래 표준 구조에 맞춰 둔다.

## 표준 구조

| 폴더 | 역할 |
|------|------|
| `product/` | 제품 정의, 유즈케이스, 기능 맵, 리포트/신뢰 원칙 |
| `go-to-market/` | 수익 모델, 퍼널 지표, 성장 가설 |
| `operations/` | 출시 준비, 아키텍처, 배포, 마이그레이션, 외부 서비스 |
| `decisions/` | 주요 의사결정과 보류 사항 |
| `work/` | 현재 goal, roadmap, active task |
| `archive/` | 더 이상 표준 문서가 아니지만 보존할 자료 |

## 주요 문서

- `product/ONE_PAGER.md`: 컨셉·목표·현재 기능 한 장 요약
- `product/PRODUCT_BRIEF.md`: 제품 한 장 요약
- `product/USE_CASES.md`: 표준 유즈케이스 요약
- `product/FEATURE_MAP.md`: 기능 영역별 현재 역할
- `product/REPORT_PRODUCT_SPEC.md`: 리포트 제품 스펙
- `product/TRUST_AND_EVIDENCE.md`: 신뢰, 근거, 면책 원칙
- `go-to-market/REVENUE_MODEL.md`: 구독 중심 수익 모델
- `go-to-market/FUNNEL_METRICS.md`: 핵심 퍼널과 측정 기준
- `operations/RELEASE_READINESS.md`: 출시 전 확인 항목
- `decisions/DECISIONS.md`: 결정 사항과 열린 질문
- `work/README.md`: 현재 목표, 로드맵, 작업 티켓
- `work/TODO.md`: 현재 TODO, 운영 후속, 최근 완료 항목

## 기존 문서 정리 위치

- 기존 루트 유즈케이스와 인덱스는 `archive/`에 보존한다.
- 기존 `plan/` 문서는 `product/` 또는 `go-to-market/`으로 나눴다.
- 기존 `policies/` 문서는 `product/policies/`로 옮겼다.
- 기존 `deployment/`, `migrations/`, `spec/` 문서는 `operations/` 아래로 옮겼다.
- 기존 아키텍처, 컨벤션, 외부 서비스 문서는 `operations/` 아래로 옮겼다.

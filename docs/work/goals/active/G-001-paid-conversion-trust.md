# Goal

ID: `G-001-paid-conversion-trust`

상태: `Active`

마지막 갱신일: 2026-05-04

## 목표

무료 진단 사용자가 리포트와 상담 품질을 신뢰하고 유료 구독 전환을 검토할 수 있게 만든다.

## 이유

`gijilai`의 매출 경로는 리포트 단발 판매보다 `리포트 -> 상담 -> 실천 기록 -> 후속 상담`의 반복 구독 루프에 있다. 지금은 기능 확장보다 상담 입력 품질, 리포트 CTA, 신뢰 근거가 우선이다.

## 성공 기준

| 지표 | 목표 | 현재 | 근거 수준 |
|---|---:|---:|---|
| `report_viewed -> pricing_viewed` | 측정 가능 | 미확정 | `Assumption` |
| `pricing_viewed -> payment_started` | 측정 가능 | 미확정 | `Assumption` |
| 상담 입력 검증 실패가 자연스럽게 안내됨 | 100% | 완료 | `Signal` |
| 리포트/가격/결제 이벤트 기준 | 문서와 코드 일치 | 완료 | `Signal` |

## 범위

포함:

- 상담 입력 검증
- 리포트/상담 CTA와 신뢰 문구 정리
- 정책/문서 정합성 갱신

제외:

- 신규 대형 기능
- 단품 리포트 기본 상품화
- 앱 네이티브 리빌드

## 연결 문서

- 제품: `docs/product/REPORT_PRODUCT_SPEC.md`, `docs/product/TRUST_AND_EVIDENCE.md`
- 시장: `docs/go-to-market/REVENUE_MODEL.md`, `docs/go-to-market/FUNNEL_METRICS.md`
- 결정: `docs/decisions/DECISIONS.md`

## 연결 Roadmap

- `R-001-consult-report-conversion`

## 리스크

- 상담 결과가 일반론처럼 느껴지면 결제 전환이 약해진다.
- 양육 조언 표현이 과하거나 근거가 약하면 신뢰가 훼손된다.

## 다음 판단

판단할 것: 배포 환경에서 리포트 CTA, 가격 페이지 진입, 결제 시작 이벤트가 실제 수집되는가?

판단일: 2026-05-10

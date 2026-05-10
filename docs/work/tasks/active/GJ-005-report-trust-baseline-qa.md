# Task

ID: `GJ-005-report-trust-baseline-qa`

유형: `Verify`

상태: `Active`

연결 Roadmap: `R-001-consult-report-conversion`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-10

## 목표

리포트/가격/결제 전환 기준선 수집을 시작하기 전에 현재 변경분이 신뢰 문구, 로딩 상태, 한국어/영어 문구, 전환 이벤트 기준과 충돌하지 않는지 검증한다.

## 배경

현재 roadmap은 90% 완료 상태이며 남은 병목은 배포 환경 이벤트 확인과 첫 주 기준선 수집이다. 코드에는 리포트 화면, 기질 로딩 상태, i18n 문구 변경이 남아 있으므로 새 기능을 더하기 전에 전환 검증 가능한 상태로 닫아야 한다.

## 범위

포함:

- 리포트 화면 CTA와 가격 페이지 진입 흐름 확인
- 기질 로딩 상태와 한국어/영어 문구 확인
- Firebase DebugView 또는 동등한 이벤트 수집 확인
- 관련 문서의 전환 이벤트 기준 갱신
- 이벤트 샘플에 개인식별 가능 정보가 포함되지 않는지 확인

제외:

- 신규 유입 실험 구현
- 가격/상품 구조 변경
- 결제 API 구조 변경

## 완료 기준

- [ ] 리포트에서 가격 페이지로 이동하는 주요 CTA가 깨지지 않음
- [ ] `report_viewed`, `pricing_viewed`, `payment_started` 기준이 문서와 코드에서 충돌하지 않음
- [ ] 한국어/영어 리포트 문구와 로딩 상태가 신뢰 원칙을 해치지 않음
- [ ] 이벤트 샘플에 아이 이름, 상담 원문, 메모 원문이 포함되지 않음
- [ ] 테스트 또는 검증 완료
- [ ] 관련 문서 업데이트
- [ ] 남은 리스크 기록

## 작업 계획

1. 현재 변경된 리포트/로딩/i18n 파일을 전환 roadmap 기준으로 대조한다.
2. 웹 테스트, lint, build를 실행하고 실패 시 이 task 안에서 수정한다.
3. 배포 환경 이벤트 수집 가능 여부를 확인하고 첫 주 기준선 기록 위치를 정한다.

## 검증 계획

명령:

- `cd app && npm test -- --runInBand`
- `cd app && npm run lint`
- `cd app && npm run build`

수동 확인:

- 리포트 조회
- 가격 페이지 진입
- 결제 시작 직전 이벤트 확인
- 모바일 WebView에서 리포트 로딩 상태 확인

## 문서 업데이트 대상

- `docs/go-to-market/FUNNEL_METRICS.md`
- `docs/go-to-market/REPORT_CONVERSION_ANALYTICS_CYCLE.md`
- `docs/product/policies/report.md`
- `docs/work/roadmaps/active/R-001-consult-report-conversion.md`

## 사용자 확인

필요 여부: `no`

확인할 질문:

결정: 현재 유료 전환 검증 roadmap 안에서 진행한다.

## 결과

완료 내용:

- 전환 이벤트 기준 문서와 가격 진입 source 정리는 이전 작업에서 반영됐다.

검증 결과:

- 배포 환경 DebugView 확인은 아직 남아 있다.

남은 리스크:

- 실제 운영 이벤트 수집 여부와 첫 주 기준선은 코드 검증만으로 확인할 수 없다.

후속 task:

- 첫 주 기준선 수치 기록

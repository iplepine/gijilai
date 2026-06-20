<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `42ed4d5e3c01012a9599c8ac423810d3beb99831` (`claude/enable-phased-assessment`)
> - 최근 커밋: `42ed4d5e3c01` 차수화 신뢰도 캘리브레이션 인프라 + 미캘리 신뢰도 노출 게이트
> - 커밋 일시: `2026-06-17T08:17:20+09:00`
> - 워킹트리: `dirty (72 files)`
> - 문서 갱신: `2026-06-20 22:33:14 +0900`
<!-- COMMIT_STATUS END -->

# Task

ID: `GJ-003-conversion-measurement-readiness`

유형: `Build`

상태: `Done`

연결 Roadmap: `R-001-consult-report-conversion`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-04

## 목표

리포트 CTA, 가격 페이지 진입, 결제 시작/완료 이벤트가 같은 source 체계로 연결되도록 준비한다.

## 범위

포함:

- 리포트 CTA 이벤트 점검
- 가격 페이지 진입 source/entry_cta 정리
- 결제 시작/완료 이벤트 attribution 보존
- 퍼널/분석 정책 문서 업데이트

제외:

- 가격/상품 구조 변경
- 결제 API 동작 변경
- 운영 Firebase 대시보드 생성

## 결과

완료 내용:

- 홈, 실천, 구독 설정, 결제 완료 재시도, 레거시 결제 upsell의 `/pricing` 이동에 `source`와 `entry_cta`를 부여했다.
- `/pricing` 모바일 리다이렉트 완료 경로가 `source`, `entry_cta`, `report_tab`, `report_kind`, `final_amount`를 `/pricing/complete`까지 보존하게 했다.
- `/pricing/complete`에서 구독 생성 성공 시 `payment_completed`를 기록하게 했다.
- 앱 IAP 성공 시 WebView의 `__iapPaymentCompleted` 콜백으로 `payment_completed`를 기록한 뒤 새로고침하게 했다.
- 앱 설치 유도 이벤트에도 리포트 attribution(`report_tab`, `report_kind`)을 전달한다.
- 분석 이벤트 정책, 퍼널 지표, 리포트 전환 분석 사이클 문서를 최신 이벤트 기준과 맞췄다.

검증 결과:

- 코드 정적 검증과 빌드는 전체 검증 단계에서 실행한다.

남은 리스크:

- Firebase DebugView/Explore에서 실제 운영 수집 여부는 배포 환경에서 확인해야 한다.
- 레거시 `/payment`는 건별 결제 호환 화면이므로 활성 퍼널에서는 구독 `/pricing` 이벤트를 우선 기준으로 본다.

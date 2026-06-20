<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# Roadmap

ID: `R-001-consult-report-conversion`

상태: `Active`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-10

## 목적

상담 입력 품질, 상담/리포트 문구, 전환 퍼널 문서를 맞춰 구독 전환 검증을 시작할 수 있는 상태로 만든다.

## 기간

시작: 2026-05-03

목표 종료: 2026-05-17

## 진행률

진행률: 90%

근거: 상담 입력 검증, 상담/리포트 문구 충돌 정리, 전환 이벤트 기준과 가격 진입 source 정리는 완료했다. 남은 범위는 배포 환경 Firebase DebugView 확인과 첫 주 기준선 수집이다.

## Milestones

| 순서 | Milestone | 완료 기준 | 상태 |
|---:|---|---|---|
| 1 | 상담 입력 검증 | 입력 실패/성공 케이스 테스트 통과 | `Done` |
| 2 | 상담/리포트 문구 정리 | 정책 문서와 UI 문구 충돌 없음 | `Done` |
| 3 | 전환 측정 준비 | 퍼널 문서와 이벤트 기준 갱신 | `Done` |

## Active Tasks

- `GJ-005-report-trust-baseline-qa`

## Backlog Tasks

- 첫 주 리포트 전환 기준선 기록 자동화 여부 검토

## 운영 후속

- 배포 환경 Firebase DebugView 확인
- 첫 주 리포트 전환 기준선 기록
- 리포트/가격/결제 이벤트에 개인식별 가능 정보가 포함되지 않는지 샘플 점검

## 제외

이번 roadmap에서 하지 않는 일:

- 신규 결제 모델 추가
- 대형 네이티브 앱 개편

## 검증 계획

테스트: 상담 입력 검증 unit test, 관련 UI 테스트

빌드/QA: 웹 lint/test/build, 앱 WebView smoke 확인

사용자/시장 검증: 결제 퍼널 이벤트 수집 가능 여부 확인

## 완료 후 업데이트

- [x] 연결 Goal 지표 갱신
- [x] 제품 문서 갱신
- [x] 진행상황 문서 갱신
- [x] 완료 task 이동

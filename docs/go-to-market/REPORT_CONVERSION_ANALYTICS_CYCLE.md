<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# 리포트 전환 분석-개선 사이클

Status: Active
Date: 2026-05-01

## 1. 목적

이 문서는 `/report`를 본 사용자가 실제로 다음 행동으로 넘어가는지 측정하고, 그 결과를 바탕으로 개선 실험을 반복하는 운영 사이클을 정의한다.
대상은 Firebase Analytics / GA4 웹 이벤트이며, 구현 이벤트 정의는 [docs/product/policies/analytics.md](../product/policies/analytics.md)를 따른다.

## 2. 확인할 질문

1. 무료 리포트는 다음 행동을 만드는가
2. `child_only` 사용자는 전체 분석으로 확장하는가
3. 공유보다 설문 확장/구독 CTA가 실제 전환에 기여하는가
4. 리포트에서 들어온 사용자는 가격 페이지와 결제 시작까지 이어지는가

## 3. 최소 이벤트 세트

| 이벤트 | 역할 |
|--------|------|
| `report_viewed` | 리포트 열람과 진입 소스 확인 |
| `report_primary_cta_clicked` | 리포트 다음 행동 클릭 확인 |
| `survey_module_started` | 리포트에서 설문으로 넘어간 흐름 확인 |
| `pricing_viewed` | 가격 페이지 도달 여부 확인 |
| `consult_started` | 리포트가 상담으로 이어졌는지 확인 |
| `payment_started` | 결제 시작 확인 |
| `payment_completed` | 실제 유료 전환 확인 |

## 4. 대시보드 기준

GA4 또는 Firebase Explore에서 아래 3개 퍼널을 기본 저장한다.

### 퍼널 A. 리포트 → 가격 → 결제

- `report_viewed`
- `report_primary_cta_clicked`
- `pricing_viewed`
- `payment_started`
- `payment_completed`

세그먼트:

- `source=report`
- `report_kind=child_only|full`
- `tab=child|parent|parenting`

### 퍼널 B. child_only → 전체 분석 확장

- `report_viewed(child_only=true)`
- `report_primary_cta_clicked(cta_type=continue_parent_survey)`
- `survey_module_started(source=report, module=parent)`
- `survey_flow_completed`

### 퍼널 C. 리포트 → 프리미엄 → 상담

- `report_viewed`
- `report_primary_cta_clicked(cta_type=start_trial)`
- `pricing_viewed(source=report)`
- `payment_started(source=report)`
- `consult_started(source=report)` 또는 `consult_started(source=consult, entry_cta=consult_gate)`

## 5. 주간 운영 루프

### 월요일

- 지난 7일 퍼널 A/B/C 전환율 확인
- `child_only`와 `full` 리포트 전환 차이 확인
- CTA별 클릭 비중 확인

### 화요일

- 가장 큰 이탈 구간 1개만 선택
- 원인 가설 1~2개 작성
- 이번 주 실험안 1개 확정

### 수요일-목요일

- 카피, CTA 우선순위, 배치, 리포트 설명 블록 중 하나만 변경
- 이벤트 스키마가 바뀌면 정책 문서 먼저 갱신

### 금요일

- 변경 후 동일 퍼널 재확인
- 수치 변화와 해석 기록
- 다음 주 유지 / 반복 / 폐기 결정

## 6. 판단 규칙

- 한 주에 한 가지 문제만 푼다.
- 한 번에 한 가지 실험만 메인 퍼널에 올린다.
- 클릭률이 올라도 뒤 단계 전환이 나빠지면 실패로 본다.
- `report_viewed`만 늘고 `pricing_viewed`, `payment_started`가 늘지 않으면 전환 개선이 아니다.

## 7. 첫 실험 권장안

실험 이름: `report-next-step-clarity-v1`

상태: 구현됨 (2026-05-02)

가설:

- 리포트 하단 CTA를 `공유`보다 `전체 분석 이어하기` 또는 `프리미엄 시작` 중심으로 재배치하면 다음 행동 전환이 오른다.

성공 기준:

- `report_primary_cta_clicked / report_viewed` 상승
- `pricing_viewed / report_viewed` 또는 `survey_module_started(source=report) / report_viewed` 상승

실패 기준:

- CTA 클릭은 늘지만 `payment_started` 또는 `survey_flow_completed`가 그대로거나 하락

## 8. 실행 체크리스트

- [ ] 이벤트가 배포 환경에서 실제 수집되는지 Firebase DebugView로 확인
- [ ] Explore에 퍼널 A/B/C 저장
- [x] `source`, `report_kind`, `cta_type` 값이 문서와 일치하는지 확인
- [ ] 첫 주 기준선 수치 기록
- [x] 첫 실험안 1개 확정
- [x] `report-next-step-clarity-v1` CTA 배치 구현

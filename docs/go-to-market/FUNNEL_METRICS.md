# 퍼널 지표

## 핵심 퍼널

| 단계 | 대표 이벤트 | 질문 |
|------|-------------|------|
| 유입 | `landing_cta_clicked` | 타깃 메시지가 시작 행동을 만드는가 |
| 인증 | `login_attempt`, `login_success` | 로그인 장벽이 과도하지 않은가 |
| 활성화 | `intake_completed`, `survey_flow_completed` | 첫 리포트까지 도달하는가 |
| 신뢰 | `report_viewed`, `report_primary_cta_clicked` | 리포트가 다음 행동을 만드는가 |
| 전환 | `pricing_viewed`, `payment_started`, `payment_completed` | 가격과 가치가 납득되는가 |
| 반복 | `consult_started`, 실천 기록 이벤트 | 상담이 실천과 재방문으로 이어지는가 |

## 리포트 전환 퍼널

1. `report_viewed`
2. `report_primary_cta_clicked`
3. `pricing_viewed`
4. `payment_started`
5. `payment_completed`

## 빠른 진단 확장 퍼널

1. `report_viewed(child_only=true)`
2. `report_expand_clicked`
3. `survey_module_started(source=report)`
4. `survey_flow_completed`

## 운영 리듬

- 매주 한 가지 이탈 구간만 선택한다.
- 한 번에 한 가지 실험만 메인 퍼널에 올린다.
- 클릭률이 올라도 뒤 단계 전환이 나빠지면 실패로 본다.
- 이벤트 스키마가 바뀌면 `../product/policies/analytics.md`를 먼저 갱신한다.

## 금지 원칙

- 이벤트에 이름, 고민 원문, 리포트 본문 같은 개인식별 가능 정보를 넣지 않는다.
- 자유서술형 텍스트를 분석 파라미터로 보내지 않는다.
- 고카디널리티 값을 `source`, `cta_type`, `placement`에 넣지 않는다.

## 상세 근거

운영 사이클은 `../plan/report-conversion-analytics-cycle.md`, 이벤트 정의는 `../product/policies/analytics.md`를 기준으로 한다.

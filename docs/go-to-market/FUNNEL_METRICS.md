<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `286294f3774eadc8024eabe1f4712eabbd2cb257` (`fix/live-survey-and-ux-polish`)
> - 최근 커밋: `286294f3774e` fix: include next-intl SWC helper in dependency lock
> - 커밋 일시: `2026-09-17T12:31:57+09:00`
> - 워킹트리: `dirty (7 files)`
> - 문서 갱신: `2026-09-17 12:34:55 +0900`
<!-- COMMIT_STATUS END -->

# 퍼널 지표

## 핵심 퍼널

| 단계 | 대표 이벤트 | 질문 |
|------|-------------|------|
| 유입 | `landing_cta_clicked` | 타깃 메시지가 설치 또는 시작 행동을 만드는가 |
| 설치 | `app_install_landing_viewed`, `app_install_store_clicked` | 웹 방문자가 스토어 이동까지 이어지는가 |
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

`pricing_viewed`, `payment_started`, `payment_completed`는 `source`, `entry_cta`, `report_tab`, `report_kind`를 유지해 리포트 하단 CTA와 가격/결제 단계를 연결한다.

## 가입 전 가치 확인 실험 (2026-09-17 구현, 코드 `92f6a81`)

`landing_cta_clicked(target=preview) → preview_viewed → preview_signup_clicked → 로그인 → intake_completed → assessment_phase_completed(phase=1) → report_viewed`

- 웹 검사 CTA는 로그인 후 `/intake`로 연결해 아이 정보와 필수 동의를 먼저 받는다. 예시 링크는 가입 없이 볼 수 있다.
- `scenario`별로 예시 방문 세션 대비 검사 CTA 클릭 세션을 비교한다. 같은 기간·플랫폼의 사용자 기준으로 1차 완료→리포트 열람→상담 시작을 이어서 본다.
- `preview_link_copied`는 공유 의향 신호이며 실제 공유·신규 가입을 의미하지 않는다.
- 배포 후 7일 기준선을 기록하고 방문자·검사 사용자 코호트 확보 후 개선 여부를 판단한다. 현재 DB의 11개 가입행·8개 리포트행만으로 전환율을 계산하지 않는다.

## 다운로드 유입 퍼널

1. `landing_cta_clicked(target=install_app)`
2. `app_install_landing_viewed(source=landing)`
3. `app_install_store_clicked(source=landing)`
4. 앱 스토어 콘솔의 설치 수와 첫 실행 수를 함께 비교

웹에서 바로 시작하는 사용자는 `landing_cta_clicked(target=web_start)`로 분리해 설치 CTA와 검사 시작 CTA의 품질을 따로 본다.

## 빠른 아이 리포트 확장 퍼널

1. `report_viewed(child_only=true)`
2. `report_primary_cta_clicked(cta_type=continue_parent_survey)`
3. `survey_module_started(source=report, module=parent)`
4. `survey_flow_completed`

## 체험 가치 퍼널

1. `consult_started`
2. `consult_completed`
3. `practice_item_saved`
4. `practice_log_saved(first_log=true)`
5. `followup_context_viewed`
6. `consult_started(is_followup=true)`

## 리텐션 재진입 퍼널

1. `home_sos_clicked`
2. `consult_situation_prefilled`
3. `consult_started(source=home_sos)`
4. `consult_completed`
5. `practice_item_saved`

## 실천 피드백 퍼널

1. `practice_log_saved`
2. `practice_feedback_viewed`
3. `consult_started(source=home_sos 또는 followup)`

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

운영 사이클은 `REPORT_CONVERSION_ANALYTICS_CYCLE.md`, 이벤트 정의는 `../product/policies/analytics.md`를 기준으로 한다.

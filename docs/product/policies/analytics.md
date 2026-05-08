# 분석 이벤트 정책

운영 관점에서 확인해야 하는 기본 퍼널 및 이벤트 측정 규칙 정의.
최종 동기화: 2026-05-01

## 목적

- 랜딩 → 로그인 → 접수 → 설문 → 리포트 → 결제 → 상담의 핵심 퍼널 전환율을 확인한다.
- 기능 출시 전후 변화량을 비교할 수 있도록 화면 조회와 주요 액션을 공통 이벤트로 남긴다.
- 환경변수가 없는 개발 환경에서는 이벤트 전송을 비활성화하여 로컬 개발을 방해하지 않는다.

## 측정 도구

- 웹 앱(`app/`)은 Firebase에 연결된 웹 스트림의 Measurement ID를 사용해 이벤트를 전송한다.
- 환경변수: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- 환경변수가 비어 있으면 추적 코드는 no-op로 동작한다.

## 기본 수집 항목

| 이벤트 | 목적 | 주요 파라미터 |
|--------|------|---------------|
| `page_view` | 화면별 방문 수, 경로별 이탈 확인 | `page_path`, `page_title` |
| `landing_cta_clicked` | 랜딩 CTA 위치별 클릭률 비교 | `placement` |
| `login_attempt` | 로그인 수단별 시도량 확인 | `provider` |
| `login_success` | 로그인 완료율 확인 | `provider` |
| `login_failed` | 로그인 실패 지점 확인 | `provider`, `reason` |
| `signup_attempt` | 이메일 가입 시도량 확인 | `provider` |
| `signup_failed` | 이메일 가입 실패 지점 확인 | `provider`, `reason` |
| `logout` | 세션 종료 추적 | 없음 |
| `intake_completed` | 접수 완료율 확인 | `child_gender`, `concern_count` |
| `survey_module_started` | 설문 모듈 진입량 확인 | `module`, `source`, `report_tab`, `report_kind` |
| `survey_module_completed` | 모듈별 완료율 확인 | `module`, `answered_questions`, `source`, `report_tab`, `report_kind` |
| `survey_flow_completed` | 전체 설문 완료율 확인 | `answered_questions`, `source`, `report_tab`, `report_kind` |
| `survey_abandoned` | 설문 이탈 위치 확인 | `module`, `answered_questions`, `current_question_index`, `exit_type`, `source`, `report_tab`, `report_kind` |
| `report_viewed` | 리포트 탭별 열람량과 진입 소스 확인 | `tab`, `child_only`, `report_kind`, `has_saved_report`, `source`, `has_subscription` |
| `report_primary_cta_clicked` | 리포트에서 다음 행동 CTA 클릭률 확인 | `cta_type`, `placement`, `report_tab`, `report_kind`, `child_only`, `source` |
| `share_action_completed` | 공유 채널별 완료량 확인 | `channel`, `source`, `entry_cta`, `report_kind`, `has_report_id`, `fallback_from` |
| `share_action_failed` | 공유 실패와 복사 fallback 확인 | `channel`, `source`, `entry_cta`, `report_kind`, `has_report_id`, `fallback_used` |
| `share_action_cancelled` | 네이티브/Web Share 취소 확인 | `channel`, `source`, `entry_cta`, `report_kind`, `has_report_id`, `reason` |
| `pricing_viewed` | 가격 페이지 유입 소스와 리포트 연계 전환 확인 | `source`, `entry_cta`, `is_app`, `report_tab`, `report_kind` |
| `payment_started` | 결제 시도량 및 결제수단 비중 확인 | `source`, `entry_cta`, `pay_method`, `used_coupon`, `final_amount`, `report_tab`, `report_kind` |
| `payment_completed` | 결제 완료율 및 쿠폰 효과 확인 | `source`, `entry_cta`, `pay_method`, `used_coupon`, `final_amount`, `report_tab`, `report_kind` |
| `payment_cancelled` | 결제창/리다이렉트/IAP 취소 확인 | `source`, `entry_cta`, `pay_method`, `stage`, `reason`, `used_coupon`, `final_amount`, `report_tab`, `report_kind` |
| `payment_failed` | 결제 모듈/검증/구독 생성 실패 확인 | `source`, `entry_cta`, `pay_method`, `stage`, `reason`, `used_coupon`, `final_amount`, `report_tab`, `report_kind` |
| `subscription_action_clicked` | 구독 관리 CTA 클릭 확인 | `action`, `source`, `entry_cta`, `subscription_source`, `subscription_status`, `placement` |
| `subscription_action_requested` | 구독 해지/재활성화 서버 요청 시작 확인 | `action`, `source`, `entry_cta`, `subscription_source`, `subscription_status` |
| `subscription_action_completed` | 구독 해지/재활성화 완료 확인 | `action`, `source`, `entry_cta`, `subscription_source` |
| `subscription_action_failed` | 구독 해지/재활성화 실패 확인 | `action`, `source`, `entry_cta`, `subscription_source`, `reason` |
| `consult_started` | 상담 진입량과 후속 상담 비중 확인 | `source`, `has_child_report`, `has_subscription`, `is_trial`, `is_followup`, `report_tab`, `report_kind` |
| `consult_completed` | 상담 결과까지 도달했는지 확인 | `source`, `has_subscription`, `is_trial`, `is_followup`, `action_item_count` |
| `practice_item_saved` | 상담 결과에서 실천 항목을 저장했는지 확인 | `source`, `has_subscription`, `is_trial`, `is_followup`, `action_index`, `duration`, `replaced_practice`, `saved` |
| `home_next_action_clicked` | 홈 상단 다음행동 카드가 실제 행동으로 이어지는지 확인 | `source`, `entry_cta`, `next_action_type`, `action_type` |
| `practice_log_saved` | 실천 기록 완료율과 첫 기록 여부 확인 | `source`, `entry_cta`, `done`, `first_log`, `has_full_access`, `with_reaction_feedback`, `child_reaction_type`, `parent_impression_type` |
| `practice_feedback_viewed` | 기록 후 AI 피드백 노출 여부 확인 | `first_log`, `has_full_access`, `child_reaction_type`, `parent_impression_type` |
| `practice_review_saved` | 실천 기간 회고 완료 여부 확인 | `done_days`, `review_mode`, `has_full_access` |
| `followup_context_viewed` | 후속 상담 진입 시 이전 실천 맥락 노출 여부 확인 | `source`, `has_subscription`, `is_trial`, `practice_count`, `log_count`, `review_count` |
| `trial_conversion_cta_clicked` | 체험 종료/만료 전후 구독 CTA 클릭 확인 | `source`, `entry_cta`, `placement`, `trial_state`, `trial_days_remaining`, `has_subscription`, `has_practice_priority`, `has_consult_priority` |
| `observation_saved` | 관찰 기록 작성 완료 확인 | `has_note`, `has_consultation`, `child_count` |
| `observation_save_failed` | 관찰 기록 저장 실패 확인 | `has_note`, `has_consultation`, `child_count`, `reason` |
| `observation_deleted` | 관찰 기록 삭제 완료 확인 | `remaining_count` |
| `observation_delete_failed` | 관찰 기록 삭제 실패 확인 | `reason` |
| `notification_setting_changed` | 푸시/실천 리마인더 토글 변경 확인 | `setting`, `enabled`, `is_app`, `active_practice_count`, `pending_practice_count` |
| `practice_reminder_time_changed` | 실천 리마인더 시간 변경 확인 | `reminder_hour`, `reminder_minute`, `is_app`, `active_practice_count`, `pending_practice_count` |
| `practice_reminder_test_sent` | 실천 리마인더 테스트 발송 확인 | `is_app`, `active_practice_count`, `pending_practice_count` |
| `marketing_opt_in_changed` | 마케팅 수신 동의 변경 확인 | `enabled` |
| `marketing_opt_in_change_failed` | 마케팅 수신 동의 저장 실패 확인 | `attempted_enabled`, `reason` |
| `app_install_landing_viewed` | 웹 브라우저에서 앱 설치 유도 화면 도달 확인 | `source`, `entry_cta`, `report_tab`, `report_kind`, `platform` |
| `app_install_store_clicked` | 설치 유도 화면에서 스토어 이동 클릭 확인 | `source`, `entry_cta`, `report_tab`, `report_kind`, `platform`, `store` |
| `app_install_app_open_clicked` | 모바일 설치 유도 화면에서 앱 딥링크 열기 시도 확인 | `source`, `entry_cta`, `report_tab`, `report_kind`, `platform`, `target_path` |
| `app_install_link_copied` | PC 설치 유도 화면에서 휴대폰 전달용 링크 복사 확인 | `source`, `entry_cta`, `report_tab`, `report_kind`, `platform` |

## 리포트 전환 핵심 퍼널

- 기본 퍼널: `report_viewed → report_primary_cta_clicked → pricing_viewed → payment_started → payment_completed`
- 빠른 아이 리포트 확장 퍼널: `report_viewed(child_only=true) → report_primary_cta_clicked(cta_type=continue_parent_survey) → survey_module_started(module=parent, source=report) → survey_flow_completed`
- 이미 양육자 기질 데이터가 있는 사용자의 아이 리포트 재진입은 `child_only`를 유지하지 않고 전체 리포트 모드로 정규화한다.
- 체험 가치 퍼널: `consult_started → consult_completed → practice_item_saved → practice_log_saved → followup_context_viewed → consult_started(is_followup=true)`

## 운영 질문

- 리포트는 실제로 다음 행동을 만드는가
- `child_only` 사용자는 전체 분석으로 확장하는가
- 어떤 CTA가 가격 페이지 진입과 결제 시작으로 가장 잘 이어지는가
- 리포트에서 들어온 상담 사용자는 다른 유입 대비 재방문/후속 상담 비중이 높은가
- 체험 사용자가 첫 상담 이후 실천 저장, 첫 기록, 후속 상담까지 이어지는가

## 운영 원칙

- 신규 기능 추가 시 가능하면 `page_view`만으로 끝내지 말고, 사용자의 핵심 행동을 별도 이벤트로 분리한다.
- 이벤트명은 소문자 스네이크 케이스를 사용한다.
- `login_attempt`, `login_success`의 `provider` 값은 `kakao`, `google`, `apple`, `email`만 사용한다.
- 가격/설치/결제 진입 `source`는 `home`, `report`, `consult`, `practices`, `subscription_settings`, `pricing_complete`, `payment`, `legacy_payment`, `direct`처럼 화면/흐름 단위의 낮은 카디널리티 값만 사용한다.
- 파라미터는 비교 가능한 값 위주로 유지하고, 자유서술형 텍스트는 전송하지 않는다.
- `source`, `cta_type`, `placement`, `report_kind` 같은 분류 파라미터는 저카디널리티 값만 허용한다.
- 개인식별 가능 정보(이름, 고민 원문, 리포트 본문)는 이벤트에 포함하지 않는다.

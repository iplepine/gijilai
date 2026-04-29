# 분석 이벤트 정책

운영 관점에서 확인해야 하는 기본 퍼널 및 이벤트 측정 규칙 정의.
최종 동기화: 2026-04-12

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
| `logout` | 세션 종료 추적 | 없음 |
| `intake_completed` | 접수 완료율 확인 | `child_gender`, `concern_count` |
| `survey_module_started` | 설문 모듈 진입량 확인 | `module` |
| `survey_module_completed` | 모듈별 완료율 확인 | `module`, `answered_questions` |
| `survey_flow_completed` | 전체 설문 완료율 확인 | `answered_questions` |
| `report_viewed` | 리포트 탭별 열람량 확인 | `tab`, `child_only`, `has_saved_report` |
| `payment_started` | 결제 시도량 및 결제수단 비중 확인 | `pay_method`, `used_coupon`, `final_amount` |
| `payment_completed` | 결제 완료율 및 쿠폰 효과 확인 | `pay_method`, `used_coupon`, `final_amount` |
| `consult_started` | 상담 진입량과 후속 상담 비중 확인 | `has_child_report`, `has_subscription`, `is_followup` |

## 운영 원칙

- 신규 기능 추가 시 가능하면 `page_view`만으로 끝내지 말고, 사용자의 핵심 행동을 별도 이벤트로 분리한다.
- 이벤트명은 소문자 스네이크 케이스를 사용한다.
- `login_attempt`, `login_success`의 `provider` 값은 `kakao`, `google`, `apple`, `email`만 사용한다.
- 파라미터는 비교 가능한 값 위주로 유지하고, 자유서술형 텍스트는 전송하지 않는다.
- 개인식별 가능 정보(이름, 고민 원문, 리포트 본문)는 이벤트에 포함하지 않는다.

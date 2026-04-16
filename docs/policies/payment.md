# 결제 및 가격 정책

## 결제 인프라

- 결제 플랫폼: 포트원 V2 SDK (`@portone/server-sdk`)
- 한국 PG: NHN KCP (카드), KG 이니시스 (카드), 토스페이 (간편결제), 네이버페이 (간편결제)
- 글로벌 PG: Stripe (카드)
- locale(ko/en)에 따라 PG사/통화/결제수단 자동 분기
- 한국 사용자는 카드(NHN KCP / KG 이니시스), 토스페이, 네이버페이 중 선택 가능
- KG 이니시스 카드 빌링키 발급은 구매자 이름/휴대폰 번호가 필수이므로, KG 이니시스 선택 시에만 휴대폰 번호를 입력받아 PortOne 빌링키 발급창 호출 파라미터로 전달한다. 이 값은 앱 DB에 저장하지 않는다.

## 가격

구독 전용 모델 (건별 결제 폐지, 월 구독만 운영).

| 상품 | 한국 (KRW) | 글로벌 (USD) |
|------|-----------|-------------|
| 월 구독 | 12,000원/월 | $11.99/month |

> 가격 상수: `app/src/lib/portone.ts` `PRICE_TABLE`, `app/src/app/pricing/page.tsx` `PRICES`

## 7일 리버스 트라이얼

- 신규 가입 시 7일간 전체 기능(프리미엄 동일) 무료 체험
- 카드 정보 사전 요구 안 함
- 체험 기간 판단: `user.created_at` 기준 7일 이내 (`db.getTrialStatus`)
- 체험 종료 후 자동으로 베이직(무료) 전환
- 홈 헤더 뱃지: "체험중 D-N" 표시, 탭 시 `/pricing` 이동

## 티어별 기능

| 기능 | 베이직 (무료) | 구독 |
|------|-------------|------|
| 기질 리포트 | O (전체 동일) | O |
| AI 상담 | 체험 기간 무제한, 이후 이용 불가 | 무제한 |
| 실천 기록 | 최근 1개 | 전체 이력 |
| 재검사 쿨다운 | 24시간 | 없음 (pricing 페이지 표기 기준) |

> 참고:
> `checkCooldown` (`app/src/lib/dateUtils.ts`)은 구독 여부와 무관하게 24시간 고정이다. 구독자 쿨다운 면제는 pricing 페이지 UI 문구에만 존재하며, 코드 분기는 미구현 상태.
> 상담 접근 제어는 `app/src/lib/access.ts` 기준으로 클라이언트와 `/api/consult/*` 서버 라우트 모두에서 동일하게 적용한다.
> 실천 탭은 무료 사용자에게 최신 ACTIVE 실천 1개만 노출한다. 데이터 전체 보안 제어는 현재 앱 레벨 표시 제한이며, DB RLS 단위 제한은 별도 과제다.

## 구독 라이프사이클

- **구독 생성**: 빌링키 발급 → 첫 결제 → ACTIVE (`/api/payment/subscribe`)
- **정기 갱신**: cron(`/api/payment/billing`)으로 만료 구독 자동 결제
- **갱신 실패**: PAST_DUE 상태. 4일 이내 연속 3회 실패 시 EXPIRED (`MAX_RETRY_COUNT = 3`)
- **해지**: 기간 만료 해지 (`cancelled_at` 설정, status는 ACTIVE 유지). 다음 갱신 시점에 EXPIRED 처리 (`/api/payment/cancel-subscription`)
  - 해지 API는 `subscriptions` RLS 정책상 사용자 update가 불가능하므로 서버 service role로 `cancelled_at`을 설정한다.
- **해지 철회**: 기간 만료 전 `cancelled_at`이 있는 PORTONE 구독은 `/api/payment/reactivate-subscription`으로 즉시 해지 예약을 취소한다.
  - 새 구독을 만들거나 즉시 결제하지 않고 기존 구독의 `cancelled_at`만 `null`로 되돌린다.
  - 앱스토어/플레이스토어 구독은 스토어 구독 관리 화면에서 재활성화해야 한다.
- **환불**: 결제 7일 이내 미이용 시 전액 환불 가능 (쿨링오프). 이후 환불 불가. 환불 요청은 devhohouse@gmail.com (`/legal/refund`)
- **구독 생성 실패 시 자동 환불**: DB 저장 실패 → `cancelPayment`로 즉시 결제 취소

## 앱 인앱결제(IAP)

- Flutter 앱은 `in_app_purchase`로 Apple App Store / Google Play 구독을 시작한다.
- 최초 구매는 `/api/payment/iap`에서 영수증 검증 후 `subscriptions`/`payments`에 반영한다.
- 이후 상태 변경은 스토어 서버 알림으로 동기화한다.
  - Apple App Store Server Notifications V2: `/api/payment/iap/apple-notifications`
  - Google Real-time Developer Notifications: `/api/payment/iap/google-rtdn`
- 앱 IAP도 웹 구독과 동일한 `subscriptions` 테이블을 사용하되 `source`로 출처를 구분한다.
- 운영 중 필수 환경변수:
  - `APPLE_IAP_JWT`
  - `GOOGLE_PLAY_CREDENTIALS`
  - `GOOGLE_PLAY_PACKAGE_NAME`
  - `GOOGLE_RTDN_TOKEN` (RTDN 엔드포인트 보호용 공유 토큰)

### IAP 상태 동기화 원칙

- 최초 구매 성공만으로 구독 운영을 끝내지 않는다. 갱신, 해지 예약, 결제 실패, 환불/회수는 서버 알림으로 반영한다.
- Apple/Google 알림이 오면 해당 거래를 다시 스토어 API로 조회해 검증한 뒤 `subscriptions` 상태를 갱신한다.
- 해지 예약은 `cancelled_at`만 설정하고, 사용 기간이 끝날 때까지 `ACTIVE`를 유지할 수 있다.
- 환불/회수는 즉시 접근을 막기 위해 `CANCELLED` 또는 `EXPIRED`로 내린다.
- 결제 금액은 앱 상품 코드 기준 서버 상수로 기록하며, 앱스토어 콘솔 가격과 항상 일치시켜야 한다.

## 건별 결제 (폐지)

건별 구매(구 990원/1,980원)는 폐지됨. `/api/payment/verify`는 기존 결제 건 호환용으로만 유지 (`legacyPrices: KRW 1980, USD 499`).

## AI 리포트 생성

- 리포트 모델: gpt-4o-mini / 상담 모델: gpt-4o
- Temperature: 0.7
- 응답 형식: JSON 객체 (`response_format: { type: "json_object" }`)
- JSON 파싱 실패 시 원본 문자열로 폴백
- 모든 리포트 API 호출은 Supabase 세션 인증 필요

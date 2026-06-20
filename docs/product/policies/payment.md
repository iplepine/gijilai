<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `42ed4d5e3c01012a9599c8ac423810d3beb99831` (`claude/enable-phased-assessment`)
> - 최근 커밋: `42ed4d5e3c01` 차수화 신뢰도 캘리브레이션 인프라 + 미캘리 신뢰도 노출 게이트
> - 커밋 일시: `2026-06-17T08:17:20+09:00`
> - 워킹트리: `dirty (72 files)`
> - 문서 갱신: `2026-06-20 22:33:14 +0900`
<!-- COMMIT_STATUS END -->

# 결제 및 가격 정책

## 결제 인프라

- 결제 플랫폼: 포트원 V2 SDK (`@portone/server-sdk`)
- 한국 웹 PG: KG 이니시스 (정기결제 운영), NHN KCP (계약 진행 중)
- 글로벌 PG: Stripe (카드)
- 플랫폼과 locale에 따라 앱 IAP / 웹 PG / 통화 자동 분기
- 브라우저에서 구독/결제 진입(`/pricing`, `/payment`) 시에는 웹 결제를 계속 진행하지 않고 앱 설치 랜딩(`/install-app`)으로 보낸다. PC 웹에서는 QR 코드와 링크 복사로 휴대폰에서 이어가도록 안내하고, 모바일 웹에서는 앱 딥링크를 먼저 열어본 뒤 설치 앱이 없으면 접속 OS에 맞는 App Store 또는 Google Play로 fallback한다.
- 사용자는 PG사, 카드결제, 인앱결제 같은 결제 라우팅을 선택하지 않는다.
- 토스페이/네이버페이는 심사 거부로 결제 UI에서 미노출한다.
- 웹 정기결제 빌링키 발급은 구매자 이름/휴대폰 번호가 필요하므로, 구독 버튼을 누른 시점에 다이얼로그로 휴대폰 번호를 입력받아 PortOne 빌링키 발급창 호출 파라미터로 전달한다. 이 값은 앱 DB에 저장하지 않는다.
- 포트원 웹훅 시크릿은 운영 중 무중단 교체를 위해 최대 2개까지 동시에 검증할 수 있게 유지한다. 기본값은 `PORTONE_WEBHOOK_SECRET`, 교체 기간에는 `PORTONE_WEBHOOK_SECRET_SECONDARY` 또는 `PORTONE_WEBHOOK_SECRETS`를 함께 사용한다.
- 포트원 웹훅과 정기결제 cron은 필수 시크릿이 없으면 fail closed로 실패한다. `PORTONE_WEBHOOK_SECRET` 계열 값이 없으면 웹훅을 처리하지 않고, `CRON_SECRET`이 없으면 `/api/payment/billing`을 실행하지 않는다.

## 가격

구독 전용 모델 (건별 결제 폐지, 월 구독만 운영).

| 상품 | 한국 (KRW) | 글로벌 (USD) |
|------|-----------|-------------|
| 월 구독 | 12,000원/월 | $9.99/month |
| 첫 달 혜택 | 신규 첫 구독 8,400원 | 스토어/PG offer 설정 기준 |

> 가격 상수: `app/src/lib/portone.ts` `PRICE_TABLE`, `app/src/app/pricing/page.tsx` `PRICES`

## 7일 리버스 트라이얼

- 신규 가입 시 7일간 전체 기능(프리미엄 동일) 무료 체험
- 카드 정보 사전 요구 안 함
- 체험 기간 판단: `user.created_at` 기준 7일 이내 (`db.getTrialStatus`)
- 체험 종료 후 자동으로 베이직(무료) 전환
- 홈 헤더 뱃지: "체험중 D-N" 표시, 탭 시 `/pricing` 이동
- 체험 종료 D-2 이하 비구독자는 홈 카드로 구독 전환 안내를 노출한다.

## 구독 유도 위치

- **홈**: 체험 종료 임박(D-2 이하) 비구독자에게 프리미엄 지속 카드 노출
- **리포트**: 비구독자가 리포트를 확인한 하단에 리포트 기반 상담/실천 연결 CTA 노출
- **상담 결과**: 비구독자가 상담 처방을 받은 직후 실천 기록과 다음 상담을 이어갈 수 있다는 CTA 노출
- **요금제 화면**: 기능 잠금 해제 목록보다 `리포트 → 상담 → 실천 기록 → 다음 상담` 루프를 먼저 설명한다.
- 유도 문구는 결제 압박보다 "지속관리 코치" 가치에 초점을 둔다. 즉, 리포트 단발 소비보다 실천 기록이 쌓일수록 다음 상담과 가이드가 더 정교해진다는 약속을 반복한다.

## 티어별 기능

| 기능 | 베이직 (무료) | 구독 |
|------|-------------|------|
| 아이 프로필 | 1명 영구 슬롯 (삭제해도 무료 슬롯 초기화 없음) | 여러 명 |
| 기질 리포트 | O (전체 동일) | O |
| AI 상담 | 체험 기간 무제한, 이후 이용 불가 | 무제한 |
| 실천 기록 | 최근 1개 | 전체 이력 |
| 상담 맥락 누적 | 현재 세션/체험 맥락까지만 | 지난 실천 기록과 회고를 다음 상담에 반영 |

> 참고:
> `checkCooldown` (`app/src/lib/dateUtils.ts`)은 재검사 시작 제한을 무료 7일, 구독 24시간으로 계산한다. 현재 요금제/구독 유도 문구는 쿨다운 면제보다 상담-실천-후속상담의 연속 관리 가치를 우선 설명한다.
> 상담 접근 제어는 `app/src/lib/access.ts` 기준으로 클라이언트와 `/api/consult/*` 서버 라우트 모두에서 동일하게 적용한다.
> 실천 탭은 무료 사용자에게 최신 ACTIVE 실천 1개만 노출한다. 데이터 전체 보안 제어는 현재 앱 레벨 표시 제한이며, DB RLS 단위 제한은 별도 과제다.
> 아이 프로필 제한은 `child_profile_slots` 영구 슬롯과 `children` RLS/트리거로 DB에서 방어한다. 무료 전환 후 마지막 아이를 삭제해 새 아이로 재등록하는 방식으로 무료 검사를 반복할 수 없다.

## 구독 라이프사이클

- **구독 생성**: 빌링키 발급 → 첫 결제 → ACTIVE (`/api/payment/subscribe`)
- **결제수단 표시**: 결제 이력에는 PG/결제수단과 마스킹된 카드번호만 표시한다. 카드 전체 번호, CVC, 유효기간 등 민감한 카드정보는 저장하지 않는다.
- **정기 갱신**: cron(`/api/payment/billing`)으로 만료 구독 자동 결제
- **갱신 실패**: PAST_DUE 상태. 4일 이내 연속 3회 실패 시 EXPIRED (`MAX_RETRY_COUNT = 3`)
- **해지**: 기간 만료 해지 (`cancelled_at` 설정, status는 ACTIVE 유지). 다음 갱신 시점에 EXPIRED 처리 (`/api/payment/cancel-subscription`)
  - 해지 API는 `subscriptions` RLS 정책상 사용자 update가 불가능하므로 서버 service role로 `cancelled_at`을 설정한다.
  - `PORTONE` 구독만 해지 API로 `cancelled_at`를 직접 설정한다.
  - `APPLE_IAP` / `GOOGLE_PLAY` 구독은 앱/웹이 각 스토어 구독 관리 화면으로 안내하고, 서버는 스토어 상태 재검증 또는 서버 알림으로 `cancelled_at`를 반영한다.
- **해지 철회**: 기간 만료 전 `cancelled_at`이 있는 PORTONE 구독은 `/api/payment/reactivate-subscription`으로 즉시 해지 예약을 취소한다.
  - 새 구독을 만들거나 즉시 결제하지 않고 기존 구독의 `cancelled_at`만 `null`로 되돌린다.
  - 앱스토어/플레이스토어 구독은 스토어 구독 관리 화면에서 재활성화해야 한다.
  - 구독 관리/요금제 화면 모두에서 해지 예약 상태일 때 재개 액션 버튼을 노출한다. `PORTONE`은 앱 내 "구독 계속하기" 버튼, `APPLE_IAP`/`GOOGLE_PLAY`는 "다시 구독하기" 버튼으로 각 스토어 구독 관리 화면으로 연결한다.
- **구독 상태 설명 원칙**: 구독 관리 화면은 raw status를 그대로 노출하지 않고 사용자 언어로 재매핑한다.
  - `ACTIVE` + `cancelled_at 없음` → `활성`: 자동 갱신 중, 다음 결제일 표시
  - `ACTIVE` + `cancelled_at 있음` → `해지 예약`: 현재 기간 종료일까지 이용 가능
  - `PAST_DUE` → `결제 필요`: 결제 정보 확인 또는 스토어 관리 유도
  - 그 외 종료 상태 → `만료됨`: 다시 구독하기 CTA 노출
  - 스토어 구독은 상태와 별개로 관리 위치가 App Store / Google Play임을 명시한다.
- **환불**: 결제 7일 이내이고 결제 이후 AI 상담 생성, 후속 상담, 구독자 전용 실천 기록 전체 열람 같은 유료 기능 사용 이력이 없으면 전액 환불 가능 (쿨링오프). 이용 중 환불 요청 시 실제 결제금액 기준으로 환불 요청일 다음 날부터 결제 주기 종료일까지의 미사용 일수를 일할 계산해 부분 환불한다. 산식은 `실제 결제금액 × 남은 미사용 일수 ÷ 해당 결제 주기의 총 일수`이며, 부분 환불 후 유료 기능 접근은 종료한다. 단순 해지는 현재 결제 기간 종료일까지 이용 후 다음 결제부터 과금 중단. 환불 요청은 devhohouse@gmail.com (`/legal/refund`)
- **유료 기능 사용 이력**: `subscription_usage_events`에 결제 기간 내 AI 상담 질문 생성, AI 상담 처방 생성, 구독자 전용 실천 기록 전체 열람 이벤트를 서버 기준으로 기록한다. 전액 환불의 "미사용" 여부는 해당 결제 기간의 사용 이력 유무로 판단한다.
- **구독 생성 실패 시 자동 환불**: DB 저장 실패 → `cancelPayment`로 즉시 결제 취소
- **결제 API 에러 응답 원칙**: 결제/구독 API는 내부 예외 메시지나 PG/DB raw 오류를 그대로 클라이언트에 노출하지 않는다. 잘못된 JSON 본문은 `400 INVALID_JSON_BODY`, 서버 내부 실패는 안정된 에러 코드(`SUBSCRIBE_FAILED`, `PAYMENT_VERIFICATION_FAILED`, `IAP_VERIFICATION_FAILED` 등)로 응답하고 상세 원인은 서버 로그에서만 확인한다.
- **웹훅/스토어 알림 실패 원칙**: PortOne 웹훅, Apple Server Notification, Google RTDN은 malformed payload를 `200`으로 삼키지 않는다. 잘못된 본문은 `400`, 처리 중 내부 실패는 `5xx`로 반환해 외부 재시도와 운영 감지를 가능하게 유지한다.

## 앱 인앱결제(IAP)

- Flutter 앱은 `in_app_purchase`로 Apple App Store / Google Play 구독을 시작한다.
- 웹 브라우저에서는 새 구독 결제를 직접 시작하지 않는다. 결제 CTA는 앱 설치 랜딩으로 연결하고, 실제 구독 시작은 설치된 앱 안의 IAP에서 처리한다.
- 첫 달 30% 할인은 스토어에 등록된 introductory/구독 offer를 사용한다. Android는 Google Play가 반환한 구독 offer 중 첫 결제 phase가 이후 recurring phase보다 낮은 offer를 선택해 `offerToken`으로 결제창을 연다.
- 스토어 상품 ID는 플랫폼별로 다를 수 있으며, 현재 월 구독은 `APPLE_IAP = gijilai_premium_montly`, `GOOGLE_PLAY = monthly_premium`으로 운영한다. Apple Product ID는 App Store Connect 저장 후 수정할 수 없어 기존 오타 ID를 운영 식별자로 유지한다.
- iOS 시뮬레이터 `Debug` 실행에서는 `GIJILAI_ENABLE_IOS_IAP_FALLBACK=true` dart define을 넘겼을 때만 앱이 번들된 `Configuration.storekit`으로 로컬 StoreKit 테스트와 네이티브 테스트 다이얼로그(`성공/실패/취소`) fallback을 사용한다. 실기기 Sandbox/TestFlight 검증에서는 이 fallback을 켜지 않는다.
- 위 시뮬레이터 fallback은 개발용 UX 검증 경로다. 실제 영수증 검증, 구독 생성, 스토어 동기화는 실기기 샌드박스로 별도 확인한다. Apple 첫 구독 상품은 앱 버전과 함께 심사를 통과해야 실제 App Store/Sandbox 상품 조회와 검증 흐름을 안정적으로 확인할 수 있다.
- 최초 구매는 `/api/payment/iap`에서 영수증 검증 후 `subscriptions`/`payments`에 반영한다.
- 앱 IAP 구매 성공 후에는 웹 완료 플로우(`/pricing/complete?iap=true`)를 거쳐 구독 관리 화면으로 이동한다. pending/취소/실패 상태는 가격 화면 loading을 즉시 해제하고, WebView 세션 만료로 검증이 401이 되면 거래를 완료 처리하지 않은 채 로그인 후 재검증한다.
- 이후 상태 변경은 스토어 서버 알림으로 동기화한다.
  - Apple App Store Server Notifications V2: `/api/payment/iap/apple-notifications`
  - Google Real-time Developer Notifications: `/api/payment/iap/google-rtdn`
- 앱 IAP도 웹 구독과 동일한 `subscriptions` 테이블을 사용하되 `source`로 출처를 구분한다.
- 운영 중 필수 환경변수:
  - `APPLE_IAP_ISSUER_ID`
  - `APPLE_IAP_KEY_ID`
  - `APPLE_IAP_PRIVATE_KEY`
  - `APPLE_BUNDLE_ID`
  - `APPLE_APP_STORE_ROOT_CERT_PEM` : Apple Server Notification V2와 signed transaction JWS 인증서 체인을 검증할 Apple root CA PEM
  - `GOOGLE_PLAY_CREDENTIALS` : Google 서비스 계정 JSON 전체 문자열 (`client_email`, `private_key` 포함)
  - `GOOGLE_PLAY_PACKAGE_NAME`
  - `GOOGLE_RTDN_TOKEN` (RTDN 엔드포인트 보호용 공유 토큰)

- `APPLE_IAP_JWT`는 기존 운영값 호환을 위한 fallback으로만 사용한다. App Store Server API JWT는 최대 60분까지만 유효하므로 운영에서는 App Store Connect API key(`issuerId`, `keyId`, `.p8`)로 서버가 요청마다 JWT를 발급한다.
- `GOOGLE_PLAY_CREDENTIALS.private_key`는 PEM 개인키여야 하며 줄바꿈이 보존되어야 한다. 시크릿 매니저에 붙여넣을 때는 서비스 계정 JSON 원문 그대로 저장하거나 JSON 문자열 내부 `\n` 이스케이프를 유지한다.
- `APPLE_IAP_PRIVATE_KEY`와 `APPLE_APP_STORE_ROOT_CERT_PEM`은 PEM 줄바꿈이 보존되어야 한다. 시크릿 매니저가 한 줄 값만 허용하면 `\n` 이스케이프를 유지해 저장한다.
- App Review/TestFlight 결제는 샌드박스 거래이므로 운영 서버도 Apple production transaction lookup이 `404`이면 sandbox endpoint로 재시도한다.

### IAP 구매 전달 보장 (2026-06-10)

- 영수증 검증의 **일시 실패**(네트워크 단절, 서버 5xx/429, 응답 타임아웃)는 구매를 버리지 않고 세션 안에서 지수 백오프(10s→…→120s, 최대 5회)로 재시도한다. 한도를 넘으면 스토어 재전달에 맡긴다 — `completePurchase`를 호출하지 않았으므로 거래는 스토어에 남는다.
- **Android는 콜드 스타트마다 `restorePurchases()`를 자동 호출**한다. 미확인(unacknowledged) 구매는 Google이 3일 뒤 자동 환불하므로, 검증 도중 앱이 종료된 구매를 다음 실행에서 반드시 되살려야 한다. iOS는 미완료 거래가 자동 재전달되며, restore 호출이 App Store 로그인 프롬프트를 띄울 수 있어 자동 호출하지 않는다.
- **'구매 복원' 버튼**: 구독 관리 화면(설정 → 구독)에서 활성 구독이 없을 때 앱 컨텍스트에만 노출. `PaymentBridge`로 `RESTORE_REQUEST`를 보내 네이티브 `restorePurchases()`를 호출한다. 8초 안에 복원 이벤트가 없으면 "복원할 내역 없음"을 안내한다.
- 복원(restored) 이벤트의 서버 동기화는 **사용자가 명시적으로 복원을 요청한 경우가 아니면 조용히** 처리한다(스낵바/화면 이동 없음). 로그아웃 상태면 로그인 완료 후 자동 재시도된다.

### 웹 구독 생성 중복 방지 (2026-06-10)

- `subscriptions`에 partial unique index(`user_id` WHERE status IN ('ACTIVE','PAST_DUE'))를 둔다 (마이그레이션 024).
- `/api/payment/subscribe`에서 결제 후 구독 insert가 unique 위반(23505)이면 — 더블탭 등 동시 요청 — 이번 결제를 자동 환불하고 `ALREADY_SUBSCRIBED`(400)를 반환한다. 먼저 성공한 요청의 구독은 건드리지 않는다.

### IAP 상태 동기화 원칙

- 최초 구매 성공만으로 구독 운영을 끝내지 않는다. 갱신, 해지 예약, 결제 실패, 환불/회수는 서버 알림으로 반영한다.
- Apple/Google 알림이 오면 해당 거래를 다시 스토어 API로 조회해 검증한 뒤 `subscriptions` 상태를 갱신한다.
- Apple Server Notification V2의 `signedPayload`와 내부 `signedTransactionInfo`는 JWS 서명과 x5c 인증서 체인을 먼저 검증한 뒤 처리한다.
- Google Play 구독은 사용자가 스토어 구독 관리 화면에서 해지 후 앱으로 복귀했을 때 `/api/payment/subscription` 조회 중 스토어 상태를 다시 확인해 `cancelled_at`를 즉시 동기화한다.
- App Store 구독은 기본적으로 Apple Server Notification을 우선 진실값으로 사용한다. 앱 복귀 직후에는 알림 반영 전까지 잠시 이전 상태가 보일 수 있다.
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
- OpenAI 클라이언트는 `timeout 120s, maxRetries 1` (행이 걸린 요청이 비용·워커를 잡지 않게)

### LLM 비용 가드 (2026-06-10)

- 모든 LLM 엔드포인트(리포트/상담 질문/처방/실천 피드백/self-parent)는 호출 **전에** 사용자별 24시간 쿼터를 검사한다 (`llm_usage_events`, 마이그레이션 023).
- 기본 한도(정상 사용자는 닿지 않는 abuse guard 수준): REPORT 12 · CONSULT_QUESTIONS 60 · CONSULT_PRESCRIPTION 20 · PRACTICE_FEEDBACK 40 · SELF_PARENT_QUESTIONS 30 · SELF_PARENT_PRESCRIPTION 10. 환경변수 `LLM_DAILY_LIMIT_<KIND>`로 운영 중 조정.
- 초과 시 429 + `LLM_QUOTA_EXCEEDED`. 쿼터 인프라 오류(테이블 미적용 포함) 시에는 차단하지 않는다(fail-open).

### 아이 실명 비식별화 (2026-06-10)

- 아이 **실명은 OpenAI로 전송하지 않는다**. 프롬프트에는 가명 `○○이`를 보내고, 자유 텍스트(고민·답변·관찰·세션 맥락) 속 이름도 가명으로 치환한 뒤, 응답에서 받침 규칙에 맞는 조사와 함께 실명으로 복원한다 (`app/src/lib/childPseudonym.ts`).
- 생년월일 원본도 전송하지 않는다 — 나이(세/개월) 표기로 변환해 전달한다.
- 복원이 누락돼도 사용자에게는 관용적 익명 표기(○○이)로 보인다.

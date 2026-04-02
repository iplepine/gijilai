# 결제 및 가격 정책

## 결제 인프라

- 결제 플랫폼: 포트원 V2 SDK (`@portone/server-sdk`)
- 한국 PG: NHN KCP (카드), 토스페이 (간편결제), 네이버페이 (간편결제)
- 글로벌 PG: Stripe (카드)
- locale(ko/en)에 따라 PG사/통화/결제수단 자동 분기
- 한국 사용자는 카드(NHN KCP), 토스페이, 네이버페이 중 선택 가능

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

> 참고: 실제 `checkCooldown` (`app/src/lib/dateUtils.ts`)은 구독 여부와 무관하게 24시간 고정. 구독자 쿨다운 면제는 pricing 페이지 UI 문구에만 존재하며, 코드 분기는 미구현 상태.

## 구독 라이프사이클

- **구독 생성**: 빌링키 발급 → 첫 결제 → ACTIVE (`/api/payment/subscribe`)
- **정기 갱신**: cron(`/api/payment/billing`)으로 만료 구독 자동 결제
- **갱신 실패**: PAST_DUE 상태. 4일 이내 연속 3회 실패 시 EXPIRED (`MAX_RETRY_COUNT = 3`)
- **해지**: 기간 만료 해지 (`cancelled_at` 설정, status는 ACTIVE 유지). 다음 갱신 시점에 EXPIRED 처리 (`/api/payment/cancel-subscription`)
- **환불**: 결제 7일 이내 미이용 시 전액 환불 가능 (쿨링오프). 이후 환불 불가. 환불 요청은 devhohouse@gmail.com (`/legal/refund`)
- **구독 생성 실패 시 자동 환불**: DB 저장 실패 → `cancelPayment`로 즉시 결제 취소

## 건별 결제 (폐지)

건별 구매(구 990원/1,980원)는 폐지됨. `/api/payment/verify`는 기존 결제 건 호환용으로만 유지 (`legacyPrices: KRW 1980, USD 499`).

## AI 리포트 생성

- 리포트 모델: gpt-4o-mini / 상담 모델: gpt-4o
- Temperature: 0.7
- 응답 형식: JSON 객체 (`response_format: { type: "json_object" }`)
- JSON 파싱 실패 시 원본 문자열로 폴백
- 모든 리포트 API 호출은 Supabase 세션 인증 필요

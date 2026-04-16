# 결제 시스템 전환: 포트원 V2 구독 모델

Status: Draft v1
Date: 2026-03-25

## 1. 문제 정의

현재 결제 시스템은 Stripe 직접 연동(카드)과 포트원 V1(카카오/네이버/토스페이)이 혼재되어 있으며, 구독 모델이 없어 반복 수익 구조가 불가능하고, 글로벌 사용자를 위한 통화/가격 분기가 없다. 포트원 V1 가맹점 ID도 플레이스홀더(`imp00000000`) 상태다.

이 스펙은 결제 인프라를 포트원 V2로 통합하고, 구독제 전용 모델을 구현하며, 한국/글로벌 가격·통화·결제수단을 locale 기반으로 자동 분기하는 시스템을 정의한다.

> **Note (2026-04-01)**: 건별 결제(990원)는 폐지됨. 구독제만 운영.

## 2. 목표 및 비목표

### 2.1 목표
- 포트원 V2 SDK로 결제 인프라 통합 (Stripe 직접 연동 + 포트원 V1 제거)
- 월/연 구독제 도입 (빌링키 기반 정기결제) — 건별 결제는 폐지
- 한국/글로벌 가격·통화·결제수단 자동 분기
- 구독 상태에 따른 기능 접근 제어 (리포트, 상담, 실천)
- 구독 라이프사이클 관리 (생성, 갱신, 해지, 만료)
- 포트원 웹훅으로 결제 상태 서버 사이드 검증

### 2.2 비목표
- 인앱 결제 (IAP) — Flutter 쉘의 앱스토어 결제는 이 스펙 범위 밖. 기존 PaymentBridge 코드는 유지하되 변경하지 않음
- 프로모션/쿠폰 시스템 리뉴얼 — 기존 coupons 테이블은 그대로 유지. 구독에 쿠폰 적용은 향후 과제
- i18n 전체 구현 — 결제 UI의 다국어/통화 분기만 이 스펙 범위. 설문·리포트·프롬프트 영문화는 별도 스펙
- 환불 자동화 — 초기에는 수동 환불 (포트원 관리자 콘솔). 자동 환불 API 연동은 향후 과제
- 세금계산서/영수증 발행 — 포트원 PG사가 자동 처리하는 범위만 의존

## 3. 변경 범위

### 3.1 신규 컴포넌트

- `app/src/lib/portone.ts` — 포트원 V2 서버 SDK 초기화, 결제 검증, 빌링키 발급/결제 유틸리티
- `app/src/app/api/payment/webhook/route.ts` — 포트원 웹훅 수신 엔드포인트
- `app/src/app/api/payment/subscribe/route.ts` — 구독 생성 (빌링키 발급 → 첫 결제)
- `app/src/app/api/payment/cancel-subscription/route.ts` — 구독 해지 요청
- `app/src/app/api/payment/billing/route.ts` — 정기결제 실행 (cron 또는 웹훅 트리거)
- `app/src/lib/subscription.ts` — 구독 상태 조회, 기능 접근 권한 판단 로직
- `app/src/app/pricing/page.tsx` — 요금제 선택 페이지 (건별/월구독/연구독)
- `app/src/app/settings/subscription/page.tsx` — 구독 관리 페이지 (현재 플랜, 해지, 결제 이력)
- `docs/migrations/007_subscriptions_payments.sql` — subscriptions, payments 테이블

### 3.2 수정 컴포넌트

- `app/src/app/payment/page.tsx` — Stripe Elements 제거, 포트원 V2 SDK 호출로 교체. 구독 결제 전용. locale 기반 가격/통화 표시
- `app/src/components/payment/CheckoutForm.tsx` — 삭제 (Stripe Elements 컴포넌트, 더 이상 불필요)
- `app/src/app/api/payment/create-intent/route.ts` — 삭제 (Stripe PaymentIntent → 포트원 결제 검증으로 대체)
- `app/src/app/payment/success/page.tsx` — Stripe redirect_status 파라미터 대신 포트원 paymentId로 검증
- `app/src/store/useAppStore.ts` — `isPaid: boolean` → `subscriptionTier: 'free' | 'single' | 'premium'` 확장. isPaid는 하위 호환용으로 computed getter 유지
- `app/src/lib/db.ts` — subscriptions/payments CRUD 함수 추가. 기존 coupon 관련 함수는 유지
- `app/src/types/supabase.ts` — subscriptions, payments 테이블 타입 추가
- `app/src/app/report/page.tsx` — `is_paid` 체크 → `hasAccess('report')` 함수로 교체 (구독자이거나 건별 구매한 리포트)
- `app/src/app/consult/page.tsx` — 상담 시작 전 `hasAccess('consult')` 체크 추가 (무료 월 2회 / 구독자 무제한)
- `app/src/app/layout.tsx` — 포트원 V2 SDK 스크립트 주입 (`https://cdn.portone.io/v2/browser-sdk.js`)
- `app/src/components/layout/BottomNav.tsx` — 구독 배지 표시 (선택적)
- `app/package.json` — `@portone/server-sdk` 추가, `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` 제거
- `docs/policies/payment.md` — 새 결제 정책 반영

### 3.3 변경 없음 (명시적 보존)

- `app/src/lib/openai.ts`, `app/src/lib/prompts.ts` — AI 리포트 생성 로직 변경 없음
- `app/src/app/api/consult/**` — 상담 API 라우트 로직 변경 없음 (접근 제어만 호출 측에서 추가)
- `app/src/store/surveyStore.ts` — 설문 스토어 변경 없음
- `app/src/lib/TemperamentScorer.ts`, `app/src/lib/TemperamentClassifier.ts` — 점수/분류 로직 변경 없음
- `app/src/components/auth/AuthProvider.tsx` — 인증 로직 변경 없음
- Flutter 앱 (`gijilai_app/`) — PaymentBridge 인터페이스 유지, 변경 없음
- `referrals`, `coupons` 테이블 및 관련 코드 — 기존 로직 유지

## 4. 데이터 모델

### 4.1 신규 테이블: `subscriptions`

```sql
create table public.subscriptions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('MONTHLY', 'YEARLY')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  billing_key text,                          -- 포트원 빌링키 (정기결제용)
  portone_customer_id text,                  -- 포트원 고객 ID
  currency text not null default 'KRW',      -- KRW | USD
  amount integer not null,                   -- 결제 금액 (원 또는 센트)
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancelled_at timestamptz,                  -- 해지 요청 시각 (기간 끝까지 유지)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 사용자당 활성 구독은 최대 1개
create unique index idx_subscriptions_active_user
  on public.subscriptions (user_id) where status in ('ACTIVE', 'PAST_DUE');
```

### 4.2 신규 테이블: `payments`

```sql
create table public.payments (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type text not null check (type in ('ONE_TIME', 'SUBSCRIPTION', 'RENEWAL')),
  portone_payment_id text unique,            -- 포트원 결제 ID
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  currency text not null default 'KRW',
  amount integer not null,
  pg_provider text,                          -- 'tosspayments' | 'stripe'
  pay_method text,                           -- 'card' | 'kakaopay' | 'tosspay' | 'naverpay' | 'googlepay' | 'applepay'
  paid_at timestamptz,
  failed_reason text,
  metadata jsonb,                            -- 리포트 ID, 쿠폰 ID 등
  created_at timestamptz default now()
);
```

### 4.3 기존 테이블 수정

**reports 테이블**: `is_paid` 컬럼 유지. 기존 로직과의 호환을 위해 삭제하지 않음. 구독자는 `is_paid` 값과 무관하게 모든 리포트 열람 가능 (조회 시 subscription 상태 조인).

**profiles 테이블**: 변경 없음. 구독 상태는 subscriptions 테이블에서 조회.

### 4.4 RLS 정책

```sql
-- subscriptions
alter table public.subscriptions enable row level security;
create policy "Users can view their own subscriptions."
  on public.subscriptions for select using (auth.uid() = user_id);
create policy "Service role can manage subscriptions."
  on public.subscriptions for all using (auth.role() = 'service_role');

-- payments
alter table public.payments enable row level security;
create policy "Users can view their own payments."
  on public.payments for select using (auth.uid() = user_id);
create policy "Service role can manage payments."
  on public.payments for all using (auth.role() = 'service_role');
```

## 5. 결제 모델 및 가격

### 5.1 가격표

| 상품 | 한국 (KRW) | 글로벌 (USD) | 상품 코드 |
|------|-----------|-------------|----------|
| 월 구독 | 12,000원 | $11.99 (1199센트) | `subscription_monthly` |
| 연 구독 | 89,000원 | $89.99 (8999센트) | `subscription_yearly` |

### 5.2 무료/유료 기능 매트릭스

| 기능 | 무료 | 구독 (MONTHLY/YEARLY) |
|------|------|----------------------|
| 기질 리포트 | O (전체 동일) | O |
| AI 상담 | 총 5회 (소진 시 종료) | 무제한 |
| 실천 기록 | 최근 1개만 | 전체 이력 |
| 리포트 재검사 쿨다운 | 7일 | 24시간 |

## 6. Locale 분기

### 6.1 판단 기준

```
locale 결정 순서:
1. URL 파라미터 `?locale=ko` 또는 `?locale=en` (최우선)
2. 브라우저 navigator.language (ko, ko-KR → 한국 / 그 외 → 글로벌)
3. 기본값: 글로벌 (en)
```

결정된 locale은 cookie(`gijilai_locale`)에 저장하여 이후 방문 시 유지한다. 유효기간: 365일.

### 6.2 Locale별 결제 설정

| 속성 | 한국 (ko) | 글로벌 (en) |
|------|----------|------------|
| PG사 | `tosspayments` | `stripe` |
| 통화 | KRW | USD |
| 간편결제 | 카카오페이, 토스페이, 네이버페이 | Google Pay, Apple Pay |
| 카드 결제 | O | O |
| 포트원 채널 키 | `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY` | `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE` |

## 7. 결제 플로우

### 7.1 구독 생성 (빌링키 방식)

```
[사용자] 구독 플랜 선택 (월/연)
  ↓
[클라이언트] PortOne.requestIssueBillingKey({
  storeId: PORTONE_STORE_ID,
  channelKey: locale === 'ko' ? TOSS_CHANNEL : STRIPE_CHANNEL,
  billingKeyMethod: locale === 'ko' ? "CARD" : "CARD",
  issueId: 클라이언트에서 생성한 UUID,
  customer: {
    customerId: user.id,
    fullName: user.name 또는 email local-part,
    email: user.email,
    phoneNumber: KG 이니시스 카드 선택 시 구매자 휴대폰 번호
  }
})
  ↓
[포트원 빌링키 발급창] 카드 정보 입력
  ↓
[클라이언트] billingKey 수신
  ↓
[클라이언트] POST /api/payment/subscribe { billingKey, plan, locale }
  ↓
[서버] 포트원 서버 SDK로 빌링키 결제 실행
  paymentId: `sub_${userId}_${timestamp}`
  amount: plan === 'MONTHLY' ? (locale === 'ko' ? 9900 : 999) : (locale === 'ko' ? 79000 : 7999)
  currency: locale === 'ko' ? 'KRW' : 'USD'
  ↓ 결제 성공
[서버] subscriptions INSERT (status: ACTIVE, period 계산)
[서버] payments INSERT (type: SUBSCRIPTION, status: PAID)
  ↓
[클라이언트] 구독 완료 확인 → 홈으로 이동
```

KG 이니시스 V2 카드 빌링키 발급은 PC 결제창에서 구매자 이름, 휴대폰 번호, 이메일이 필수다. 앱은 KG 이니시스 카드 선택 시에만 휴대폰 번호 입력란을 표시하고, 입력값은 PortOne 호출에만 사용하며 DB에 저장하지 않는다.

### 7.3 정기 갱신

```
[Cron / 서버] 매일 00:05 UTC 실행
  ↓
[서버] SELECT * FROM subscriptions
  WHERE status = 'ACTIVE'
  AND current_period_end <= now()
  AND cancelled_at IS NULL
  ↓
각 구독에 대해:
  [서버] 포트원 빌링키 결제 실행 (billing_key, amount, currency)
  ↓ 성공
  [서버] subscriptions UPDATE (period 갱신)
  [서버] payments INSERT (type: RENEWAL, status: PAID)
  ↓ 실패
  [서버] subscriptions UPDATE (status: PAST_DUE)
  [서버] payments INSERT (type: RENEWAL, status: FAILED, failed_reason)
  ↓
  재시도: PAST_DUE 상태에서 3일간 매일 1회 재시도
  ↓ 3회 모두 실패
  [서버] subscriptions UPDATE (status: EXPIRED)
```

### 7.4 구독 해지

```
[사용자] 설정 > 구독 관리 > 해지 버튼
  ↓
[클라이언트] POST /api/payment/cancel-subscription
  ↓
[서버] subscriptions UPDATE (cancelled_at: now())
  -- status는 ACTIVE 유지. current_period_end까지 서비스 제공
  ↓
[서버] current_period_end 도달 시 갱신 cron에서 감지
  → cancelled_at IS NOT NULL이므로 갱신 스킵
  → status: EXPIRED로 변경
```

### 7.5 해지 철회

```
[사용자] 설정 > 구독 관리 > 구독 계속하기 버튼
  ↓
[클라이언트] POST /api/payment/reactivate-subscription
  ↓
[서버] 기간 만료 전 ACTIVE/PAST_DUE + cancelled_at 존재 구독 조회
  ↓
[서버] PORTONE 구독이면 subscriptions UPDATE (cancelled_at: null)
  ↓
[다음 갱신 cron] 정상 갱신 대상에 포함
```

해지 철회는 새 구독 생성이나 즉시 결제가 아니라 기존 구독의 해지 예약을 취소하는 동작이다. 앱스토어/플레이스토어 구독은 스토어 구독 관리 화면에서 재활성화한다.

## 8. 구독 상태 머신

```
                    빌링키+첫결제 성공
  (없음) ─────────────────────────────→ ACTIVE
                                          │
                        ┌─────────────────┼─────────────────┐
                        │                 │                 │
                   갱신 성공          갱신 실패         해지 요청
                   (period 갱신)         │            (cancelled_at 설정)
                        │                ↓                 │
                        │           PAST_DUE               │
                        │              │                   │
                        │     ┌────────┼────────┐          │
                        │  재시도 성공  │    3회 실패       │
                        │     │        │        │          │
                        │     ↓        │        ↓          │
                        └→ ACTIVE      │    EXPIRED        │
                                       │                   │
                                       │    period 만료    │
                                       │    + cancelled    │
                                       │        ↓          │
                                       └──→ EXPIRED ←──────┘

  CANCELLED: 사용자가 즉시 해지를 명시적으로 요청한 경우 (현재 미사용, 향후 즉시해지 옵션용 예약)
```

**상태 전이표:**

| 현재 상태 | 이벤트 | 다음 상태 | 액션 |
|----------|--------|----------|------|
| (없음) | 첫 결제 성공 | ACTIVE | subscription 생성, payment 기록 |
| ACTIVE | 갱신 결제 성공 | ACTIVE | period 갱신, payment 기록 |
| ACTIVE | 갱신 결제 실패 | PAST_DUE | payment(FAILED) 기록, retry_count = 1 |
| ACTIVE | 해지 요청 | ACTIVE | cancelled_at 설정 (period 끝까지 유지) |
| ACTIVE + cancelled_at | 해지 철회 | ACTIVE | cancelled_at null 처리 |
| ACTIVE | period 만료 + cancelled_at 존재 | EXPIRED | status 변경 |
| PAST_DUE | 재시도 성공 | ACTIVE | period 갱신, payment 기록 |
| PAST_DUE | 재시도 실패 (3회 미만) | PAST_DUE | payment(FAILED) 기록, retry_count++ |
| PAST_DUE | 재시도 실패 (3회째) | EXPIRED | status 변경 |
| EXPIRED | 재구독 | ACTIVE | 새 subscription 생성 |

## 9. 접근 제어 로직

### 9.1 `hasAccess` 함수 (`app/src/lib/subscription.ts`)

```typescript
type Feature = 'premium_report' | 'consult' | 'practice_full' | 'no_cooldown';

async function hasAccess(userId: string, feature: Feature, resourceId?: string): Promise<boolean> {
  const sub = await getActiveSubscription(userId);

  switch (feature) {
    case 'premium_report':
      // 구독자: 무조건 true
      if (sub) return true;
      // 비구독자: 해당 리포트를 건별 구매했는지 확인
      if (!resourceId) return false;
      return await isReportPaid(userId, resourceId);

    case 'consult':
      // 구독자: 무제한
      if (sub) return true;
      // 비구독자: 이번 달 상담 횟수 < 2
      const count = await getMonthlyConsultCount(userId);
      return count < 2;

    case 'practice_full':
      return !!sub;

    case 'no_cooldown':
      return !!sub;
  }
}
```

### 9.2 `getActiveSubscription`

```typescript
async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  // status IN ('ACTIVE', 'PAST_DUE') AND current_period_end > now()
  // PAST_DUE도 period 내이면 서비스 유지 (유예 기간)
}
```

## 10. 환경 변수

| 변수명 | 용도 | 필수 |
|--------|------|------|
| `PORTONE_STORE_ID` | 포트원 상점 ID | O |
| `PORTONE_API_SECRET` | 포트원 V2 API Secret (서버용) | O |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 상점 ID (클라이언트용) | O |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KCP` | NHN KCP 채널 키 (클라이언트용) | O |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS` | KG 이니시스 채널 키 (클라이언트용) | O |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_TOSS` | 토스페이 채널 키 (클라이언트용) | O |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVERPAY` | 네이버페이 채널 키 (클라이언트용) | O |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_STRIPE` | Stripe 채널 키 (클라이언트용) | O |
| `PORTONE_WEBHOOK_SECRET` | 웹훅 검증 시크릿 | O |

제거 대상:
- `STRIPE_SECRET_KEY` — 포트원 경유로 대체
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — 포트원 SDK로 대체

## 11. 웹훅

### 11.1 엔드포인트

`POST /api/payment/webhook`

### 11.2 처리 로직

```
[포트원] POST /api/payment/webhook
  ↓
[서버] 웹훅 시그니처 검증 (PORTONE_WEBHOOK_SECRET)
  ↓ 실패 → 401 반환
[서버] event.type 분기:
  ↓
  "Transaction.Paid":
    → payments 테이블에서 portone_payment_id로 조회
    → status가 이미 PAID면 무시 (멱등성)
    → status를 PAID로 업데이트, paid_at 기록
    → type이 ONE_TIME이면 해당 report.is_paid = true
    → type이 SUBSCRIPTION/RENEWAL이면 subscription period 갱신

  "Transaction.Failed":
    → payments 테이블 status를 FAILED로 업데이트
    → failed_reason 기록

  "Transaction.Cancelled":
    → payments 테이블 status를 CANCELLED로 업데이트

  "BillingKey.Deleted":
    → 해당 billing_key를 가진 subscription의 billing_key를 null로
    → cancelled_at 설정 (카드 삭제 = 자동 해지 예약)

  기타 이벤트 → 200 반환 (무시)
  ↓
[서버] 모든 경우 200 반환 (포트원 재시도 방지)
```

### 11.3 멱등성

동일 `paymentId`에 대한 웹훅이 중복 수신될 수 있다. payments 테이블의 `portone_payment_id` UNIQUE 제약과 status 체크로 중복 처리를 방지한다.

## 12. API 엔드포인트

### 12.1 `POST /api/payment/verify`

결제 검증. 기존 `/api/payment/create-intent`를 대체. (건별 결제 폐지 후 레거시 호환용으로 유지)

**요청:**
```json
{
  "paymentId": "string",
  "reportId": "string (건별 구매 시 대상 리포트 ID)"
}
```

**처리:**
1. Supabase 세션 검증
2. 포트원 서버 SDK로 `paymentId` 결제 조회
3. 금액 검증: 조회 결과 amount === 예상 금액 (990 KRW 또는 499 USD)
4. 상태 검증: 조회 결과 status === "PAID"
5. payments INSERT, reports UPDATE (is_paid: true)

**응답 (성공):** `{ success: true }`
**응답 (실패):** `{ error: "INVALID_AMOUNT" | "PAYMENT_NOT_FOUND" | "ALREADY_PROCESSED" }`, status 400

### 12.2 `POST /api/payment/subscribe`

구독 생성.

**요청:**
```json
{
  "billingKey": "string",
  "plan": "MONTHLY | YEARLY",
  "locale": "ko | en"
}
```

**처리:**
1. Supabase 세션 검증
2. 기존 활성 구독 확인 → 있으면 에러
3. 금액 결정: plan + locale → amount, currency
4. 포트원 빌링키 결제 실행
5. subscriptions INSERT (ACTIVE), payments INSERT (SUBSCRIPTION, PAID)
6. period 계산: MONTHLY → +30일, YEARLY → +365일

**응답 (성공):** `{ success: true, subscription: { id, plan, currentPeriodEnd } }`
**응답 (실패):** `{ error: "ALREADY_SUBSCRIBED" | "BILLING_FAILED" | "INVALID_PLAN" }`, status 400

### 12.3 `POST /api/payment/cancel-subscription`

구독 해지 예약.

**요청:** (body 없음, 세션에서 userId 추출)

**처리:**
1. Supabase 세션 검증
2. 활성 구독 조회 → 없으면 에러
3. cancelled_at = now() 설정

**응답 (성공):** `{ success: true, activeUntil: "ISO date string" }`
**응답 (실패):** `{ error: "NO_ACTIVE_SUBSCRIPTION" }`, status 400

### 12.4 `POST /api/payment/reactivate-subscription`

해지 예약 철회.

**요청:** (body 없음, 세션에서 userId 추출)

**처리:**
1. Supabase 세션 검증
2. 기간 만료 전 ACTIVE/PAST_DUE + cancelled_at 존재 구독 조회
3. PORTONE 구독이면 cancelled_at = null 설정
4. 앱스토어/플레이스토어 구독이면 스토어 관리 필요 에러

**응답 (성공):** `{ success: true, subscription: { ... } }`
**응답 (실패):** `{ error: "NO_CANCELLED_SUBSCRIPTION" }`, status 400

### 12.5 `GET /api/payment/subscription`

현재 구독 상태 조회.

**처리:**
1. Supabase 세션 검증
2. 활성 구독 조회 (ACTIVE 또는 PAST_DUE, period 내)

**응답:** `{ subscription: { ... } | null }`

## 13. 클라이언트 결제 UI

### 13.1 요금제 선택 페이지 (`/pricing`)

```
┌─────────────────────────────────────────────┐
│  [Navbar: 요금제]                            │
│                                             │
│  "우리 아이를 더 깊이 이해하는 시간"            │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  월 구독     │  │  연 구독     │           │
│  │  ₩9,900/월  │  │  ₩79,000/년 │           │
│  │             │  │  ₩6,580/월  │           │
│  │             │  │  33% 할인    │           │
│  │  [구독하기]  │  │  [구독하기]  │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  혜택 목록:                                  │
│  - 프리미엄 리포트 무제한                     │
│  - AI 상담 무제한                            │
│  - 실천 기록 전체                            │
│  - 재검사 쿨다운 없음                        │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

글로벌(en) 버전:
- 가격: $11.99/month, $89.99/year ($7.50/month)
- 건별 옵션 숨김
- 텍스트 영문

### 13.2 결제 페이지 수정 (`/payment`)

기존 결제 페이지는 구독 결제 전용으로 변경:
- Stripe Elements (CheckoutForm) 제거
- 포트원 `PortOne.requestIssueBillingKey()` 호출로 교체
- 결제수단 선택 UI는 포트원 결제창이 대체 (커스텀 UI 불필요)

### 13.3 구독 관리 페이지 (`/settings/subscription`)

```
┌─────────────────────────────────────────────┐
│  [Navbar: 구독 관리]                         │
│                                             │
│  현재 플랜: 월 구독 (ACTIVE)                  │
│  다음 결제일: 2026-04-25                     │
│  결제 금액: ₩9,900                           │
│                                             │
│  [구독 해지]                                 │
│  해지해도 2026-04-25까지 이용 가능합니다       │
│                                             │
│  ── 결제 이력 ──                             │
│  2026-03-25  ₩9,900  월 구독  성공           │
│  2026-03-20  ₩990    리포트   성공           │
│                                             │
└─────────────────────────────────────────────┘
```

## 14. 정기결제 Cron

### 14.1 실행 방식

Vercel Cron Jobs 또는 외부 cron 서비스에서 매일 `POST /api/payment/billing`을 호출한다.

### 14.2 `/api/payment/billing` 처리

```
인증: Authorization 헤더에 CRON_SECRET 확인
  ↓
SELECT * FROM subscriptions
WHERE status IN ('ACTIVE', 'PAST_DUE')
  AND current_period_end <= now()
  AND cancelled_at IS NULL
  AND billing_key IS NOT NULL
  ↓
각 구독:
  cancelled_at IS NOT NULL → status = 'EXPIRED', 스킵
  ↓
  포트원 빌링키 결제 실행
  ↓ 성공
    period 갱신, payment 기록, status = 'ACTIVE'
  ↓ 실패
    PAST_DUE 상태에서 retry_count 확인 (payments 테이블에서 최근 FAILED 건수)
    3회 이상 → status = 'EXPIRED'
    미만 → status = 'PAST_DUE' 유지, payment(FAILED) 기록
```

### 14.3 Cron 인증

```
CRON_SECRET 환경 변수.
요청 헤더: Authorization: Bearer ${CRON_SECRET}
불일치 시 401 반환.
```

## 15. 실패 모델 및 복구

| 실패 유형 | 감지 방법 | 복구 액션 |
|----------|----------|----------|
| 빌링키 발급 실패 | PortOne.requestIssueBillingKey 에러 반환 | 클라이언트에서 에러 표시, 재시도 유도 |
| 구독 첫 결제 실패 | 포트원 빌링키 결제 API 에러 | subscription 생성하지 않음, 클라이언트에 에러 표시 |
| 정기 갱신 실패 | cron에서 결제 API 에러 | PAST_DUE, 3일간 재시도 (총 3회) |
| 3회 재시도 모두 실패 | retry_count >= 3 | EXPIRED, 사용자에게 이메일/알림 (향후 구현) |
| 웹훅 시그니처 불일치 | HMAC 검증 실패 | 401 반환, 로그 기록, 처리하지 않음 |
| 웹훅 중복 수신 | portone_payment_id 중복 | 기존 상태 유지, 200 반환 (멱등성) |
| 포트원 API 타임아웃 | 10초 timeout | 에러 로그, 다음 cron 주기에 재시도 |

## 16. 보안

- 모든 결제 검증은 서버 사이드에서 수행. 클라이언트 응답만으로 결제 완료 처리하지 않음
- 포트원 API Secret은 서버 환경 변수에만 저장. 클라이언트에 노출 금지
- 웹훅은 시그니처 검증 후에만 처리
- 금액 검증: 서버에서 조회한 결제 금액과 상품 가격표를 대조. 클라이언트가 보낸 금액을 신뢰하지 않음
- 사용자당 활성 구독은 DB unique index로 1개 제한

## 17. 정책 변경

### 신규 정책
- 구독 플랜: MONTHLY (₩12,000/$11.99), YEARLY (₩89,000/$89.99)
- 구독 해지: 즉시 해지 아닌 기간 만료 해지 (cancelled_at 방식)
- 갱신 실패 유예: 3일간 재시도, 3회 실패 시 만료
- 무료 상담 제한: 월 2회
- 구독자 재검사 쿨다운: 없음

### 수정 정책 (기존 → 변경)
- 결제 방식: Stripe PaymentIntent → 포트원 V2
- 건별 결제: 폐지 (구독 전용으로 전환)
- 무료 사용자 쿨다운: 7일 (유지)
- 구독 사용자 쿨다운: 없음

## 18. 패키지 변경

### 추가
```
@portone/server-sdk    -- 포트원 V2 서버 SDK (결제 조회, 빌링키 결제)
```

### 제거
```
stripe                 -- Stripe 서버 SDK
@stripe/stripe-js      -- Stripe 클라이언트 SDK
@stripe/react-stripe-js -- Stripe React 컴포넌트
```

### 클라이언트 SDK
포트원 V2 브라우저 SDK는 npm 패키지가 아닌 CDN 스크립트로 로드:
```html
<script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
```
`app/src/app/layout.tsx`의 `<head>`에 추가.

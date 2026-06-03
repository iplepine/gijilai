-- ============================================
-- 021: 앱 심사용 데모 계정 구독 부여 + 매출 지표 제외
-- 문서: docs/operations/RELEASE_READINESS.md (앱 심사 계정 섹션)
--
-- 심사 대응은 계정 2개로 운영한다.
--   (A) 구독 데모 계정  review@test.com      → 결제 없이 유료 기능 전체 확인 (이 SQL이 처리)
--   (B) 결제 테스트 계정 review-pay@test.com → 구독 결제 플로우 직접 확인 (DB 처리 없음, 샌드박스/테스트 결제)
--
-- (A)에는 만료 먼 미래(2099)의 ACTIVE 구독을 박고 portone_customer_id='APP_REVIEW'로 표시한다.
-- 이 마커로 IAP/포트원 동기화 대상에서 제외하고, 매출 지표 뷰에서도 제외한다.
-- 재실행 안전: 이미 활성 구독이 있으면 갱신만 한다.
-- ============================================

-- 1. 구독 데모 계정(A)에 먼 미래 활성 구독 부여 (계정이 가입돼 있어야 함)
do $$
declare
  reviewer_id uuid;
begin
  select id into reviewer_id from public.profiles where email = 'review@test.com' limit 1;

  if reviewer_id is null then
    raise notice '[021] review@test.com 프로필이 없습니다. 앱에서 먼저 가입한 뒤 이 마이그레이션을 다시 실행하세요.';
    return;
  end if;

  -- 기존 심사용 행이 있으면 갱신, 없으면 생성
  if exists (
    select 1 from public.subscriptions
    where user_id = reviewer_id and portone_customer_id = 'APP_REVIEW'
  ) then
    update public.subscriptions
    set status = 'ACTIVE',
        plan = 'MONTHLY',
        amount = 0,
        currency = 'KRW',
        current_period_start = now(),
        current_period_end = '2099-12-31'::timestamptz,
        cancelled_at = null,
        updated_at = now()
    where user_id = reviewer_id and portone_customer_id = 'APP_REVIEW';
    raise notice '[021] 심사 데모 구독을 갱신했습니다 (review@test.com).';
  else
    -- 사용자당 활성 구독 1개 유니크 제약: 기존 활성 구독이 있으면 충돌 → 심사 계정엔 보통 없음
    insert into public.subscriptions (
      user_id, plan, status, amount, currency,
      current_period_start, current_period_end, portone_customer_id
    ) values (
      reviewer_id, 'MONTHLY', 'ACTIVE', 0, 'KRW',
      now(), '2099-12-31'::timestamptz, 'APP_REVIEW'
    );
    raise notice '[021] 심사 데모 구독을 생성했습니다 (review@test.com).';
  end if;
end$$;

-- 2. 매출 지표 뷰에서 심사 계정 제외 (APP_REVIEW 마커)
create or replace view public.v_subscription_renewal_rate as
select
  s.user_id,
  s.id as subscription_id,
  s.plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancelled_at,
  (select count(*)::int
   from public.payments p
   where p.subscription_id = s.id
     and p.type = 'RENEWAL'
     and p.status = 'PAID') as renewal_count
from public.subscriptions s
where coalesce(s.portone_customer_id, '') <> 'APP_REVIEW';  -- 심사 데모 구독 제외

comment on view public.v_subscription_renewal_rate is
  '구독별 갱신 카운트. 코호트별 LTV·이탈 추적에 사용. 심사용(APP_REVIEW) 구독은 제외.';

revoke all on public.v_subscription_renewal_rate from public, anon, authenticated;
grant select on public.v_subscription_renewal_rate to service_role;

-- 참고: 결제 테스트 계정(B, review-pay@test.com)은 DB 처리가 없다.
-- 구독되지 않은 상태로 두고, Apple Sandbox / Google 라이선스 테스터로 등록해
-- 청구 없이 결제 플로우를 끝까지 확인한다.

-- ============================================
-- 024: 동시 활성 구독 중복 방지
-- /api/payment/subscribe의 "기존 구독 확인 → 생성" 사이에 레이스가 있어
-- (결제 버튼 더블탭 등) 같은 유저에게 ACTIVE 구독이 2개 생기고
-- 두 번 결제될 수 있다. partial unique index로 DB 레벨에서 차단한다.
-- 서버 코드는 unique 위반(23505)을 ALREADY_SUBSCRIBED로 처리하고 결제를 자동 환불한다.
--
-- 주의: 기존에 중복 ACTIVE/PAST_DUE 구독이 있으면 인덱스 생성이 실패하므로,
--       가장 최근 1건만 남기고 나머지를 먼저 CANCELLED 처리한다.
-- 재실행 안전: if not exists 가드, 정리 update는 멱등.
-- ============================================

-- 1. 기존 중복 정리 (유저별 최신 1건만 유지)
with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at desc) as rn
  from public.subscriptions
  where status in ('ACTIVE', 'PAST_DUE')
)
update public.subscriptions s
set status = 'CANCELLED',
    cancelled_at = coalesce(s.cancelled_at, now()),
    updated_at = now()
from ranked r
where s.id = r.id
  and r.rn > 1;

-- 2. 유저당 활성 구독 1개 제약
create unique index if not exists idx_subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status in ('ACTIVE', 'PAST_DUE');

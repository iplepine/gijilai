-- ============================================
-- 017: 북극성 지표 + 보조 지표 (축소판)
--
-- 의도: 다른 모든 리텐션 실험의 효과를 측정할 단일 기준선을 마련한다.
--   • v_north_star_d7   "결제 후 D7 내 관찰 기록 1회 이상 작성률"
--   • v_d7_d30_retention "가입 후 D7 / D30 활성 사용자 비율" (관찰·실천·상담 활동 기준)
--   • v_subscription_renewal_rate "월 구독자의 다음 결제 갱신율"
--
-- 모두 service_role에서만 select 가능 (운영자 대시보드용).
-- ============================================

-- --------------------------------------------
-- 1) 북극성 지표: 결제 후 D7 관찰 작성률
--
-- 첫 결제 시점을 기준으로 사용자별 D7 내 첫 관찰 기록 작성 여부를 계산.
-- 결제 이력이 없는 사용자는 제외.
-- --------------------------------------------
CREATE OR REPLACE VIEW public.v_north_star_d7 AS
WITH first_payment AS (
  SELECT
    user_id,
    MIN(created_at) AS first_paid_at
  FROM public.payments
  WHERE status = 'PAID'
    AND type IN ('SUBSCRIPTION', 'RENEWAL', 'ONE_TIME')
  GROUP BY user_id
),
first_observation_after_payment AS (
  SELECT
    o.user_id,
    MIN(o.created_at) AS first_obs_after_paid_at
  FROM public.observations o
  INNER JOIN first_payment fp ON fp.user_id = o.user_id
  WHERE o.created_at >= fp.first_paid_at
    AND o.created_at < fp.first_paid_at + INTERVAL '7 days'
  GROUP BY o.user_id
)
SELECT
  fp.user_id,
  fp.first_paid_at,
  foa.first_obs_after_paid_at,
  (foa.first_obs_after_paid_at IS NOT NULL) AS qualified_d7
FROM first_payment fp
LEFT JOIN first_observation_after_payment foa USING (user_id);

COMMENT ON VIEW public.v_north_star_d7 IS
  '북극성 지표: 결제 후 D7 이내 관찰 기록 1회 이상 작성 여부 (qualified_d7).';

-- --------------------------------------------
-- 2) D7 / D30 리텐션 (가입 기준, 활동 = 관찰·실천·상담)
-- --------------------------------------------
CREATE OR REPLACE VIEW public.v_d7_d30_retention AS
WITH user_activity AS (
  SELECT user_id, created_at FROM public.observations
  UNION ALL
  SELECT user_id, created_at FROM public.practice_logs
  UNION ALL
  SELECT user_id, created_at FROM public.consultations
),
signup AS (
  SELECT id AS user_id, created_at AS signed_up_at FROM public.profiles
)
SELECT
  s.user_id,
  s.signed_up_at,
  EXISTS (
    SELECT 1 FROM user_activity ua
    WHERE ua.user_id = s.user_id
      AND ua.created_at >= s.signed_up_at + INTERVAL '6 days'
      AND ua.created_at <  s.signed_up_at + INTERVAL '8 days'
  ) AS active_at_d7,
  EXISTS (
    SELECT 1 FROM user_activity ua
    WHERE ua.user_id = s.user_id
      AND ua.created_at >= s.signed_up_at + INTERVAL '29 days'
      AND ua.created_at <  s.signed_up_at + INTERVAL '31 days'
  ) AS active_at_d30
FROM signup s;

COMMENT ON VIEW public.v_d7_d30_retention IS
  '가입 후 D7±1 / D30±1 활성 사용자 (관찰·실천·상담 중 1건 이상).';

-- --------------------------------------------
-- 3) 월 구독 갱신율 (보조 지표)
-- --------------------------------------------
CREATE OR REPLACE VIEW public.v_subscription_renewal_rate AS
SELECT
  s.user_id,
  s.id AS subscription_id,
  s.plan,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.cancelled_at,
  (SELECT COUNT(*)::int
   FROM public.payments p
   WHERE p.subscription_id = s.id
     AND p.type = 'RENEWAL'
     AND p.status = 'PAID') AS renewal_count
FROM public.subscriptions s;

COMMENT ON VIEW public.v_subscription_renewal_rate IS
  '구독별 갱신 카운트. 코호트별 LTV·이탈 추적에 사용.';

-- --------------------------------------------
-- 권한: service_role만 select
-- --------------------------------------------
REVOKE ALL ON public.v_north_star_d7              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_d7_d30_retention           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_subscription_renewal_rate  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_north_star_d7              TO service_role;
GRANT SELECT ON public.v_d7_d30_retention           TO service_role;
GRANT SELECT ON public.v_subscription_renewal_rate  TO service_role;

-- ============================================
-- 007: 구독 및 결제 시스템
-- ============================================

-- 1. subscriptions: 구독 정보
create table public.subscriptions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('MONTHLY', 'YEARLY')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
  billing_key text,
  portone_customer_id text,
  currency text not null default 'KRW',
  amount integer not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 사용자당 활성 구독은 최대 1개
create unique index idx_subscriptions_active_user
  on public.subscriptions (user_id) where status in ('ACTIVE', 'PAST_DUE');

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscriptions."
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions."
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- 2. payments: 결제 이력
create table public.payments (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type text not null check (type in ('ONE_TIME', 'SUBSCRIPTION', 'RENEWAL')),
  portone_payment_id text unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  currency text not null default 'KRW',
  amount integer not null,
  pg_provider text,
  pay_method text,
  paid_at timestamptz,
  failed_reason text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;

create policy "Users can view their own payments."
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Service role can manage payments."
  on public.payments for all
  using (auth.role() = 'service_role');

-- 3. 인덱스
create index idx_payments_user_id on public.payments (user_id);
create index idx_payments_subscription_id on public.payments (subscription_id);
create index idx_subscriptions_status on public.subscriptions (status, current_period_end);

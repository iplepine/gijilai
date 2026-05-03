-- ============================================
-- 011: 구독 유료 기능 사용 이력
-- ============================================

create table public.subscription_usage_events (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  feature text not null check (feature in ('AI_CONSULTATION', 'PRACTICE_HISTORY')),
  event_name text not null check (event_name in (
    'CONSULT_QUESTIONS_INITIAL',
    'CONSULT_QUESTIONS_FOLLOWUP',
    'CONSULT_PRESCRIPTION',
    'PRACTICE_HISTORY_VIEW'
  )),
  resource_type text,
  resource_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.subscription_usage_events enable row level security;

create policy "Users can view their own subscription usage events."
  on public.subscription_usage_events for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscription usage events."
  on public.subscription_usage_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index idx_subscription_usage_events_user_created
  on public.subscription_usage_events (user_id, created_at desc);

create index idx_subscription_usage_events_subscription_created
  on public.subscription_usage_events (subscription_id, created_at desc);

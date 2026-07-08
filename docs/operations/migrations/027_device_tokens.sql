-- ============================================
-- 027: 기기 푸시 토큰(device_tokens) — Phase 2 (공동양육자 FCM 푸시)
-- 정책: docs/product/policies/co-parent.md §공동양육자 알림, ADR 2026-07-07
--
-- 목적: FCM 원격 푸시를 위해 사용자별 기기 등록 토큰을 저장한다.
--       인앱 알림(026)이 이미 relational 도달을 담당하고, 이 테이블은 그 알림을
--       기기 푸시로 확장하는 발송 대상(수신자 토큰) 조회에 쓰인다.
--
-- 설계:
--  - 토큰은 기기당 고유(unique). 같은 기기에서 계정을 바꾸면 onConflict(token)로 user_id 재매핑.
--  - 등록/삭제는 인증된 사용자 본인만(RLS). 서버(API)는 세션 user_id로 스코프한 admin upsert 사용.
--  - 발송 선호: profiles.coparent_push_enabled(기본 true) — 디스패처가 이 값을 확인.
--  - 재실행 안전: create ... if not exists / add column if not exists.
-- ============================================

create table if not exists public.device_tokens (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,                                         -- FCM registration token
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_tokens_user on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "User can view own device tokens." on public.device_tokens;
create policy "User can view own device tokens."
  on public.device_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "User can insert own device tokens." on public.device_tokens;
create policy "User can insert own device tokens."
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "User can update own device tokens." on public.device_tokens;
create policy "User can update own device tokens."
  on public.device_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "User can delete own device tokens." on public.device_tokens;
create policy "User can delete own device tokens."
  on public.device_tokens for delete
  using (auth.uid() = user_id);

-- 공동양육자 푸시 수신 선호(기본 ON). 인앱 알림은 항상 남고, 이 값은 기기 푸시 발송만 좌우한다.
alter table public.profiles
  add column if not exists coparent_push_enabled boolean not null default true;

-- ============================================
-- 019: 양육자 자신을 위한 상담 (self-parent consultation)
-- 기획: docs/product/SELF_PARENT_CONSULTATION_PLAN.html
-- 정책: docs/product/policies/self-parent.md
-- ADR 2026-05-31
--
-- 기존 consultation 자산(sessions / consultations / practice_items)에
-- type 컬럼을 추가해 아이 상담(CHILD)과 양육자 자기 상담(SELF_PARENT)을 구분한다.
-- 별도 테이블을 만들지 않고 기존 RLS(user_id 기반)와 co-parent 가시성 정책을 재사용한다.
-- 재실행 안전: 모든 구문은 if not exists / drop ... if exists 가드를 둔다.
-- ============================================

-- 1. consultation_sessions.type
alter table public.consultation_sessions
  add column if not exists type text not null default 'CHILD';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'consultation_sessions_type_check'
  ) then
    alter table public.consultation_sessions
      add constraint consultation_sessions_type_check
      check (type in ('CHILD', 'SELF_PARENT'));
  end if;
end$$;

-- 2. consultations.type
alter table public.consultations
  add column if not exists type text not null default 'CHILD';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'consultations_type_check'
  ) then
    alter table public.consultations
      add constraint consultations_type_check
      check (type in ('CHILD', 'SELF_PARENT'));
  end if;
end$$;

-- 3. practice_items.type
alter table public.practice_items
  add column if not exists type text not null default 'CHILD';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'practice_items_type_check'
  ) then
    alter table public.practice_items
      add constraint practice_items_type_check
      check (type in ('CHILD', 'SELF_PARENT'));
  end if;
end$$;

-- 4. 인덱스 — 타입별 조회 (홈/실천/기록에서 CHILD vs SELF_PARENT 분리)
create index if not exists idx_consultation_sessions_user_type
  on public.consultation_sessions (user_id, type);

create index if not exists idx_consultations_user_type
  on public.consultations (user_id, type);

-- 5. self-parent 상담은 child_id가 없을 수 있다.
--    기존 child_id는 이미 nullable이므로 스키마 변경 없음.
--    (self-parent 상담은 특정 아이 맥락 없이 양육자 본인 마음을 다룬다.
--     단, 선택적으로 child_id를 연결해 Phase 3 cross-context에 쓸 수 있다.)

-- 6. self-parent 위기 감지 로그 (선택적 — 위기 신호 발생 빈도 운영 관찰용, 개인정보 미저장)
create table if not exists public.self_reflection_safety_events (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('SELF_HARM', 'VIOLENCE', 'PERSISTENT_DISTRESS')),
  created_at timestamptz not null default now()
);

alter table public.self_reflection_safety_events enable row level security;

drop policy if exists "Users can view own safety events." on public.self_reflection_safety_events;
create policy "Users can view own safety events."
  on public.self_reflection_safety_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own safety events." on public.self_reflection_safety_events;
create policy "Users can insert own safety events."
  on public.self_reflection_safety_events for insert
  with check (auth.uid() = user_id);

create index if not exists idx_self_reflection_safety_events_user
  on public.self_reflection_safety_events (user_id, created_at);

-- 주의: 이 테이블에는 자유 텍스트 원문을 저장하지 않는다. 카테고리와 시점만 남긴다.

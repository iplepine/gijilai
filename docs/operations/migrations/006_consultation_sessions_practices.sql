-- ============================================
-- 006: 상담 세션 & 실천 시스템
-- ============================================

-- 1. consultation_sessions: 고민별 상담 스레드
create table public.consultation_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  title text not null,
  status text default 'ACTIVE' check (status in ('ACTIVE', 'RESOLVED', 'ARCHIVED')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

alter table public.consultation_sessions enable row level security;

create policy "Users can view their own sessions."
  on public.consultation_sessions for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own sessions."
  on public.consultation_sessions for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own sessions."
  on public.consultation_sessions for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own sessions."
  on public.consultation_sessions for delete
  using ( auth.uid() = user_id );

-- 2. consultations에 session_id 추가
alter table public.consultations
  add column session_id uuid references public.consultation_sessions(id) on delete set null;

-- user_response 컬럼 (코드에서 사용 중이나 스키마에 없었음)
alter table public.consultations
  add column if not exists user_response jsonb;

-- 3. practice_items: 실천 항목
create table public.practice_items (
  id uuid not null default gen_random_uuid(),
  session_id uuid not null references public.consultation_sessions(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  title text not null,
  description text not null,
  duration integer not null check (duration between 1 and 14),
  encouragement text,
  status text default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'DROPPED')),
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.practice_items enable row level security;

create policy "Users can view their own practice items."
  on public.practice_items for select
  using (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id and cs.user_id = auth.uid()
    )
  );

create policy "Users can insert their own practice items."
  on public.practice_items for insert
  with check (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id and cs.user_id = auth.uid()
    )
  );

create policy "Users can update their own practice items."
  on public.practice_items for update
  using (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id and cs.user_id = auth.uid()
    )
  );

-- 4. practice_logs: 일일 실천 체크
create table public.practice_logs (
  id uuid not null default gen_random_uuid(),
  practice_id uuid not null references public.practice_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  done boolean not null default false,
  memo text,
  created_at timestamptz default now(),
  primary key (id),
  unique (practice_id, date)
);

alter table public.practice_logs enable row level security;

create policy "Users can view their own practice logs."
  on public.practice_logs for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own practice logs."
  on public.practice_logs for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own practice logs."
  on public.practice_logs for update
  using ( auth.uid() = user_id );

-- 5. practice_reviews: 종합 회고
create table public.practice_reviews (
  id uuid not null default gen_random_uuid(),
  practice_id uuid not null references public.practice_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.practice_reviews enable row level security;

create policy "Users can view their own practice reviews."
  on public.practice_reviews for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own practice reviews."
  on public.practice_reviews for insert
  with check ( auth.uid() = user_id );

-- 6. 기존 consultations → ARCHIVED 세션으로 마이그레이션
do $$
declare
  rec record;
  new_session_id uuid;
begin
  for rec in
    select id, user_id, child_id, problem_description, created_at
    from public.consultations
    where session_id is null and status = 'COMPLETED'
  loop
    insert into public.consultation_sessions (user_id, child_id, title, status, created_at, updated_at)
    values (
      rec.user_id,
      rec.child_id,
      left(coalesce(rec.problem_description, '과거 상담'), 30),
      'ARCHIVED',
      rec.created_at,
      rec.created_at
    )
    returning id into new_session_id;

    update public.consultations
    set session_id = new_session_id
    where id = rec.id;
  end loop;
end;
$$;

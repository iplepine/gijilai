-- ============================================
-- 018: 공동양육자(co-parent) 비대칭 초대 모델
-- ADR 2026-05-31 — Option C (asymmetric invite)
-- 정책: docs/product/policies/co-parent.md
-- ============================================

-- 1. 호칭 enum (MOM | DAD | CARER) — owner와 co_parent 양쪽이 선택
do $$
begin
  if not exists (select 1 from pg_type where typname = 'caregiver_label') then
    create type public.caregiver_label as enum ('MOM', 'DAD', 'CARER');
  end if;
end$$;

-- owner의 호칭은 children에 직접 둔다(아이별로 다를 수 있어서 children 단위)
alter table public.children
  add column if not exists owner_label public.caregiver_label;

-- 2. child_co_parents: 한 아이당 1명의 공동양육자 연결
create table if not exists public.child_co_parents (
  id uuid not null default gen_random_uuid() primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  co_parent_id uuid references public.profiles(id) on delete cascade, -- null while PENDING
  invite_token text not null unique,
  label public.caregiver_label,                                         -- 수락 시 채워짐
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz
);

-- 한 아이당 동시 ACCEPTED는 1개만 (1:1)
create unique index if not exists idx_child_co_parents_accepted_unique
  on public.child_co_parents (child_id)
  where status = 'ACCEPTED';

-- 한 아이당 동시 PENDING(미만료)는 1개만 — 새 초대 시 기존 PENDING은 REVOKED 처리
create unique index if not exists idx_child_co_parents_pending_unique
  on public.child_co_parents (child_id)
  where status = 'PENDING';

create index if not exists idx_child_co_parents_co_parent_id
  on public.child_co_parents (co_parent_id)
  where status = 'ACCEPTED';

create index if not exists idx_child_co_parents_invite_token
  on public.child_co_parents (invite_token);

create index if not exists idx_child_co_parents_invited_by
  on public.child_co_parents (invited_by);

alter table public.child_co_parents enable row level security;

-- owner는 본인이 발급한 모든 초대 행 select/update/delete
create policy "Owner can view their invites."
  on public.child_co_parents for select
  using (auth.uid() = invited_by);

create policy "Owner can insert invites for own child."
  on public.child_co_parents for insert
  with check (
    auth.uid() = invited_by
    and exists (
      select 1 from public.children c
      where c.id = child_co_parents.child_id and c.parent_id = auth.uid()
    )
  );

create policy "Owner can update their invites."
  on public.child_co_parents for update
  using (auth.uid() = invited_by);

create policy "Owner can delete their invites."
  on public.child_co_parents for delete
  using (auth.uid() = invited_by);

-- co-parent 본인은 자신과 연결된 행 select/update(본인 연결 해제)
create policy "Co-parent can view own membership."
  on public.child_co_parents for select
  using (auth.uid() = co_parent_id and status = 'ACCEPTED');

create policy "Co-parent can revoke own membership."
  on public.child_co_parents for update
  using (auth.uid() = co_parent_id and status = 'ACCEPTED');

-- 3. 권한 헬퍼: 현재 사용자가 해당 아이의 co-parent인가
create or replace function public.is_child_co_parent(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.child_co_parents
    where child_id = target_child_id
      and co_parent_id = auth.uid()
      and status = 'ACCEPTED'
  );
$$;

grant execute on function public.is_child_co_parent(uuid) to authenticated, service_role;

-- 4. 다운스트림 RLS — 기존 정책은 건드리지 않고 co-parent 전용 정책을 추가한다.
--    Postgres RLS는 동일 명령에 대해 여러 PERMISSIVE 정책을 OR로 결합한다.

-- 4-1. children: co-parent는 연결된 아이를 SELECT만 가능 (수정/삭제는 owner only)
create policy "Co-parent can view linked children."
  on public.children for select
  using (public.is_child_co_parent(id));

-- 4-2. surveys
create policy "Co-parent can view child surveys."
  on public.surveys for select
  using (public.is_child_co_parent(child_id));

-- co-parent가 본인 설문(예: 양육자 기질 ATQ)을 작성하는 경우는
-- 본인 user_id 기준으로 기존 insert/update 정책이 이미 허용한다. 추가 정책 불필요.

-- 4-3. reports
create policy "Co-parent can view child reports."
  on public.reports for select
  using (public.is_child_co_parent(child_id));

-- 4-4. consultations
create policy "Co-parent can view child consultations."
  on public.consultations for select
  using (public.is_child_co_parent(child_id));

create policy "Co-parent can insert child consultations."
  on public.consultations for insert
  with check (
    auth.uid() = user_id
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

create policy "Co-parent can update own child consultations."
  on public.consultations for update
  using (
    auth.uid() = user_id
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 4-5. consultation_sessions
create policy "Co-parent can view child sessions."
  on public.consultation_sessions for select
  using (public.is_child_co_parent(child_id));

create policy "Co-parent can insert child sessions."
  on public.consultation_sessions for insert
  with check (
    auth.uid() = user_id
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 세션 상태(RESOLVED 처리 등)는 양쪽 다 변경 가능
create policy "Co-parent can update child sessions."
  on public.consultation_sessions for update
  using (
    child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 4-6. action_items
create policy "Co-parent can view child action items."
  on public.action_items for select
  using (
    child_id is not null
    and public.is_child_co_parent(child_id)
  );

create policy "Co-parent can insert child action items."
  on public.action_items for insert
  with check (
    auth.uid() = user_id
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

create policy "Co-parent can update child action items."
  on public.action_items for update
  using (
    child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 4-7. practice_items (session_id를 통해 child_id 조인)
create policy "Co-parent can view child practice items."
  on public.practice_items for select
  using (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

create policy "Co-parent can insert child practice items."
  on public.practice_items for insert
  with check (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

create policy "Co-parent can update child practice items."
  on public.practice_items for update
  using (
    exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

-- 4-8. practice_logs (실천 체크) — 본인 user_id로 쓰기, 양쪽 다 읽기
create policy "Co-parent can view child practice logs."
  on public.practice_logs for select
  using (
    exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_logs.practice_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

create policy "Co-parent can insert child practice logs."
  on public.practice_logs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_logs.practice_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

create policy "Co-parent can update own practice logs."
  on public.practice_logs for update
  using (auth.uid() = user_id);

-- 4-9. practice_reviews — 본인 user_id로 쓰기, 양쪽 다 읽기
create policy "Co-parent can view child practice reviews."
  on public.practice_reviews for select
  using (
    exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_reviews.practice_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

create policy "Co-parent can insert child practice reviews."
  on public.practice_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_reviews.practice_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

-- 4-10. observations (관찰일지)
-- observations 테이블은 별도 위치에서 생성되지만 RLS는 user_id 기반.
-- 정책은 IF 조건부로 추가 — observations 테이블이 없으면 skip.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'observations'
  ) then
    -- 기존 동명 정책이 있으면 한 번 정리하고 재생성
    execute 'drop policy if exists "Co-parent can view child observations." on public.observations';
    execute $POL$
      create policy "Co-parent can view child observations."
        on public.observations for select
        using (
          child_id is not null
          and public.is_child_co_parent(child_id)
        )
    $POL$;

    execute 'drop policy if exists "Co-parent can insert child observations." on public.observations';
    execute $POL$
      create policy "Co-parent can insert child observations."
        on public.observations for insert
        with check (
          auth.uid() = user_id
          and child_id is not null
          and public.is_child_co_parent(child_id)
        )
    $POL$;
  end if;
end$$;

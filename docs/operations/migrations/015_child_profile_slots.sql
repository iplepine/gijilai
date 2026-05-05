-- 015: Free-plan child profile slot enforcement
-- Free users get one lifetime child profile slot. Trial and active subscribers
-- can create/delete multiple children while access is active.

create table if not exists public.child_profile_slots (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_child_profile_slots_child_id
  on public.child_profile_slots (child_id)
  where child_id is not null;

create index if not exists idx_child_profile_slots_user_id
  on public.child_profile_slots (user_id);

insert into public.child_profile_slots (user_id, child_id, created_at)
select c.parent_id, c.id, c.created_at
from public.children c
where not exists (
  select 1
  from public.child_profile_slots s
  where s.child_id = c.id
);

alter table public.child_profile_slots enable row level security;

drop policy if exists "Users can view their child profile slots." on public.child_profile_slots;
create policy "Users can view their child profile slots."
  on public.child_profile_slots for select
  using (auth.uid() = user_id);

create or replace function public.has_child_profile_full_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.created_at > now() - interval '7 days'
  ) or exists (
    select 1
    from public.subscriptions s
    where s.user_id = target_user_id
      and s.status in ('ACTIVE', 'PAST_DUE')
      and s.current_period_end >= now()
  );
$$;

create or replace function public.child_profile_slot_count(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.child_profile_slots
  where user_id = target_user_id;
$$;

create or replace function public.child_profile_count(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.children
  where parent_id = target_user_id;
$$;

create or replace function public.enforce_child_profile_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.parent_id::text, 0));

  if not public.has_child_profile_full_access(new.parent_id)
    and public.child_profile_slot_count(new.parent_id) >= 1 then
    raise exception 'CHILD_PROFILE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.record_child_profile_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.child_profile_slots (user_id, child_id, created_at)
  values (new.parent_id, new.id, coalesce(new.created_at, now()))
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.enforce_child_profile_delete_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return old;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(old.parent_id::text, 0));

  if not public.has_child_profile_full_access(old.parent_id)
    and public.child_profile_count(old.parent_id) <= 1 then
    raise exception 'LAST_FREE_CHILD_DELETE_BLOCKED' using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists enforce_child_profile_insert_limit on public.children;
create trigger enforce_child_profile_insert_limit
  before insert on public.children
  for each row execute function public.enforce_child_profile_insert_limit();

drop trigger if exists record_child_profile_slot on public.children;
create trigger record_child_profile_slot
  after insert on public.children
  for each row execute function public.record_child_profile_slot();

drop trigger if exists enforce_child_profile_delete_limit on public.children;
create trigger enforce_child_profile_delete_limit
  before delete on public.children
  for each row execute function public.enforce_child_profile_delete_limit();

drop policy if exists "Users can insert their own children." on public.children;
create policy "Users can insert their own children."
  on public.children for insert
  with check (
    auth.uid() = parent_id
    and (
      public.has_child_profile_full_access(parent_id)
      or public.child_profile_slot_count(parent_id) < 1
    )
  );

drop policy if exists "Users can delete their own children." on public.children;
create policy "Users can delete their own children."
  on public.children for delete
  using (
    auth.uid() = parent_id
    and (
      public.has_child_profile_full_access(parent_id)
      or public.child_profile_count(parent_id) > 1
    )
  );

grant execute on function public.has_child_profile_full_access(uuid) to authenticated, service_role;
grant execute on function public.child_profile_slot_count(uuid) to authenticated, service_role;
grant execute on function public.child_profile_count(uuid) to authenticated, service_role;

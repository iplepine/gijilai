-- ============================================
-- 026: 인앱 알림(notifications) — Phase 1 (공동양육자 알림)
-- 정책: docs/product/policies/co-parent.md (§공동양육자 알림)
-- ADR 2026-07-06
--
-- 목적: 한 양육자가 아이(CHILD) 상담을 새로 남기면, 같은 아이의 상대 양육자에게
--       인앱 알림 1건을 남긴다. "한 명이 잊어도 상대가 끌어오는" 관계형 리텐션의 첫 채널.
--
-- 설계 원칙:
--  1) self-parent(SELF_PARENT) 상담은 절대 알림 대상이 아니다.
--     → 트리거가 type='CHILD'만 처리한다. (self는 별도 라우트/타입, 마이그레이션 020 참고)
--  2) 알림 문구 텍스트는 저장하지 않고 구조적 참조(actor/child/session)만 저장한다.
--     표시 문구는 조회 시점에 조합한다(i18n·호칭 변경에 강건, 마이그레이션 018 호칭 모델 재사용).
--  3) 발송(INSERT)은 SECURITY DEFINER 트리거만 수행한다. 수신자는 읽기/읽음처리/삭제만 가능.
--  4) 솔로 사용자(공동양육자 없음)는 알림이 생성되지 않는다 → 기존 경험 그대로.
--  5) 재실행 안전: create ... if not exists / drop ... if exists.
-- ============================================

-- 1. notifications 테이블
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,   -- 수신자
  actor_id uuid references public.profiles(id) on delete set null,          -- 알림을 발생시킨 사람
  type text not null check (type in ('CO_PARENT_CONSULTATION')),
  child_id uuid references public.children(id) on delete cascade,
  session_id uuid references public.consultation_sessions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,                                   -- 표시 보조(sessionTitle 등)
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- 안 읽은 알림 뱃지 카운트용 부분 인덱스
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

-- 수신자 본인만 조회
drop policy if exists "Recipient can view own notifications." on public.notifications;
create policy "Recipient can view own notifications."
  on public.notifications for select
  using (auth.uid() = user_id);

-- 수신자 본인만 읽음 처리(update)
drop policy if exists "Recipient can update own notifications." on public.notifications;
create policy "Recipient can update own notifications."
  on public.notifications for update
  using (auth.uid() = user_id);

-- 수신자 본인만 삭제
drop policy if exists "Recipient can delete own notifications." on public.notifications;
create policy "Recipient can delete own notifications."
  on public.notifications for delete
  using (auth.uid() = user_id);

-- INSERT 정책은 두지 않는다 → authenticated 직접 삽입 불가.
-- 알림 생성은 아래 SECURITY DEFINER 트리거(및 service_role 서버 코드)만 수행한다.

-- 2. 트리거 함수: 새 CHILD 상담 세션이 생성되면 상대 양육자(들)에게 알림
--    consultation_sessions INSERT = "새 상담 스레드 완료"(consult/page.tsx는 처방 성공 후에만 세션을 만든다).
create or replace function public.notify_co_parents_on_consultation_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  -- CHILD 상담만. self-parent(SELF_PARENT)는 절대 알림 대상이 아니다.
  if new.type is distinct from 'CHILD' or new.child_id is null then
    return new;
  end if;

  -- 이 아이의 양육자(소유자 + 수락된 공동양육자) 중 작성자 본인을 제외한 각자에게 1건씩.
  -- 소유자↔공동양육자 양방향 모두 커버한다(누가 상담을 남기든 상대가 받는다).
  for recipient in
    select distinct uid
    from (
      select c.parent_id as uid
        from public.children c
        where c.id = new.child_id
      union
      select cp.co_parent_id as uid
        from public.child_co_parents cp
        where cp.child_id = new.child_id
          and cp.status = 'ACCEPTED'
    ) caregivers
    where uid is not null
      and uid <> new.user_id
  loop
    insert into public.notifications (user_id, actor_id, type, child_id, session_id, data)
    values (
      recipient,
      new.user_id,
      'CO_PARENT_CONSULTATION',
      new.child_id,
      new.id,
      jsonb_build_object('sessionTitle', new.title)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_co_parents_on_consultation_session on public.consultation_sessions;
create trigger trg_notify_co_parents_on_consultation_session
  after insert on public.consultation_sessions
  for each row execute function public.notify_co_parents_on_consultation_session();

grant execute on function public.notify_co_parents_on_consultation_session() to authenticated, service_role;

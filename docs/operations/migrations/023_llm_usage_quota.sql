-- ============================================
-- 023: LLM 호출 쿼터 이벤트 + usage 이벤트 체크 제약 보수
--
-- (1) llm_usage_events: 전 사용자 대상 LLM 호출 기록 (abuse guard)
--     subscription_usage_events는 활성 구독자만 기록돼 무료/체험 사용자의
--     리포트 생성 남용을 막을 수 없다. 모든 인증 사용자의 LLM 호출을
--     호출 전에 기록하고 서버가 24시간 윈도우로 카운트해 차단한다.
--     kind에는 check 제약을 두지 않는다 — 011→013처럼 enum이 늘어날 때
--     체크 제약 갱신이 누락되면 insert가 조용히 실패하는 사고를 반복하지 않기 위함.
--
-- (2) subscription_usage_events.event_name 체크 제약 확장
--     019(self-parent)에서 SELF_PARENT_* 이벤트가 체크 제약에 추가되지 않아,
--     현재 코드의 SELF_PARENT_QUESTIONS / SELF_PARENT_PRESCRIPTION 기록이
--     check 위반으로 조용히 실패한다(insert_failed 로그만 남음).
-- 재실행 안전: if not exists / drop ... if exists 가드.
-- ============================================

-- 1. llm_usage_events
create table if not exists public.llm_usage_events (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

alter table public.llm_usage_events enable row level security;

drop policy if exists "Service role can manage llm usage events." on public.llm_usage_events;
create policy "Service role can manage llm usage events."
  on public.llm_usage_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_llm_usage_events_user_kind_created
  on public.llm_usage_events (user_id, kind, created_at desc);

-- 2. subscription_usage_events.event_name 체크 제약에 self-parent 이벤트 추가
alter table public.subscription_usage_events
  drop constraint if exists subscription_usage_events_event_name_check;

alter table public.subscription_usage_events
  add constraint subscription_usage_events_event_name_check
  check (event_name in (
    'CONSULT_QUESTIONS_INITIAL',
    'CONSULT_QUESTIONS_FOLLOWUP',
    'CONSULT_PRESCRIPTION',
    'PRACTICE_HISTORY_VIEW',
    'PRACTICE_AI_FEEDBACK',
    'SELF_PARENT_QUESTIONS',
    'SELF_PARENT_PRESCRIPTION'
  ));

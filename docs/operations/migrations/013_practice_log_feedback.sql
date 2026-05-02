-- ============================================
-- 013: 실천 로그 아이 반응 및 AI 피드백
-- ============================================

alter table public.practice_logs
  add column if not exists child_reaction_type text,
  add column if not exists child_reaction_note text,
  add column if not exists ai_feedback jsonb,
  add column if not exists ai_feedback_created_at timestamptz;

alter table public.practice_logs
  drop constraint if exists practice_logs_child_reaction_type_check;

alter table public.practice_logs
  add constraint practice_logs_child_reaction_type_check
  check (
    child_reaction_type is null
    or child_reaction_type in (
      'cooperated',
      'resisted_then_settled',
      'escalated',
      'no_clear_reaction',
      'not_tried',
      'custom'
    )
  );

alter table public.subscription_usage_events
  drop constraint if exists subscription_usage_events_event_name_check;

alter table public.subscription_usage_events
  add constraint subscription_usage_events_event_name_check
  check (event_name in (
    'CONSULT_QUESTIONS_INITIAL',
    'CONSULT_QUESTIONS_FOLLOWUP',
    'CONSULT_PRESCRIPTION',
    'PRACTICE_HISTORY_VIEW',
    'PRACTICE_AI_FEEDBACK'
  ));


-- ============================================
-- 014: 실천 피드백 자동 라우팅 메타데이터
-- ============================================

alter table public.practice_logs
  add column if not exists practice_attempt_type text,
  add column if not exists practice_attempt_note text,
  add column if not exists parent_impression_type text,
  add column if not exists ai_feedback_model text,
  add column if not exists ai_feedback_depth text;

alter table public.practice_logs
  drop constraint if exists practice_logs_practice_attempt_type_check,
  drop constraint if exists practice_logs_parent_impression_type_check,
  drop constraint if exists practice_logs_ai_feedback_depth_check;

alter table public.practice_logs
  add constraint practice_logs_practice_attempt_type_check
  check (
    practice_attempt_type is null
    or practice_attempt_type in (
      'as_prescribed',
      'changed_words',
      'shortened',
      'adapted_to_situation',
      'barely_tried'
    )
  ),
  add constraint practice_logs_parent_impression_type_check
  check (
    parent_impression_type is null
    or parent_impression_type in (
      'this_is_it',
      'seems_right',
      'not_sure',
      'seems_wrong',
      'want_to_adjust'
    )
  ),
  add constraint practice_logs_ai_feedback_depth_check
  check (
    ai_feedback_depth is null
    or ai_feedback_depth in ('quick', 'deep')
  );

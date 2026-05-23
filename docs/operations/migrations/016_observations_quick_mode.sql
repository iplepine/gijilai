-- ============================================
-- 016: observations 빠른 기록 모드 지원
-- 30초 한 줄 기록 흐름을 위해 my_action/child_reaction NOT NULL 제거.
-- entry_mode 컬럼으로 작성 흐름 구분.
-- ============================================

ALTER TABLE public.observations
  ALTER COLUMN my_action DROP NOT NULL,
  ALTER COLUMN child_reaction DROP NOT NULL;

ALTER TABLE public.observations
  ADD COLUMN IF NOT EXISTS entry_mode text
    NOT NULL DEFAULT 'detailed'
    CHECK (entry_mode IN ('quick', 'detailed'));

-- 기존 행은 모두 detailed로 간주 (기본값 적용됨)
COMMENT ON COLUMN public.observations.entry_mode IS
  'quick: 한 줄 빠른 기록(situation만 필수) / detailed: 상황·내 대응·아이 반응 4필드';

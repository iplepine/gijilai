-- ============================================
-- 008: observations 테이블 ON DELETE CASCADE 추가
-- observations 테이블에 CASCADE가 누락되어 회원 탈퇴 시 FK 제약조건 에러 발생
-- ============================================

-- user_id FK에 ON DELETE CASCADE 추가
ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_user_id_fkey,
  ADD CONSTRAINT observations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- child_id FK에 ON DELETE SET NULL 추가
ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_child_id_fkey,
  ADD CONSTRAINT observations_child_id_fkey
    FOREIGN KEY (child_id) REFERENCES public.children(id) ON DELETE SET NULL;

-- consultation_id FK에 ON DELETE SET NULL 추가
ALTER TABLE public.observations
  DROP CONSTRAINT IF EXISTS observations_consultation_id_fkey,
  ADD CONSTRAINT observations_consultation_id_fkey
    FOREIGN KEY (consultation_id) REFERENCES public.consultations(id) ON DELETE SET NULL;

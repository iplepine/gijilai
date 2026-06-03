-- ============================================
-- 020: self-parent 상담은 공동양육자에게 절대 노출되지 않는다
-- 정책: docs/product/policies/self-parent.md, co-parent.md
--
-- 마이그레이션 018의 co-parent SELECT/UPDATE 정책은 child_id만 보고 type을
-- 구분하지 않았다. self-parent 상담(type='SELF_PARENT')도 child_id가 있으면
-- 공동양육자가 RLS상 읽을 수 있는 빈틈이 있었다. 양육자 본인의 사적 반성문은
-- 작성자(user_id)만 볼 수 있어야 한다.
--
-- 이 마이그레이션은 co-parent 가시성 정책을 type='CHILD'로 좁힌다.
-- 기본 user_id 정책(작성자 본인)은 그대로이므로 self-parent는 작성자만 본다.
-- 재실행 안전: drop policy if exists로 선행 정리한다.
-- ============================================

-- 1. consultations — co-parent SELECT는 CHILD만
drop policy if exists "Co-parent can view child consultations." on public.consultations;
create policy "Co-parent can view child consultations."
  on public.consultations for select
  using (
    type = 'CHILD'
    and public.is_child_co_parent(child_id)
  );

drop policy if exists "Co-parent can insert child consultations." on public.consultations;
create policy "Co-parent can insert child consultations."
  on public.consultations for insert
  with check (
    auth.uid() = user_id
    and type = 'CHILD'
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

drop policy if exists "Co-parent can update own child consultations." on public.consultations;
create policy "Co-parent can update own child consultations."
  on public.consultations for update
  using (
    auth.uid() = user_id
    and type = 'CHILD'
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 2. consultation_sessions — co-parent SELECT/INSERT/UPDATE는 CHILD만
drop policy if exists "Co-parent can view child sessions." on public.consultation_sessions;
create policy "Co-parent can view child sessions."
  on public.consultation_sessions for select
  using (
    type = 'CHILD'
    and public.is_child_co_parent(child_id)
  );

drop policy if exists "Co-parent can insert child sessions." on public.consultation_sessions;
create policy "Co-parent can insert child sessions."
  on public.consultation_sessions for insert
  with check (
    auth.uid() = user_id
    and type = 'CHILD'
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

drop policy if exists "Co-parent can update child sessions." on public.consultation_sessions;
create policy "Co-parent can update child sessions."
  on public.consultation_sessions for update
  using (
    type = 'CHILD'
    and child_id is not null
    and public.is_child_co_parent(child_id)
  );

-- 3. practice_items — co-parent 접근은 CHILD만 (self-parent 실천은 Phase 2에서도 비공개)
drop policy if exists "Co-parent can view child practice items." on public.practice_items;
create policy "Co-parent can view child practice items."
  on public.practice_items for select
  using (
    type = 'CHILD'
    and exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

drop policy if exists "Co-parent can insert child practice items." on public.practice_items;
create policy "Co-parent can insert child practice items."
  on public.practice_items for insert
  with check (
    type = 'CHILD'
    and exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

drop policy if exists "Co-parent can update child practice items." on public.practice_items;
create policy "Co-parent can update child practice items."
  on public.practice_items for update
  using (
    type = 'CHILD'
    and exists (
      select 1 from public.consultation_sessions cs
      where cs.id = practice_items.session_id
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

-- 4. practice_logs — co-parent 읽기/쓰기는 CHILD 실천에 대해서만
drop policy if exists "Co-parent can view child practice logs." on public.practice_logs;
create policy "Co-parent can view child practice logs."
  on public.practice_logs for select
  using (
    exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_logs.practice_id
        and pi.type = 'CHILD'
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

drop policy if exists "Co-parent can insert child practice logs." on public.practice_logs;
create policy "Co-parent can insert child practice logs."
  on public.practice_logs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_logs.practice_id
        and pi.type = 'CHILD'
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

-- (update own practice logs 정책은 auth.uid()=user_id 기준이라 그대로 둔다. 본인 로그만 수정.)

-- 5. practice_reviews — co-parent 읽기/쓰기는 CHILD 실천에 대해서만
drop policy if exists "Co-parent can view child practice reviews." on public.practice_reviews;
create policy "Co-parent can view child practice reviews."
  on public.practice_reviews for select
  using (
    exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_reviews.practice_id
        and pi.type = 'CHILD'
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

drop policy if exists "Co-parent can insert child practice reviews." on public.practice_reviews;
create policy "Co-parent can insert child practice reviews."
  on public.practice_reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.practice_items pi
      join public.consultation_sessions cs on cs.id = pi.session_id
      where pi.id = practice_reviews.practice_id
        and pi.type = 'CHILD'
        and cs.child_id is not null
        and public.is_child_co_parent(cs.child_id)
    )
  );

-- 결과: self-parent(type='SELF_PARENT') 상담/세션/실천/로그/회고는
-- co-parent 정책이 모두 type='CHILD'를 요구하므로 매칭되지 않는다.
-- 작성자 본인은 기존 user_id 기반 정책으로 계속 접근한다.

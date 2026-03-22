-- 1. survey_id를 nullable로 변경
alter table public.reports alter column survey_id drop not null;

-- 2. type check constraint에 HARMONY 추가
alter table public.reports drop constraint reports_type_check;
alter table public.reports add constraint reports_type_check
  check (type = any (array['PARENT'::text, 'CHILD'::text, 'HARMONY'::text]));

-- 3. is_paid 컬럼 추가
alter table public.reports add column is_paid boolean not null default false;

-- 4. reports 삭제 정책 추가 (refresh 시 기존 리포트 삭제 필요)
create policy "Users can delete their own reports."
  on public.reports for delete
  using ( auth.uid() = user_id );

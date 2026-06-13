-- 025_assessment_phases.sql
-- 기질검사 차수화(점진적 심화형): surveys/reports 에 차수(phase) 개념 추가.
-- 스펙: docs/spec/phased-temperament-assessment.md §4
-- 멱등(if not exists). 기존 행은 phase=0(완료 차수 없음)으로 시작하며 기존 쿼리와 호환된다.

alter table public.surveys
  add column if not exists phase integer not null default 0,
  add column if not exists assessment_version text;

comment on column public.surveys.phase is '이 cycle에서 완료된 최고 차수(0=없음). AssessmentPhase.completedPhase 결과.';
comment on column public.surveys.assessment_version is '문항 선택 버전/cycle 식별(연령밴드·로테이션 추적).';

alter table public.reports
  add column if not exists phase integer;

comment on column public.reports.phase is '이 리포트를 생성한 차수(legacy=null).';

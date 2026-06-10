-- ============================================
-- 022: 리포트 공유 토큰 분리
-- 공유 URL이 reports.id(PK)를 그대로 노출해, 공유한 적 없는 리포트도
-- id만 알면 /api/report/shared/{id}로 아이 이름·성별·분석 전체가 조회됐다.
-- 공유하기를 누른 시점에만 share_token을 발급(opt-in)하고,
-- 공개 조회는 share_token으로만 가능하게 한다.
-- 재실행 안전: if not exists 가드.
-- ============================================

alter table public.reports
  add column if not exists share_token uuid;

create unique index if not exists idx_reports_share_token
  on public.reports (share_token)
  where share_token is not null;

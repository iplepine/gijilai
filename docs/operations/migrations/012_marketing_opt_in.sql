alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false;

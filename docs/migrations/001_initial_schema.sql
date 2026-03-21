-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  role text default 'user',
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile."
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can update their own profile."
  on public.profiles for update
  using ( auth.uid() = id );

-- Create children table
create table public.children (
  id uuid not null default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  gender text check (gender in ('male', 'female')),
  birth_date date not null,
  birth_time time,
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.children enable row level security;

create policy "Users can view their own children."
  on public.children for select
  using ( auth.uid() = parent_id );

create policy "Users can insert their own children."
  on public.children for insert
  with check ( auth.uid() = parent_id );

create policy "Users can update their own children."
  on public.children for update
  using ( auth.uid() = parent_id );

create policy "Users can delete their own children."
  on public.children for delete
  using ( auth.uid() = parent_id );

-- Create surveys table
create table public.surveys (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  type text not null check (type in ('PARENT', 'CHILD', 'PARENTING_STYLE')),
  answers jsonb default '{}'::jsonb,
  scores jsonb default '{}'::jsonb,
  step integer default 1,
  status text default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id)
);

alter table public.surveys enable row level security;

create policy "Users can view their own surveys."
  on public.surveys for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own surveys."
  on public.surveys for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own surveys."
  on public.surveys for update
  using ( auth.uid() = user_id );

-- Create reports table
create table public.reports (
  id uuid not null default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  type text not null check (type in ('PARENT', 'CHILD')),
  content text,
  analysis_json jsonb,
  model_used text,
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.reports enable row level security;

create policy "Users can view their own reports."
  on public.reports for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own reports."
  on public.reports for insert
  with check ( auth.uid() = user_id );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create consultations table
create table public.consultations (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  category text,
  problem_description text,
  ai_options jsonb,
  selected_reaction_id text,
  ai_prescription jsonb,
  status text default 'DRAFT' check (status in ('DRAFT', 'AWAITING_REACTION', 'COMPLETED')),
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.consultations enable row level security;

create policy "Users can view their own consultations."
  on public.consultations for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own consultations."
  on public.consultations for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own consultations."
  on public.consultations for update
  using ( auth.uid() = user_id );

-- Create action_items table
create table public.action_items (
  id uuid not null default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  target_date date,
  title text not null,
  type text,
  is_completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  primary key (id)
);

alter table public.action_items enable row level security;

create policy "Users can view their own action_items."
  on public.action_items for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own action_items."
  on public.action_items for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own action_items."
  on public.action_items for update
  using ( auth.uid() = user_id );

-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor -> New Query -> Run

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  target_language text not null default 'Japanese',
  daily_goal_minutes integer not null default 90 check (daily_goal_minutes >= 5 and daily_goal_minutes <= 1440),
  created_at timestamptz not null default now()
);

create table if not exists public.immersion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  cards_mined integer not null default 0 check (cards_mined >= 0),
  notes text,
  logged_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists immersion_logs_user_date_idx
  on public.immersion_logs (user_id, logged_date desc, created_at desc);

alter table public.profiles enable row level security;
alter table public.immersion_logs enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can view own logs" on public.immersion_logs;
create policy "Users can view own logs"
  on public.immersion_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own logs" on public.immersion_logs;
create policy "Users can insert own logs"
  on public.immersion_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own logs" on public.immersion_logs;
create policy "Users can update own logs"
  on public.immersion_logs for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own logs" on public.immersion_logs;
create policy "Users can delete own logs"
  on public.immersion_logs for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

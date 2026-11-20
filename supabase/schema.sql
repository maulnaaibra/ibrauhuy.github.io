-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor -> New Query -> Run

grant usage on schema public to anon, authenticated;

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

grant select, insert, update, delete on table public.profiles, public.immersion_logs to authenticated;

alter table public.profiles enable row level security;
alter table public.immersion_logs enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view own logs" on public.immersion_logs;
create policy "Users can view own logs"
  on public.immersion_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own logs" on public.immersion_logs;
create policy "Users can insert own logs"
  on public.immersion_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own logs" on public.immersion_logs;
create policy "Users can update own logs"
  on public.immersion_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own logs" on public.immersion_logs;
create policy "Users can delete own logs"
  on public.immersion_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

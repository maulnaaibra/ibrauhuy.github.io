-- Hardened ImmersionTrack PostgreSQL Schema & Row Level Security (RLS)
-- Apply in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- 1. Lock down public schema defaults against unauthenticated & unexpected roles
revoke all on schema public from public;
grant usage on schema public to anon, authenticated;

alter default privileges in schema public revoke all on tables from public, anon;
alter default privileges in schema public revoke all on sequences from public, anon;
alter default privileges in schema public revoke all on routines from public, anon, authenticated;

-- 2. Profiles table (private by default, strictly scoped to owning user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 100),
  username text check (username is null or (char_length(username) <= 32 and username ~ '^[a-z0-9_.-]*$')),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 250000),
  banner_url text check (banner_url is null or char_length(banner_url) <= 250000),
  bio text check (bio is null or char_length(bio) <= 600),
  jlpt_level text not null default 'auto',
  jlpt_target text not null default 'N2',
  favorite_media text check (favorite_media is null or char_length(favorite_media) <= 180),
  banner_theme text not null default 'sakura-crimson',
  is_public boolean not null default false,
  target_language text not null default 'Japanese' check (char_length(target_language) <= 40),
  daily_goal_minutes integer not null default 90 check (daily_goal_minutes >= 5 and daily_goal_minutes <= 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists jlpt_level text not null default 'auto',
  add column if not exists jlpt_target text not null default 'N2',
  add column if not exists favorite_media text,
  add column if not exists banner_theme text not null default 'sakura-crimson',
  add column if not exists banner_url text,
  add column if not exists is_public boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure new signups default is_public to false for privacy
alter table public.profiles
  alter column is_public set default false;

create index if not exists profiles_lower_username_idx
  on public.profiles (lower(username))
  where username is not null and char_length(username) > 0;

-- 3. Immersion Logs table
create table if not exists public.immersion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  category text not null check (char_length(category) between 1 and 64),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  cards_mined integer not null default 0 check (cards_mined >= 0 and cards_mined <= 50000),
  notes text check (notes is null or char_length(notes) <= 5000),
  logged_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists immersion_logs_user_date_idx
  on public.immersion_logs (user_id, logged_date desc, created_at desc);

-- 4. User Library State table (reader preferences, word status, bookmarks, custom themes)
create table if not exists public.user_library_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb check (pg_column_size(state_json) <= 5242880),
  updated_at timestamptz not null default now()
);

-- 5. Revoke ALL anonymous access & grant strictly to authenticated role
revoke all on table public.profiles, public.immersion_logs, public.user_library_state from public, anon;
grant select, insert, update, delete on table public.profiles, public.immersion_logs, public.user_library_state to authenticated;

alter table public.profiles enable row level security;
alter table public.immersion_logs enable row level security;
alter table public.user_library_state enable row level security;

-- Drop any legacy or overly permissive policies first
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can delete own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can delete own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can view own logs" on public.immersion_logs;
drop policy if exists "Users can insert own logs" on public.immersion_logs;
drop policy if exists "Users can update own logs" on public.immersion_logs;
drop policy if exists "Users can delete own logs" on public.immersion_logs;

create policy "Users can view own logs"
  on public.immersion_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own logs"
  on public.immersion_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own logs"
  on public.immersion_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own logs"
  on public.immersion_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own library state" on public.user_library_state;
drop policy if exists "Users can insert own library state" on public.user_library_state;
drop policy if exists "Users can update own library state" on public.user_library_state;
drop policy if exists "Users can delete own library state" on public.user_library_state;

create policy "Users can view own library state"
  on public.user_library_state for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own library state"
  on public.user_library_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own library state"
  on public.user_library_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own library state"
  on public.user_library_state for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 6. Hardened triggers (immutable search_path, minimal privilege)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon;
grant execute on function public.set_updated_at() to authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_library_state_updated_at on public.user_library_state;
create trigger set_user_library_state_updated_at
  before update on public.user_library_state
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    pg_catalog.left(
      coalesce(new.raw_user_meta_data ->> 'full_name', pg_catalog.split_part(new.email, '@', 1)),
      100
    ),
    case
      when v_raw_avatar is not null and pg_catalog.left(v_raw_avatar, 8) = 'https://'
        then pg_catalog.left(v_raw_avatar, 2000)
      else null
    end
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

-- 7. Least-privilege RPC for opted-in public showcase profiles (no raw logs, notes, or email exposure)
create or replace function public.get_public_profile_showcase(p_handle text)
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  banner_url text,
  bio text,
  jlpt_level text,
  jlpt_target text,
  favorite_media text,
  banner_theme text,
  target_language text,
  daily_goal_minutes integer,
  created_at timestamptz,
  total_minutes bigint,
  total_cards bigint,
  total_sessions bigint,
  top_media jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_handle text := pg_catalog.btrim(coalesce(p_handle, ''));
begin
  if pg_catalog.char_length(v_handle) = 0 or pg_catalog.char_length(v_handle) > 64 then
    return;
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.banner_url,
    p.bio,
    p.jlpt_level,
    p.jlpt_target,
    p.favorite_media,
    p.banner_theme,
    p.target_language,
    p.daily_goal_minutes,
    p.created_at,
    coalesce(agg.total_minutes, 0)::bigint as total_minutes,
    coalesce(agg.total_cards, 0)::bigint as total_cards,
    coalesce(agg.total_sessions, 0)::bigint as total_sessions,
    coalesce(agg.top_media, '[]'::jsonb) as top_media
  from public.profiles p
  left join lateral (
    with grouped as (
      select
        l.title,
        l.category,
        sum(l.duration_minutes)::bigint as total_minutes,
        count(*)::bigint as sessions,
        sum(l.cards_mined)::bigint as total_cards
      from public.immersion_logs l
      where l.user_id = p.id
      group by l.title, l.category
      order by sum(l.duration_minutes) desc
      limit 6
    )
    select
      (select coalesce(sum(l2.duration_minutes), 0) from public.immersion_logs l2 where l2.user_id = p.id) as total_minutes,
      (select coalesce(sum(l2.cards_mined), 0) from public.immersion_logs l2 where l2.user_id = p.id) as total_cards,
      (select count(*) from public.immersion_logs l2 where l2.user_id = p.id) as total_sessions,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'title', g.title,
              'category', g.category,
              'totalMinutes', g.total_minutes,
              'sessions', g.sessions,
              'totalCards', g.total_cards
            )
          )
          from grouped g
        ),
        '[]'::jsonb
      ) as top_media
  ) agg on true
  where p.is_public = true
    and (
      p.id::text = v_handle
      or (p.username is not null and pg_catalog.lower(p.username) = pg_catalog.lower(v_handle))
    )
  limit 1;
end;
$$;

revoke execute on function public.get_public_profile_showcase(text) from public;
grant execute on function public.get_public_profile_showcase(text) to anon, authenticated;

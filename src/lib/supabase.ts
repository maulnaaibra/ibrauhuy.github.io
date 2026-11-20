import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_SUPABASE_KEY = 'immersiontrack_supabase_config_v1';

const DEFAULT_SUPABASE_URL = 'https://zxdkyvxxtpnmitlcrhql.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZGt5dnh4dHBubWl0bGNyaHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODg5MDgsImV4cCI6MjExMDc2NDkwOH0.JT8Gz0PiN6bebXRMbgIKCTtSV-P0dALkERk3W2bgR1E';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

function isRealConfig(url: string, key: string): boolean {
  return Boolean(
    url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('your-project-id') &&
      !url.includes('placeholder.supabase.co') &&
      !key.includes('your-anon-public-key') &&
      !key.includes('placeholder-anon-key')
  );
}

interface StoredSupabaseConfig {
  url: string;
  anonKey: string;
}

function readRuntimeConfig(): StoredSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_SUPABASE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSupabaseConfig>;
      if (parsed.url && parsed.anonKey && isRealConfig(parsed.url, parsed.anonKey)) {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  configured: boolean;
  source: 'env' | 'local' | 'none';
} {
  const local = readRuntimeConfig();
  if (local) {
    return {
      url: local.url,
      anonKey: local.anonKey,
      configured: true,
      source: 'local',
    };
  }
  if (isRealConfig(envUrl, envKey)) {
    return {
      url: envUrl,
      anonKey: envKey,
      configured: true,
      source: 'env',
    };
  }
  if (isRealConfig(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY)) {
    return {
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_ANON_KEY,
      configured: true,
      source: 'env',
    };
  }
  return {
    url: '',
    anonKey: '',
    configured: false,
    source: 'none',
  };
}

function buildClient(url: string, anonKey: string): SupabaseClient {
  return createClient(
    url || 'https://placeholder.supabase.co',
    anonKey || 'placeholder-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

const initialCfg = getSupabaseConfig();

export let isSupabaseConfigured: boolean = initialCfg.configured;
export let supabase: SupabaseClient = buildClient(initialCfg.url, initialCfg.anonKey);

export function saveRuntimeSupabaseConfig(url: string, anonKey: string): boolean {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (!isRealConfig(cleanUrl, cleanKey)) {
    return false;
  }
  try {
    localStorage.setItem(
      RUNTIME_SUPABASE_KEY,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  } catch {
    // ignore storage errors
  }
  isSupabaseConfigured = true;
  supabase = buildClient(cleanUrl, cleanKey);
  window.dispatchEvent(new Event('supabase-config-changed'));
  return true;
}

export function clearRuntimeSupabaseConfig(): void {
  try {
    localStorage.removeItem(RUNTIME_SUPABASE_KEY);
  } catch {
    // ignore storage errors
  }
  const next = getSupabaseConfig();
  isSupabaseConfigured = next.configured;
  supabase = buildClient(next.url, next.anonKey);
  window.dispatchEvent(new Event('supabase-config-changed'));
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; tablesReady: boolean; message: string }> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  if (!isRealConfig(cleanUrl, cleanKey)) {
    return {
      ok: false,
      tablesReady: false,
      message: 'Masukkan Project URL (https://...supabase.co) dan Anon Public Key yang valid.',
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${cleanUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();

    if (
      res.ok ||
      text.includes('42501') ||
      text.includes('permission denied for table')
    ) {
      return {
        ok: true,
        tablesReady: true,
        message: 'Terhubung! Kredensial valid dan tabel database (RLS aktif) sudah siap.',
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        tablesReady: false,
        message: 'Anon Key ditolak oleh Supabase (401/403). Periksa kembali key Anda.',
      };
    }
    if (
      res.status === 404 ||
      text.includes('PGRST205') ||
      text.includes('does not exist') ||
      text.includes('Could not find the table')
    ) {
      return {
        ok: true,
        tablesReady: false,
        message:
          'Kredensial valid! Namun tabel "profiles" belum ada—salin & jalankan Skrip SQL di bawah pada SQL Editor Supabase.',
      };
    }

    return {
      ok: false,
      tablesReady: false,
      message: `Respon Supabase (${res.status}): ${text.slice(0, 120)}`,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      tablesReady: false,
      message:
        err instanceof Error
          ? `Gagal menghubungi server Supabase: ${err.message}`
          : 'Gagal menghubungi Supabase.',
    };
  }
}

export const SUPABASE_SCHEMA_SQL = `grant usage on schema public to anon, authenticated;

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
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view own logs" on public.immersion_logs;
create policy "Users can view own logs"
  on public.immersion_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own logs" on public.immersion_logs;
create policy "Users can insert own logs"
  on public.immersion_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own logs" on public.immersion_logs;
create policy "Users can update own logs"
  on public.immersion_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own logs" on public.immersion_logs;
create policy "Users can delete own logs"
  on public.immersion_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
  for each row execute function public.handle_new_user();`;

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const LEGACY_RUNTIME_SUPABASE_KEY = 'immersiontrack_supabase_config_v1';

const DEFAULT_SUPABASE_URL = 'https://zxdkyvxxtpnmitlcrhql.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4ZGt5dnh4dHBubWl0bGNyaHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODg5MDgsImV4cCI6MjExMDc2NDkwOH0.JT8Gz0PiN6bebXRMbgIKCTtSV-P0dALkERk3W2bgR1E';

const envUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const envKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LEGACY_RUNTIME_SUPABASE_KEY);
  }
} catch {
  // ignore storage cleanup errors
}

function isValidSupabaseConfig(url: string, key: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(
      parsed.protocol === 'https:' &&
        parsed.hostname.endsWith('.supabase.co') &&
        key &&
        !url.includes('your-project-id') &&
        !url.includes('placeholder.supabase.co') &&
        !key.includes('your-anon-public-key') &&
        !key.includes('placeholder-anon-key')
    );
  } catch {
    return false;
  }
}

const resolvedUrl = isValidSupabaseConfig(envUrl, envKey)
  ? envUrl
  : DEFAULT_SUPABASE_URL;
const resolvedKey = isValidSupabaseConfig(envUrl, envKey)
  ? envKey
  : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = isValidSupabaseConfig(
  resolvedUrl,
  resolvedKey
);

function buildClient(url: string, anonKey: string): SupabaseClient {
  return createClient(
    url || 'https://placeholder.supabase.co',
    anonKey || 'placeholder-anon-key',
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

export const supabase: SupabaseClient = buildClient(resolvedUrl, resolvedKey);

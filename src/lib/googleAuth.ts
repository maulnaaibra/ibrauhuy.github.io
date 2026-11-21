import { DEMO_MODE_KEY } from './demoData';
import { supabase } from './supabase';

export const DEFAULT_GOOGLE_CLIENT_ID =
  '215759558209-l0kg3386oaplun7r7qhpf6jv2rbum5st.apps.googleusercontent.com';

const CUSTOM_GOOGLE_CLIENT_KEY = 'immersiontrack_google_client_id_v1';
const REMEMBERED_ACCOUNTS_KEY = 'immersiontrack_google_accounts_v1';
const LEGACY_GSI_INFOS_KEY = 'infos';

export interface GoogleProfilePayload {
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  sub?: string;
}

export interface RememberedGoogleAccount {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  lastUsedAt: string;
}

export function getGoogleClientId(): string {
  const envClientId = (
    import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  )?.trim();
  if (envClientId) return envClientId;

  try {
    const custom = localStorage.getItem(CUSTOM_GOOGLE_CLIENT_KEY)?.trim();
    if (custom) return custom;
  } catch {
    // ignore storage errors
  }

  return DEFAULT_GOOGLE_CLIENT_ID;
}

export function hasCustomGoogleClientId(): boolean {
  return getGoogleClientId() !== DEFAULT_GOOGLE_CLIENT_ID;
}

export function saveCustomGoogleClientId(clientId: string): boolean {
  const clean = clientId.trim();
  if (!clean || !clean.includes('.apps.googleusercontent.com')) {
    return false;
  }
  try {
    localStorage.setItem(CUSTOM_GOOGLE_CLIENT_KEY, clean);
  } catch {
    // ignore storage errors
  }
  return true;
}

export function clearCustomGoogleClientId(): void {
  try {
    localStorage.removeItem(CUSTOM_GOOGLE_CLIENT_KEY);
  } catch {
    // ignore storage errors
  }
}

export function decodeGoogleJwt(credential: string): GoogleProfilePayload | null {
  try {
    const parts = credential.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64Url.padEnd(
      base64Url.length + ((4 - (base64Url.length % 4)) % 4),
      '='
    );
    const jsonStr = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    const payload = JSON.parse(jsonStr) as Partial<GoogleProfilePayload>;
    if (!payload.email) return null;
    return {
      email: payload.email.trim().toLowerCase(),
      name: payload.name?.trim() || payload.email.split('@')[0],
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      sub: payload.sub,
    };
  } catch {
    return null;
  }
}

export function getRememberedGoogleAccounts(): RememberedGoogleAccount[] {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RememberedGoogleAccount[];
      if (Array.isArray(parsed)) {
        return parsed.filter((a) => Boolean(a?.email));
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function saveRememberedGoogleAccount(profile: GoogleProfilePayload): void {
  const entry: RememberedGoogleAccount = {
    email: profile.email.trim().toLowerCase(),
    name: profile.name.trim() || profile.email.split('@')[0],
    picture: profile.picture,
    sub: profile.sub,
    lastUsedAt: new Date().toISOString(),
  };

  try {
    const existing = getRememberedGoogleAccounts().filter(
      (a) => a.email.toLowerCase() !== entry.email
    );
    localStorage.setItem(
      REMEMBERED_ACCOUNTS_KEY,
      JSON.stringify([entry, ...existing].slice(0, 5))
    );
    localStorage.setItem(
      LEGACY_GSI_INFOS_KEY,
      JSON.stringify({
        fullnameL: entry.name,
        photo_linkL: entry.picture ?? '',
        firstL: profile.given_name ?? entry.name.split(' ')[0] ?? '',
        lastL: profile.family_name ?? '',
        mailL: entry.email,
        id_numL: entry.sub ?? '',
      })
    );
  } catch {
    // ignore storage errors
  }
}

function deriveDeterministicCredential(normalizedEmail: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalizedEmail.length; i++) {
    const ch = normalizedEmail.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i * 17), 0x85ebca6b) >>> 0;
  }
  const token = `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
  return `Gsi_${token}_NihongoTrack#26`;
}

export async function completeGoogleSignInToSupabase(
  profile: GoogleProfilePayload
): Promise<{ ok: boolean; isNewUser?: boolean; error?: string }> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { ok: false, error: 'Masukkan alamat email Google yang valid.' };
  }

  const displayName = profile.name.trim() || normalizedEmail.split('@')[0];
  const derivedPassword = deriveDeterministicCredential(normalizedEmail);

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: derivedPassword,
    });

  if (!signInError && signInData.user) {
    await supabase.from('profiles').upsert({
      id: signInData.user.id,
      full_name: displayName,
      avatar_url: profile.picture ?? null,
    });
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {
      // ignore storage errors
    }
    saveRememberedGoogleAccount({ ...profile, email: normalizedEmail, name: displayName });
    return { ok: true, isNewUser: false };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: derivedPassword,
    options: {
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
      data: {
        full_name: displayName,
        avatar_url: profile.picture ?? null,
        auth_provider: 'google',
      },
    },
  });

  if (signUpError) {
    const lower = signUpError.message.toLowerCase();
    if (lower.includes('already registered') || lower.includes('already exists')) {
      return {
        ok: false,
        error:
          'Email ini sudah terdaftar menggunakan password manual. Silakan masuk dengan Email & Password atau klik Lupa password.',
      };
    }
    return { ok: false, error: signUpError.message };
  }

  if (signUpData.user) {
    if (signUpData.session) {
      await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        full_name: displayName,
        avatar_url: profile.picture ?? null,
      });
    }
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {
      // ignore storage errors
    }
    saveRememberedGoogleAccount({ ...profile, email: normalizedEmail, name: displayName });
    return { ok: true, isNewUser: true };
  }

  return { ok: false, error: 'Gagal menyelesaikan autentikasi akun Google.' };
}

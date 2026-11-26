import { DEMO_MODE_KEY } from './demoData';
import { supabase } from './supabase';

const LEGACY_KEYS_TO_PURGE = [
  'immersiontrack_goic_endpoint_v1',
  'immersiontrack_google_client_id_v1',
  'immersiontrack_google_accounts_v1',
  'infos',
];

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    LEGACY_KEYS_TO_PURGE.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  }
} catch {
  // ignore storage cleanup errors
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createGoogleOidcNonce(): Promise<{
  rawNonce: string;
  hashedNonce: string;
}> {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const rawNonce = bytesToHex(bytes);
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(rawNonce)
  );
  const hashedNonce = bytesToHex(new Uint8Array(digest));
  return { rawNonce, hashedNonce };
}

export async function signInWithVerifiedGoogleIdToken(
  idToken: string,
  rawNonce: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanToken = idToken.trim();
  if (!cleanToken || !rawNonce) {
    return { ok: false, error: 'Token autentikasi Google tidak valid.' };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: cleanToken,
    nonce: rawNonce,
  });

  if (error || !data.session) {
    return {
      ok: false,
      error: error?.message || 'Verifikasi akun Google gagal.',
    };
  }

  try {
    localStorage.removeItem(DEMO_MODE_KEY);
  } catch {
    // ignore storage errors
  }

  return { ok: true };
}

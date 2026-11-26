import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { DEMO_MODE_KEY } from '../lib/demoData';
import '../lib/googleAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

const GoogleLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

function isGoogleProviderDisabledError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('provider is not enabled') ||
    lower.includes('unsupported provider') ||
    lower.includes('not enabled')
  );
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);

  const handleMainClick = async () => {
    if (!isSupabaseConfigured) {
      toast.error('Layanan autentikasi belum siap. Silakan coba beberapa saat lagi.');
      return;
    }

    setBusy(true);
    try {
      try {
        localStorage.removeItem(DEMO_MODE_KEY);
      } catch {
        // ignore storage errors
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
          queryParams: {
            prompt: 'select_account',
            access_type: 'online',
          },
        },
      });
      if (error) throw error;

      if (!data?.url) {
        onSuccess?.();
      }
    } catch (err: unknown) {
      setBusy(false);
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal membuka halaman login Google.';

      if (isGoogleProviderDisabledError(message)) {
        toast.error(
          'Login Google sedang dinonaktifkan. Silakan masuk atau daftar menggunakan Email & Password.'
        );
        return;
      }

      toast.error('Login Google gagal dimulai. Silakan coba lagi.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleMainClick}
      disabled={disabled || busy}
      className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800 font-bold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer shadow-2xs disabled:opacity-60"
    >
      <GoogleLogoSvg className="w-4 h-4 shrink-0" />
      {busy ? 'Menghubungkan Google...' : 'Lanjutkan dengan Google'}
    </button>
  );
};

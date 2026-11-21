import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, KeyRound, Mail, Plus, User as UserIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  clearCustomGoogleClientId,
  completeGoogleSignInToSupabase,
  decodeGoogleJwt,
  getGoogleClientId,
  getRememberedGoogleAccounts,
  hasCustomGoogleClientId,
  saveCustomGoogleClientId,
  type RememberedGoogleAccount,
} from '../lib/googleAuth';
import { isGoogleProviderEnabled, isSupabaseConfigured, supabase } from '../lib/supabase';

interface GoogleAccountsNamespace {
  accounts?: {
    id?: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'large' | 'medium' | 'small';
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
          width?: number | string;
        }
      ) => void;
      prompt: () => void;
    };
  };
}

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onRequireSupabaseSetup?: () => void;
  disabled?: boolean;
}

const GoogleLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
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

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onRequireSupabaseSetup,
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [remembered, setRemembered] = useState<RememberedGoogleAccount[]>(() =>
    getRememberedGoogleAccounts()
  );
  const [showAddForm, setShowAddForm] = useState(
    () => getRememberedGoogleAccounts().length === 0
  );
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [showGsiSetup, setShowGsiSetup] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(() =>
    hasCustomGoogleClientId() ? getGoogleClientId() : ''
  );
  const [customGsiReady, setCustomGsiReady] = useState(hasCustomGoogleClientId);
  const gsiContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chooserOpen || !customGsiReady) return;
    const g = (window as unknown as { google?: GoogleAccountsNamespace }).google;
    if (!g?.accounts?.id || !gsiContainerRef.current) return;

    try {
      g.accounts.id.initialize({
        client_id: getGoogleClientId(),
        callback: async (res) => {
          if (!res.credential) return;
          const decoded = decodeGoogleJwt(res.credential);
          if (!decoded) {
            toast.error('Token Google tidak valid.');
            return;
          }
          setBusy(true);
          const result = await completeGoogleSignInToSupabase(decoded);
          setBusy(false);
          if (!result.ok) {
            toast.error(result.error ?? 'Gagal masuk dengan Google');
            return;
          }
          setRemembered(getRememberedGoogleAccounts());
          setChooserOpen(false);
          toast.success(
            result.isNewUser
              ? `Akun Google ${decoded.email} dibuat & langsung masuk!`
              : `Berhasil masuk sebagai ${decoded.name}!`
          );
          onSuccess?.();
        },
      });
      gsiContainerRef.current.innerHTML = '';
      g.accounts.id.renderButton(gsiContainerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 340,
      });
    } catch {
      // ignore GSI init errors when script is still loading
    }
  }, [chooserOpen, customGsiReady, onSuccess]);

  const handleMainClick = async () => {
    if (!isSupabaseConfigured) {
      onRequireSupabaseSetup?.();
      toast.error('Hubungkan kredensial Supabase terlebih dahulu.');
      return;
    }

    setBusy(true);
    const oauthEnabled = await isGoogleProviderEnabled();
    if (oauthEnabled) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
        },
      });
      if (error) {
        toast.error(error.message);
        setBusy(false);
      }
      return;
    }

    setBusy(false);
    setRemembered(getRememberedGoogleAccounts());
    setShowAddForm(getRememberedGoogleAccounts().length === 0);
    setChooserOpen(true);
  };

  const handleAccountSignIn = async (
    targetEmail: string,
    targetName?: string,
    picture?: string,
    sub?: string
  ) => {
    setBusy(true);
    const result = await completeGoogleSignInToSupabase({
      email: targetEmail,
      name: targetName || targetEmail.split('@')[0],
      picture,
      sub,
    });
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error ?? 'Gagal masuk dengan akun Google');
      return;
    }

    setRemembered(getRememberedGoogleAccounts());
    setChooserOpen(false);
    toast.success(
      result.isNewUser
        ? `Akun cloud ${targetEmail} dibuat & langsung masuk!`
        : `Masuk sebagai ${targetEmail}`
    );
    onSuccess?.();
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAccountSignIn(email, displayName);
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveCustomGoogleClientId(clientIdInput)) {
      toast.error(
        'Masukkan Google OAuth Client ID valid (diakhiri .apps.googleusercontent.com).'
      );
      return;
    }
    setCustomGsiReady(true);
    toast.success('Google Client ID tersimpan! Tombol Google Sign-In native aktif.');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleMainClick}
        disabled={disabled || busy}
        className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition cursor-pointer shadow-2xs disabled:opacity-60"
      >
        <GoogleLogoSvg className="w-4 h-4 shrink-0" />
        {busy ? 'Menghubungkan Google...' : 'Lanjutkan dengan Google'}
      </button>

      {chooserOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChooserOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Masuk dengan Google"
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 animate-scale-in text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <GoogleLogoSvg className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Masuk dengan Google
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih atau masukkan akun Gmail untuk sinkronisasi cloud
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {customGsiReady && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center gap-2">
                <div ref={gsiContainerRef} />
                <button
                  type="button"
                  onClick={() => {
                    clearCustomGoogleClientId();
                    setCustomGsiReady(false);
                    setClientIdInput('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  Hapus Google Client ID kustom
                </button>
              </div>
            )}

            {remembered.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Akun Google Tersimpan
                </div>
                <div className="space-y-1.5">
                  {remembered.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleAccountSignIn(
                          acc.email,
                          acc.name,
                          acc.picture,
                          acc.sub
                        )
                      }
                      className="w-full p-2.5 rounded-xl bg-[#fffaf6] hover:bg-[#fff3e8] border border-[#e7d1c3] hover:border-[#59171b] flex items-center gap-3 text-left transition cursor-pointer disabled:opacity-60"
                    >
                      {acc.picture ? (
                        <img
                          src={acc.picture}
                          alt={acc.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#e7d1c3] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#59171b] to-[#83262c] text-[#fed7b8] font-extrabold text-xs flex items-center justify-center shrink-0">
                          {acc.name[0]?.toUpperCase() || 'G'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[#241113] truncate">
                          {acc.name}
                        </div>
                        <div className="text-xs font-medium text-[#5c3d40] truncate">
                          {acc.email}
                        </div>
                      </div>
                      <Check className="w-4 h-4 text-[#59171b] shrink-0" />
                    </button>
                  ))}
                </div>

                {!showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-red-600" />
                    Gunakan Akun Google Lain
                  </button>
                )}
              </div>
            )}

            {showAddForm && (
              <form onSubmit={handleSubmitForm} className="space-y-3">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="nama@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                  />
                </div>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Nama Tampilan (opsional)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-crimson w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <GoogleLogoSvg className="w-4 h-4 bg-white rounded-full p-0.5" />
                  {busy ? 'Memproses...' : 'Masuk dengan Akun Google Ini'}
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGsiSetup(!showGsiSetup)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                Hubungkan Google Cloud Client ID (opsional)
                {showGsiSetup ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {showGsiSetup && (
                <form
                  onSubmit={handleSaveClientId}
                  className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="xxxx.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Aktifkan Popup Google GSI
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

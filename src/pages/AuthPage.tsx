import React, { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export const AuthPage: React.FC = () => {
  const {
    user,
    loading,
    passwordRecoveryMode,
    clearPasswordRecovery,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const fromPath =
    (location.state as { from?: string } | null)?.from || '/dashboard';

  const initialModeParam = searchParams.get('mode');
  const [mode, setMode] = useState<AuthMode>(() => {
    if (initialModeParam === 'signup') return 'signup';
    if (initialModeParam === 'forgot') return 'forgot';
    if (initialModeParam === 'reset') return 'reset';
    return 'signin';
  });

  const activeMode: AuthMode = passwordRecoveryMode ? 'reset' : mode;
  const isCallbackRoute = location.pathname.endsWith('/auth/callback');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [callbackTimedOut, setCallbackTimedOut] = useState(false);

  useEffect(() => {
    if (!isCallbackRoute) return;
    const timer = setTimeout(() => {
      setCallbackTimedOut(true);
    }, 4500);
    return () => clearTimeout(timer);
  }, [isCallbackRoute]);

  useEffect(() => {
    const legacyParams = [
      'goic_error',
      'goic_email',
      'goic_name',
      'goic_picture',
      'goic_sub',
    ];
    if (legacyParams.some((k) => searchParams.has(k))) {
      const next = new URLSearchParams(searchParams);
      legacyParams.forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const errorCode =
      searchParams.get('error') || hashParams.get('error') || '';
    const errorDescription =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      '';

    if (!errorCode && !errorDescription) return;

    toast.error(
      `Login Google gagal: ${errorDescription || errorCode}`.slice(0, 220)
    );

    if (searchParams.has('error') || searchParams.has('error_description')) {
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      next.delete('error_description');
      next.delete('error_code');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!loading && user && activeMode !== 'reset') {
    return <Navigate to={fromPath} replace />;
  }

  if (isCallbackRoute && !callbackTimedOut) {
    return (
      <div className="min-h-screen app-bg-canvas flex items-center justify-center p-4">
        <div className="card-pro p-8 max-w-sm w-full text-center space-y-4 animate-scale-in">
          <div className="w-8 h-8 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h1 className="font-bold text-slate-900">
              Menyelesaikan Autentikasi
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Memverifikasi sesi Supabase Anda, mohon tunggu sebentar...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const ensureConfigured = () => {
    if (isSupabaseConfigured) return true;
    toast.error('Layanan autentikasi belum siap. Silakan coba beberapa saat lagi.');
    return false;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ensureConfigured()) return;
    setSubmitting(true);

    try {
      if (activeMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Berhasil masuk!');
        navigate(fromPath, { replace: true });
      } else if (activeMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
            data: {
              full_name: fullName.trim() || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success('Akun dibuat dan langsung masuk!');
          navigate(fromPath, { replace: true });
        } else {
          toast.success(
            'Akun dibuat! Cek kotak masuk email Anda untuk konfirmasi.'
          );
          setMode('signin');
        }
      } else if (activeMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}login?mode=reset`,
        });
        if (error) throw error;
        toast.success('Link reset password telah dikirim ke email Anda.');
        setMode('signin');
      } else {
        if (password !== confirmPassword) {
          throw new Error('Konfirmasi password tidak cocok.');
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        clearPasswordRecovery();
        toast.success('Password berhasil diperbarui!');
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Autentikasi gagal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen app-bg-canvas text-slate-900 flex flex-col justify-center px-4 py-10 relative overflow-x-hidden">
      <div className="max-w-md w-full mx-auto space-y-5 relative z-10 animate-fade-up">
        {user ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600 app-canvas-subtitle transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-rose-600 app-canvas-subtitle transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur border border-rose-200 text-[11px] font-bold text-rose-700 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              Wajib Masuk untuk Lanjut
            </div>
          </div>
        )}

        <div className="card-pro p-6 sm:p-7 space-y-5 animate-scale-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center font-extrabold shadow-sm shadow-rose-500/25 shrink-0">
                I
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                  {activeMode === 'signin'
                    ? 'Masuk ke ImmersionTrack'
                    : activeMode === 'signup'
                      ? 'Buat Akun Baru'
                      : activeMode === 'forgot'
                        ? 'Reset Password'
                        : 'Atur Password Baru'}
                </h1>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {isCallbackRoute && callbackTimedOut
                    ? 'Sesi callback selesai atau kadaluarsa. Silakan masuk ulang.'
                    : 'Simpan & sinkronkan progres immersion lintas perangkat.'}
                </p>
              </div>
            </div>
            {isSupabaseConfigured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 shrink-0">
                <ShieldCheck className="w-3 h-3" />
                Cloud Siap
              </span>
            )}
          </div>

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMode === 'signin'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk Akun
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMode === 'signup'
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Baru
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3">
            {activeMode === 'signup' && (
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Nama Tampilan (misal: Maulana)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>
            )}

            {activeMode !== 'reset' && (
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="Alamat Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>
            )}

            {activeMode !== 'forgot' && (
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder={
                    activeMode === 'reset'
                      ? 'Password baru (min. 8 karakter)'
                      : 'Password (min. 8 karakter)'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>
            )}

            {activeMode === 'reset' && (
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Konfirmasi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>
            )}

            {activeMode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:underline cursor-pointer"
                >
                  Lupa password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-crimson w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Zap className="w-4 h-4" />
              {submitting
                ? 'Memproses...'
                : activeMode === 'signin'
                  ? 'Masuk dengan Email'
                  : activeMode === 'signup'
                    ? 'Daftar & Langsung Masuk'
                    : activeMode === 'forgot'
                      ? 'Kirim Link Reset Password'
                      : 'Simpan Password Baru'}
            </button>
          </form>

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <>
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span>opsi lain</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <GoogleSignInButton
                onSuccess={() => navigate(fromPath, { replace: true })}
                disabled={submitting}
              />
            </>
          )}

          <div className="pt-3 border-t border-slate-100 space-y-2 text-center text-xs font-medium text-slate-500">
            {activeMode === 'forgot' && (
              <p>
                Sudah ingat password Anda?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  Kembali masuk
                </button>
              </p>
            )}

            <p className="text-[11px] text-slate-400">
              Data immersion, target harian, dan sinkronisasi Anki tersimpan aman di akun Supabase Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

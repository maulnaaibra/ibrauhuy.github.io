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
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  saveRuntimeSupabaseConfig,
  SUPABASE_SCHEMA_SQL,
  supabase,
  testSupabaseConnection,
} from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export const AuthPage: React.FC = () => {
  const {
    user,
    loading,
    isDemoMode,
    passwordRecoveryMode,
    clearPasswordRecovery,
    enterDemoMode,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

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

  const [showSetup, setShowSetup] = useState(false);
  const [sbUrl, setSbUrl] = useState(() => getSupabaseConfig().url);
  const [sbKey, setSbKey] = useState(() => getSupabaseConfig().anonKey);
  const [sbReady, setSbReady] = useState(() => isSupabaseConfigured);
  const [testingSb, setTestingSb] = useState(false);

  useEffect(() => {
    if (!isCallbackRoute) return;
    const timer = setTimeout(() => {
      setCallbackTimedOut(true);
    }, 4500);
    return () => clearTimeout(timer);
  }, [isCallbackRoute]);

  if (!loading && user && !isDemoMode && activeMode !== 'reset') {
    return <Navigate to={fromPath} replace />;
  }

  if (isCallbackRoute && !callbackTimedOut) {
    return (
      <div className="min-h-screen bg-[#0e0f11] flex items-center justify-center p-4">
        <div className="surface p-8 max-w-sm w-full text-center space-y-4 animate-modal">
          <div className="w-8 h-8 border-2 border-[#ededef] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h1 className="font-semibold text-[#ededef]">
              Menyelesaikan Autentikasi
            </h1>
            <p className="text-xs text-[#9aa0ac]">
              Memverifikasi sesi Supabase Anda, mohon tunggu sebentar...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const ensureConfigured = () => {
    if (sbReady || isSupabaseConfigured) return true;
    setShowSetup(true);
    toast.error('Hubungkan URL & Anon Key Supabase terlebih dahulu.');
    return false;
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingSb(true);
    const check = await testSupabaseConnection(sbUrl, sbKey);
    if (!check.ok) {
      toast.error(check.message);
      setTestingSb(false);
      return;
    }
    if (saveRuntimeSupabaseConfig(sbUrl, sbKey)) {
      setSbReady(true);
      setShowSetup(false);
      toast.success(check.message);
    } else {
      toast.error('URL atau Anon Key Supabase tidak valid.');
    }
    setTestingSb(false);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      toast.success('Skrip SQL disalin! Jalankan di SQL Editor Supabase.');
    } catch {
      toast.error('Gagal menyalin otomatis. Salin dari Pengaturan.');
    }
  };

  const handleGoogleLogin = async () => {
    if (!ensureConfigured()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
    }
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

  const handleContinueLocal = () => {
    enterDemoMode();
    navigate(fromPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-[#ededef] flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-5 animate-modal">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#9aa0ac] hover:text-[#ededef] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Beranda
        </Link>

        <div className="surface p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#ededef] text-[#111215] flex items-center justify-center font-bold">
              I
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#ededef] leading-tight">
                {activeMode === 'signin'
                  ? 'Masuk ke ImmersionTrack'
                  : activeMode === 'signup'
                    ? 'Daftar Akun Baru'
                    : activeMode === 'forgot'
                      ? 'Reset Password'
                      : 'Atur Password Baru'}
              </h1>
              <p className="text-xs text-[#9aa0ac] mt-0.5">
                {isCallbackRoute && callbackTimedOut
                  ? 'Sesi callback selesai atau kadaluarsa. Silakan masuk ulang.'
                  : 'Lindungi & sinkronkan progres Anda dengan Supabase Auth.'}
              </p>
            </div>
          </div>

          {!sbReady && !isSupabaseConfigured && (
            <div className="p-3 rounded-lg bg-[#1b1e23] border border-[#242730] text-xs text-[#9aa0ac] space-y-1.5">
              <p>
                Kredensial Supabase belum terpasang di{' '}
                <code className="font-mono text-[#ededef]">.env.local</code>.
              </p>
              <button
                type="button"
                onClick={() => setShowSetup(!showSetup)}
                className="font-medium underline text-[#ededef] cursor-pointer"
              >
                {showSetup
                  ? 'Sembunyikan Pengaturan Supabase'
                  : 'Masukkan Project URL & Anon Key Supabase Sekarang'}
              </button>
            </div>
          )}

          {showSetup && (
            <form
              onSubmit={handleSaveSupabase}
              className="p-4 rounded-lg bg-[#121316] border border-[#242730] space-y-2.5 animate-modal"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ededef]">
                  <Database className="w-3.5 h-3.5 text-[#9aa0ac]" />
                  Koneksi Supabase
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5cd697] hover:underline cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Salin SQL Tabel
                </button>
              </div>
              <input
                type="url"
                required
                placeholder="https://xxxx.supabase.co"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs font-mono"
              />
              <input
                type="text"
                required
                placeholder="Anon Public Key"
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                className="input-field w-full px-3 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                disabled={testingSb}
                className="btn-primary w-full py-2 rounded-lg text-xs font-medium cursor-pointer"
              >
                {testingSb ? 'Menguji...' : 'Test & Simpan Supabase'}
              </button>
            </form>
          )}

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="btn-secondary w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-[#5cd697]" />
                Lanjutkan dengan Google
              </button>

              <div className="flex items-center gap-3 text-xs text-[#6c727f]">
                <div className="h-px flex-1 bg-[#242730]" />
                <span>atau dengan email</span>
                <div className="h-px flex-1 bg-[#242730]" />
              </div>
            </>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            {activeMode === 'signup' && (
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Nama Tampilan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
            )}

            {activeMode !== 'reset' && (
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
            )}

            {activeMode !== 'forgot' && (
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={
                    activeMode === 'reset'
                      ? 'Password baru (min. 6 karakter)'
                      : 'Password (min. 6 karakter)'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
            )}

            {activeMode === 'reset' && (
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Konfirmasi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
            )}

            {activeMode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs font-medium text-[#9aa0ac] hover:text-[#ededef] hover:underline cursor-pointer"
                >
                  Lupa password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 rounded-lg font-medium text-sm cursor-pointer"
            >
              {submitting
                ? 'Memproses...'
                : activeMode === 'signin'
                  ? 'Masuk'
                  : activeMode === 'signup'
                    ? 'Daftar Akun'
                    : activeMode === 'forgot'
                      ? 'Kirim Link Reset Password'
                      : 'Simpan Password Baru'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#242730] space-y-2.5 text-center text-xs text-[#9aa0ac]">
            {activeMode === 'signin' && (
              <p>
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-[#ededef] font-medium hover:underline cursor-pointer"
                >
                  Daftar sekarang
                </button>
              </p>
            )}
            {(activeMode === 'signup' || activeMode === 'forgot') && (
              <p>
                Sudah ingat atau punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-[#ededef] font-medium hover:underline cursor-pointer"
                >
                  Kembali masuk
                </button>
              </p>
            )}

            <button
              type="button"
              onClick={handleContinueLocal}
              className="btn-secondary w-full py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              Atau lanjutkan dengan Workspace Lokal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

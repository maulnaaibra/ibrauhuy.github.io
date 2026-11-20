import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Clock,
  Database,
  Lock,
  Mail,
  MonitorSmartphone,
  Target,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  saveRuntimeSupabaseConfig,
  supabase,
  testSupabaseConnection,
} from '../lib/supabase';
import { MediaCover } from '../components/MediaCover';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, loading, enterDemoMode } = useAuth();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [showSupabaseSetup, setShowSupabaseSetup] = useState(false);
  const [sbUrl, setSbUrl] = useState(() => getSupabaseConfig().url);
  const [sbKey, setSbKey] = useState(() => getSupabaseConfig().anonKey);
  const [sbReady, setSbReady] = useState(() => isSupabaseConfigured);
  const [testingSb, setTestingSb] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleOpenDashboard = () => {
    enterDemoMode();
    navigate('/dashboard');
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
    const saved = saveRuntimeSupabaseConfig(sbUrl, sbKey);
    if (saved) {
      setSbReady(true);
      setShowSupabaseSetup(false);
      toast.success(check.message);
    } else {
      toast.error('URL atau Anon Key tidak valid');
    }
    setTestingSb(false);
  };

  const handleGoogleLogin = async () => {
    if (!sbReady && !isSupabaseConfigured) {
      setShowSupabaseSetup(true);
      toast.error('Hubungkan kredensial Supabase terlebih dahulu di bawah.');
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sbReady && !isSupabaseConfigured) {
      setShowSupabaseSetup(true);
      toast.error('Hubungkan kredensial Supabase terlebih dahulu di bawah.');
      return;
    }
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success(
          'Akun dibuat! Cek email untuk verifikasi atau langsung masuk.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Berhasil masuk!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Autentikasi gagal';
      toast.error(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] text-[#ededef] flex flex-col">
      {/* Minimal Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0e0f11]/95 backdrop-blur-sm border-b border-[#242730]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1b1e23] border border-[#2c303a] flex items-center justify-center font-semibold text-xs text-[#ededef]">
              I
            </div>
            <span className="font-semibold text-sm tracking-tight text-[#ededef]">
              ImmersionTrack
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9aa0ac]">
            <a
              href="#preview"
              className="hover:text-[#ededef] transition-colors"
            >
              Ringkasan
            </a>
            <a href="#fitur" className="hover:text-[#ededef] transition-colors">
              Fitur
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#9aa0ac] hover:text-[#ededef] hover:bg-[#1b1e23] transition-colors cursor-pointer"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Buka Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-24 space-y-20">
        {/* Clean Editorial Hero */}
        <section className="max-w-2xl space-y-5">
          <p className="text-xs font-mono text-[#9aa0ac]">
            Pelacak Immersion Bahasa · PC & HP
          </p>

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.12] text-[#ededef]">
            Catat dan ukur konsistensi immersion bahasamu.
          </h1>

          <p className="text-[#9aa0ac] text-sm sm:text-base leading-relaxed">
            Satu tempat tenang untuk mencatat sesi anime, manga, visual novel,
            podcast, hingga Anki—lengkap dengan stopwatch latar belakang dan
            pelacakan otomatis dari Windows.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="btn-primary px-5 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Mulai Tracking
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="btn-secondary px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer"
            >
              Sinkronisasi Akun Cloud
            </button>
          </div>
        </section>

        {/* Flat Workspace Preview (no macOS traffic light mockup) */}
        <section id="preview" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#6c727f]">
            <span className="font-mono">nihongotracker.my.id/dashboard</span>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="text-[#9aa0ac] hover:text-[#ededef] transition-colors cursor-pointer"
            >
              Masuk Workspace →
            </button>
          </div>

          <div className="surface overflow-hidden">
            {/* Preview top metrics */}
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#242730]">
              <div className="p-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                  <span>Target Hari Ini</span>
                  <span className="font-mono text-[#5cd697]">75%</span>
                </div>
                <div className="text-xl font-semibold font-mono text-[#ededef]">
                  68 <span className="text-xs font-normal text-[#6c727f]">/ 90 mnt</span>
                </div>
                <div className="progress-track h-1.5">
                  <div className="progress-fill h-full w-3/4" />
                </div>
              </div>

              <div className="p-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                  <span>Streak Aktif</span>
                  <span className="font-mono text-[#6c727f]">Rekor 24h</span>
                </div>
                <div className="text-xl font-semibold font-mono text-[#ededef]">
                  12 <span className="text-xs font-normal text-[#6c727f]">hari</span>
                </div>
                <div className="text-xs font-mono text-[#6c727f]">
                  34.3 jam total · 184 kartu
                </div>
              </div>

              <div className="p-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                  <span>Bulan Ini</span>
                  <span className="font-mono text-[#5cd697]">+42%</span>
                </div>
                <div className="text-xl font-semibold font-mono text-[#ededef]">
                  28.4 jam
                </div>
                <div className="text-xs font-mono text-[#6c727f]">
                  Listening 15.8j · Reading 11.4j
                </div>
              </div>
            </div>

            {/* Preview media row */}
            <div className="border-t border-[#242730] bg-[#121316]/60 p-4 grid sm:grid-cols-3 gap-3">
              {[
                {
                  title: 'Sousou no Frieren',
                  category: 'anime' as const,
                  label: 'Anime',
                  stat: '8.5 jam · 1,180 XP',
                },
                {
                  title: 'Steins;Gate',
                  category: 'visual_novel' as const,
                  label: 'Visual Novel',
                  stat: '6.2 jam · 1,120 XP',
                },
                {
                  title: 'Yotsuba&! Vol. 4',
                  category: 'manga' as const,
                  label: 'Manga',
                  stat: '4.1 jam · 690 XP',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="p-2.5 rounded-lg bg-[#16181c] border border-[#242730] flex items-center gap-3"
                >
                  <MediaCover
                    title={card.title}
                    category={card.category}
                    className="w-10 h-14 rounded-md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-[#6c727f]">
                      {card.label}
                    </div>
                    <div className="text-sm font-medium text-[#ededef] truncate">
                      {card.title}
                    </div>
                    <div className="text-xs font-mono text-[#9aa0ac]">
                      {card.stat}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Clean Feature Grid */}
        <section id="fitur" className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-[#ededef]">
              Dirancang untuk pemakaian harian jangka panjang
            </h2>
            <p className="text-sm text-[#9aa0ac]">
              Fokus pada pencatatan cepat, analitik jelas, dan sinkronisasi
              perangkat tanpa gangguan visual.
            </p>
          </div>

          <div className="surface grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#242730]">
            {[
              {
                icon: Clock,
                title: 'Timer Latar Belakang',
                desc: 'Stopwatch persisten lintas tab dan HP yang tetap akurat walau layar dikunci.',
              },
              {
                icon: MonitorSmartphone,
                title: 'PC Agent & AnkiConnect',
                desc: 'Pantau MPV, VLC, Anki, dan browser di Windows secara otomatis di latar belakang.',
              },
              {
                icon: Target,
                title: 'Target & Analisis Pace',
                desc: 'Perbandingan bulan berjalan serta kebutuhan menit harian agar target tercapai.',
              },
              {
                icon: Award,
                title: 'Heatmap & Milestone',
                desc: 'Peta aktivitas 12 bulan, pembagian Listening/Reading, dan target ribuan jam.',
              },
            ].map((item) => (
              <div key={item.title} className="p-5 space-y-2.5">
                <item.icon className="w-4 h-4 text-[#9aa0ac]" />
                <h3 className="font-medium text-[#ededef] text-sm">
                  {item.title}
                </h3>
                <p className="text-xs text-[#9aa0ac] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto animate-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl bg-[#16181c] border border-[#2c303a] p-6 space-y-5 my-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#ededef]">
                  {isSignUp ? 'Buat Akun ImmersionTrack' : 'Masuk ke Akun'}
                </h2>
                <p className="text-xs text-[#9aa0ac] mt-0.5">
                  Sinkronkan progres lintas perangkat lewat Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                aria-label="Tutup"
                className="p-1.5 rounded-lg text-[#6c727f] hover:text-[#ededef] hover:bg-[#21242b] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!sbReady && !isSupabaseConfigured && (
              <div className="p-3 rounded-lg bg-[#262013] border border-[#3d331d] text-xs text-[#e5b55c]">
                Kredensial Supabase belum terhubung. Anda bisa{' '}
                <button
                  type="button"
                  onClick={() => setShowSupabaseSetup(!showSupabaseSetup)}
                  className="underline font-medium text-[#ededef] cursor-pointer"
                >
                  atur URL & Anon Key sekarang
                </button>{' '}
                atau gunakan{' '}
                <button
                  type="button"
                  onClick={handleOpenDashboard}
                  className="underline font-medium text-[#ededef] cursor-pointer"
                >
                  Workspace Lokal
                </button>
                .
              </div>
            )}

            {showSupabaseSetup && (
              <form
                onSubmit={handleSaveSupabase}
                className="p-3.5 rounded-lg bg-[#121316] border border-[#242730] space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#ededef]">
                  <Database className="w-3.5 h-3.5 text-[#9aa0ac]" />
                  Hubungkan Proyek Supabase
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
                  {testingSb ? 'Menguji Koneksi...' : 'Test & Simpan Koneksi'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="btn-secondary w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Lanjutkan dengan Google
            </button>

            <div className="flex items-center gap-3 text-xs text-[#6c727f]">
              <div className="h-px flex-1 bg-[#242730]" />
              <span>atau email</span>
              <div className="h-px flex-1 bg-[#242730]" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
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
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password (min. 6 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary w-full py-2.5 rounded-lg font-medium text-sm cursor-pointer"
              >
                {isSignUp ? 'Daftar Akun' : 'Masuk dengan Email'}
              </button>
              <div className="flex items-center justify-between text-xs text-[#9aa0ac] pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[#ededef] font-medium hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                </button>
                <Link
                  to="/login?mode=forgot"
                  className="text-[#9aa0ac] hover:text-[#ededef] hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

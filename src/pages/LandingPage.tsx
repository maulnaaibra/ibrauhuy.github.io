import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  Clock,
  Database,
  Flame,
  Lock,
  Mail,
  MonitorSmartphone,
  Sparkles,
  Target,
  Zap,
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
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
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
    <div className="min-h-screen bg-gradient-to-b from-red-50/80 via-white to-slate-50 text-slate-900 flex flex-col relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[340px] bg-gradient-to-b from-red-200/40 via-rose-100/25 to-transparent blur-3xl rounded-full"
      />

      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-bold text-white shadow-sm shadow-red-600/25">
              I
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              ImmersionTrack
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#preview" className="hover:text-red-700 transition-colors">
              Ringkasan
            </a>
            <a href="#fitur" className="hover:text-red-700 transition-colors">
              Fitur
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="btn-crimson px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Buka Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 pb-24 space-y-20 relative z-10">
        <section className="text-center max-w-3xl mx-auto space-y-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-red-200/80 text-red-700 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-red-600" />
            Platform Pelacakan & Analitik Immersion Bahasa
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Ukur Konsistensi & Progres{' '}
            <span className="bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent">
              Immersion Bahasamu
            </span>
          </h1>

          <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Catat setiap sesi menonton anime, membaca manga, visual novel,
            podcast, hingga review Anki dalam satu dashboard yang bersih dan
            terstruktur, lengkap dengan pelacakan otomatis dari PC Windows.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 animate-fade-up delay-1">
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="btn-crimson w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Mulai Tracking Sekarang
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition cursor-pointer shadow-xs"
            >
              Sinkronisasi Akun Cloud
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-slate-600 animate-fade-up delay-2">
            {[
              '9 Kategori Media',
              'Analitik & XP Otomatis',
              'Desktop Tracker + AnkiConnect',
              'Target & Pacing Harian',
            ].map((pill) => (
              <span
                key={pill}
                className="px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs"
              >
                {pill}
              </span>
            ))}
          </div>
        </section>

        <section id="preview" className="animate-fade-up delay-2">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-200/70 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="px-4 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-500">
                nihongotracker.my.id/dashboard
              </div>
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer transition-colors"
              >
                Masuk Workspace →
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5 bg-slate-50/40">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card-pro p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Level & Progres
                    </span>
                    <span className="text-xs font-mono font-semibold text-red-600">
                      6,420 XP
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900">
                    Level 14
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-red-600 to-rose-500 rounded-full animate-bar" />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Listening Lv.11</span>
                    <span>Reading Lv.9</span>
                  </div>
                </div>

                <div className="card-pro p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>Streak Aktif</span>
                    <Flame className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 my-2">
                    12 Hari
                  </div>
                  <p className="text-xs text-slate-500">
                    Rekor terbaik 24 hari • 34.3 jam total
                  </p>
                </div>

                <div className="card-pro p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>Progres Bulan Ini</span>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      ▲ +42%
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 my-2">
                    28.4 Jam
                  </div>
                  <p className="text-xs text-slate-500">
                    Listening 15.8j • Reading 11.4j • Rasio 2 : 3
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    title: 'Sousou no Frieren',
                    category: 'anime' as const,
                    label: 'Anime',
                    stat: '8.5 jam • 1,180 XP',
                  },
                  {
                    title: 'Steins;Gate',
                    category: 'visual_novel' as const,
                    label: 'Visual Novel',
                    stat: '6.2 jam • 1,120 XP',
                  },
                  {
                    title: 'Yotsuba&! Vol. 4',
                    category: 'manga' as const,
                    label: 'Manga',
                    stat: '4.1 jam • 690 XP',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="card-pro p-3 flex items-center gap-3 group"
                  >
                    <MediaCover
                      title={card.title}
                      category={card.category}
                      className="w-11 h-14 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {card.label}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {card.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {card.stat}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="space-y-8 animate-fade-up delay-3">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Dirancang untuk Pelajar Bahasa Jangka Panjang
            </h2>
            <p className="text-sm text-slate-600">
              Pencatatan cepat tanpa gangguan, analitik akurat, dan sinkronisasi
              langsung ke perangkat Anda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Clock,
                title: 'Riwayat Visual & Timer',
                desc: 'Stopwatch persisten lintas tab & HP, dilengkapi sampul media pada setiap riwayat sesi.',
              },
              {
                icon: MonitorSmartphone,
                title: 'Koneksi PC & AnkiConnect',
                desc: 'Agent Windows memantau MPV, VLC, Anki, dan browser secara otomatis di latar belakang.',
              },
              {
                icon: Target,
                title: 'Target & Analisis Pace',
                desc: 'Pantau perbandingan bulan ini vs bulan lalu serta kebutuhan menit harian agar target tercapai.',
              },
              {
                icon: Award,
                title: 'Milestone & Achievement',
                desc: 'Level Overall, Listening, Reading, heatmap tahunan, dan pencapaian hingga ribuan jam.',
              },
            ].map((item) => (
              <div key={item.title} className="card-pro p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                  <item.icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 my-auto animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isSignUp ? 'Buat Akun ImmersionTrack' : 'Masuk ke Akun'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sinkronkan progresmu lintas perangkat lewat Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {!sbReady && !isSupabaseConfigured && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
                <div>
                  Kredensial Supabase belum terhubung. Anda bisa{' '}
                  <button
                    type="button"
                    onClick={() => setShowSupabaseSetup(!showSupabaseSetup)}
                    className="underline font-semibold text-red-700 cursor-pointer"
                  >
                    atur URL & Anon Key Supabase sekarang
                  </button>{' '}
                  atau langsung pakai{' '}
                  <button
                    type="button"
                    onClick={handleOpenDashboard}
                    className="underline font-semibold text-slate-900 cursor-pointer"
                  >
                    Workspace Lokal
                  </button>
                  .
                </div>
              </div>
            )}

            {showSupabaseSetup && (
              <form
                onSubmit={handleSaveSupabase}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Database className="w-3.5 h-3.5 text-red-600" />
                  Hubungkan Proyek Supabase
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://xxxx.supabase.co"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Anon Public Key"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={testingSb}
                  className="btn-crimson w-full py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {testingSb ? 'Menguji Koneksi...' : 'Test & Simpan Koneksi'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-slate-50 transition disabled:opacity-60 cursor-pointer shadow-2xs"
            >
              <BarChart3 className="w-4 h-4 text-red-600" />
              Lanjutkan dengan Google
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>atau email</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password (min. 6 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="btn-crimson w-full py-2.5 rounded-xl font-semibold text-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                {isSignUp ? 'Daftar Akun' : 'Masuk dengan Email'}
              </button>
              <p className="text-xs text-center text-slate-500">
                {isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-red-600 font-semibold hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Masuk' : 'Daftar'}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

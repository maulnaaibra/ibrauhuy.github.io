import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BarChart3,
  Clock,
  Flame,
  Lock,
  Mail,
  Play,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, loading, enterDemoMode } = useAuth();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleStartDemo = () => {
    enterDemoMode();
    toast.success('Mode Demo aktif — selamat menjelajah progres immersion!');
    navigate('/dashboard');
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      toast.error(
        'Supabase belum dikonfigurasi di .env.local. Gunakan Coba Demo Dashboard dulu!'
      );
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error(
        'Supabase belum dikonfigurasi di .env.local. Gunakan Coba Demo Dashboard dulu!'
      );
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
    <div className="min-h-screen bg-[#0e1218] text-slate-100 flex flex-col relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-gradient-to-b from-indigo-600/20 via-pink-500/10 to-transparent blur-3xl"
      />

      <header className="sticky top-0 z-30 bg-[#0e1218]/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              I
            </div>
            <span className="font-bold text-base tracking-tight">
              ImmersionTrack
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#preview" className="hover:text-white transition">
              Preview
            </a>
            <a href="#alur" className="hover:text-white transition">
              Cara Kerja
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={handleStartDemo}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition cursor-pointer shadow-lg shadow-indigo-600/25"
            >
              Coba Demo
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 pb-20 space-y-20 relative z-10">
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Terinspirasi oleh NihongoTracker • Dibangun untuk pembelajar berbasis input
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08]">
            Lacak & Gamifikasi{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Immersion Bahasamu
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Ubah setiap episode anime, halaman manga, visual novel, dan podcast
            menjadi XP, level skill, heatmap konsistensi, serta target pace
            yang terasa memotivasi setiap hari.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartDemo}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-xl shadow-indigo-600/30"
            >
              <Play className="w-4 h-4 fill-current" />
              Coba Demo Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#171c26] hover:bg-[#1e2432] border border-white/[0.1] text-slate-200 font-semibold text-sm transition cursor-pointer"
            >
              Masuk / Daftar Akun
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-400">
            {[
              '9 Tipe Media',
              'Sistem XP & Level',
              'Pace-Aware Goals',
              '16 Achievements',
              'Tanpa Login di Mode Demo',
            ].map((pill) => (
              <span
                key={pill}
                className="px-3 py-1 rounded-full bg-[#171c26] border border-white/[0.07]"
              >
                {pill}
              </span>
            ))}
          </div>
        </section>

        <section id="preview" className="space-y-4">
          <div className="rounded-2xl bg-[#131720] border border-white/[0.1] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-[#171c26] border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="px-4 py-1 rounded-lg bg-[#0e1218] border border-white/[0.06] text-[11px] font-mono text-slate-400">
                immersiontrack.app/dashboard
              </div>
              <button
                type="button"
                onClick={handleStartDemo}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                Buka Interaktif →
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Welcome back
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Maulana — Japanese Track
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white">
                    + Catat Sesi
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-pink-500/15 border border-pink-500/30 text-xs font-semibold text-pink-300">
                    Lv. 14 • Input Grinder
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#171c26] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">
                      OVERALL LEVEL
                    </span>
                    <span className="text-xs font-mono text-indigo-300">
                      6,420 XP
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    Level 14
                  </div>
                  <div className="h-2 rounded-full bg-[#0e1218] overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Listening Lv.11</span>
                    <span>Reading Lv.9</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/15 via-[#171c26] to-[#171c26] border border-pink-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-pink-300">
                    <span>STREAK AKTIF</span>
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    12 Hari
                  </div>
                  <p className="text-xs text-slate-400">
                    Rekor terbaik: 24 hari • Terus jaga apimu!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/15 via-[#171c26] to-[#171c26] border border-emerald-500/25 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span>BULAN INI</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">
                      ▲ +42% vs lalu
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    28.4 Jam
                  </div>
                  <p className="text-xs text-slate-400">
                    Listening 15.8j • Reading 11.4j • Rasio 2 : 3
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    title: 'Sousou no Frieren',
                    type: 'Anime',
                    color: '#06b6d4',
                    stat: '8.5 jam • +1,180 XP',
                  },
                  {
                    title: 'Steins;Gate',
                    type: 'Visual Novel',
                    color: '#3b82f6',
                    stat: '6.2 jam • +1,120 XP',
                  },
                  {
                    title: 'Yotsuba&! Vol. 4',
                    type: 'Manga',
                    color: '#f43f5e',
                    stat: '4.1 jam • +690 XP',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="p-3.5 rounded-xl bg-[#171c26] border border-white/[0.08] flex items-center justify-between gap-2"
                    style={{ borderLeft: `3px solid ${card.color}` }}
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-400">
                        {card.type} • QUICK LOG
                      </div>
                      <div className="text-sm font-semibold text-white truncate">
                        {card.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {card.stat}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shrink-0">
                      + Log
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="alur" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Dari Catatan Sesi ke Progres Terukur
            </h2>
            <p className="text-sm text-slate-400">
              Setiap widget dirancang agar progres jangka panjangmu terasa nyata.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: '01',
                icon: Clock,
                title: 'Quick Log & Stopwatch',
                desc: 'Pilih 9 tipe media atau lanjutkan judul terakhir dengan 1 klik tanpa repot mengetik ulang.',
              },
              {
                step: '02',
                icon: Zap,
                title: 'Level & Skill XP',
                desc: 'Dapatkan XP berbobot tipe media & kartu Anki untuk menaikkan level Overall, Listening, dan Reading.',
              },
              {
                step: '03',
                icon: Target,
                title: 'Pace-Aware Goals',
                desc: 'Tahu persis berapa menit/hari yang dibutuhkan agar target bulananmu tidak tertinggal.',
              },
              {
                step: '04',
                icon: Award,
                title: 'Heatmap & Badges',
                desc: 'Bangun streak tahunan ala GitHub, lihat perbandingan bulan-ke-bulan, dan buka 16 achievement.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-100">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171c26] border border-white/[0.1] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isSignUp ? 'Buat Akun ImmersionTrack' : 'Masuk ke Akun'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sinkronkan progresmu lintas perangkat lewat Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06] cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {!isSupabaseConfigured && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
                Kredensial Supabase di <code className="font-mono">.env.local</code>{' '}
                masih placeholder. Anda tetap bisa langsung mencoba seluruh
                fitur lewat{' '}
                <button
                  type="button"
                  onClick={handleStartDemo}
                  className="underline font-semibold text-white cursor-pointer"
                >
                  Mode Demo Lokal
                </button>
                .
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-3 px-4 rounded-xl bg-white text-slate-950 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-slate-200 transition disabled:opacity-60 cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Lanjutkan dengan Google
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span>atau email</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password (min. 6 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition cursor-pointer"
              >
                {isSignUp ? 'Daftar Akun' : 'Masuk dengan Email'}
              </button>
              <p className="text-xs text-center text-slate-400">
                {isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-indigo-400 hover:underline cursor-pointer"
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

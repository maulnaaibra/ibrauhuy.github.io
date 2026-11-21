import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calculator,
  Clock,
  Compass,
  Database,
  Flame,
  Lock,
  Mail,
  MonitorSmartphone,
  Sparkles,
  Target,
  Trophy,
  Users,
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
import {
  COMMUNITY_ACTIVITY_FEED,
  COMMUNITY_LEADERBOARD,
  JLPT_MILESTONES,
} from '../lib/publicShowcase';
import type { ImmersionCategory } from '../types';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { MediaCatalogBrowser } from '../components/MediaCatalogBrowser';
import { MediaCover } from '../components/MediaCover';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, isDemoMode, enterDemoMode, updateDemoProfile } = useAuth();
  const navigate = useNavigate();

  const isCloudLoggedIn = Boolean(user && !isDemoMode);

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

  const [calcMinutes, setCalcMinutes] = useState(90);
  const [selectedMilestoneCode, setSelectedMilestoneCode] = useState<
    'N4' | 'N3' | 'N2' | 'N1'
  >('N3');

  const calculatorResult = useMemo(() => {
    const target =
      JLPT_MILESTONES.find((m) => m.code === selectedMilestoneCode) ??
      JLPT_MILESTONES[1];
    const totalMinutesNeeded = target.hours * 60;
    const daysNeeded = Math.max(1, Math.ceil(totalMinutesNeeded / calcMinutes));
    const monthsNeeded = (daysNeeded / 30).toFixed(1);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysNeeded);
    const etaLabel = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(targetDate);

    const animeEpisodes = Math.round((target.hours * 0.45 * 60) / 24);
    const mangaVolumes = Math.round(target.hours * 0.35 * 1.4);
    const estimatedCards = Math.round(target.hours * 4.5);
    const weeklyHours = ((calcMinutes * 7) / 60).toFixed(1);

    return {
      target,
      daysNeeded,
      monthsNeeded,
      etaLabel,
      weeklyHours,
      animeEpisodes,
      mangaVolumes,
      estimatedCards,
    };
  }, [calcMinutes, selectedMilestoneCode]);

  const handleOpenDashboard = () => {
    if (!user) {
      enterDemoMode();
    }
    navigate('/dashboard');
  };

  const handleApplyCalculatorGoal = async () => {
    if (!user) {
      enterDemoMode();
    }
    if (!user || isDemoMode) {
      updateDemoProfile({ daily_goal_minutes: calcMinutes });
    }
    toast.success(`Target harian ${calcMinutes} mnt/hari diterapkan!`);
    navigate(`/dashboard?goal=${calcMinutes}`);
  };

  const handleStartMediaFromCatalog = (
    title: string,
    category: ImmersionCategory,
    minutes: number
  ) => {
    if (!user) {
      enterDemoMode();
    }
    const params = new URLSearchParams({
      logTitle: title,
      logCategory: category,
      logDuration: String(minutes),
    });
    navigate(`/dashboard?${params.toString()}`);
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
            data: {
              full_name: email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success('Akun dibuat & langsung masuk ke Dashboard Cloud!');
          setShowAuthModal(false);
          navigate('/dashboard');
        } else {
          toast.success(
            'Akun dibuat! Cek kotak masuk email untuk verifikasi.'
          );
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Berhasil masuk ke akun cloud!');
        setShowAuthModal(false);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Autentikasi gagal';
      toast.error(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-bg-canvas text-[#241113] flex flex-col relative overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#ead6c9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#59171b] to-[#83262c] flex items-center justify-center font-extrabold text-[#fed7b8] shadow-sm shadow-[#59171b]/25">
              I
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#241113]">
              ImmersionTrack
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#5c3d40]">
            <a href="#preview" className="hover:text-[#59171b] transition-colors">
              Ringkasan
            </a>
            <a
              href="#kalkulator"
              className="hover:text-[#59171b] transition-colors"
            >
              Kalkulator JLPT
            </a>
            <a href="#katalog" className="hover:text-[#59171b] transition-colors">
              Katalog 660 Media
            </a>
            <a href="#fitur" className="hover:text-[#59171b] transition-colors">
              Fitur
            </a>
            <a
              href="#komunitas"
              className="hover:text-[#59171b] transition-colors"
            >
              Komunitas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {isCloudLoggedIn ? (
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="btn-crimson px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                Ke Dashboard Anda
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setShowAuthModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-sm font-bold text-[#59171b] hover:bg-[#fed7b8]/45 transition cursor-pointer"
                >
                  Masuk Akun
                </button>
                <button
                  type="button"
                  onClick={handleOpenDashboard}
                  className="btn-crimson px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                >
                  Buka Dashboard
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 pb-20 space-y-24 relative z-10">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-6 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-[#e4bdae] text-[#59171b] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#59171b]" />
            Platform Pelacakan & Analitik Immersion Bahasa
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#241113] app-canvas-title">
            Ukur Konsistensi & Progres{' '}
            <span className="app-canvas-accent">
              Immersion Bahasamu
            </span>
          </h1>

          <p className="text-[#5c3d40] app-canvas-subtitle text-base sm:text-lg font-medium leading-relaxed max-w-2xl mx-auto">
            Catat setiap sesi menonton anime, membaca novel, manga, visual novel,
            podcast, hingga review Anki dalam satu dashboard yang bersih, lengkap
            dengan 660+ katalog rekomendasi media dan pelacakan otomatis Windows.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 animate-fade-up delay-1">
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="btn-crimson w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCloudLoggedIn
                ? 'Lanjutkan Progres Saya'
                : 'Mulai Tracking Sekarang'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {isCloudLoggedIn ? (
              <Link
                to="/settings"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-[#fffaf6] border border-[#e7d1c3] text-[#241113] font-bold text-sm transition shadow-xs text-center"
              >
                Pengaturan & Background
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setShowAuthModal(true);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-[#fffaf6] border border-[#e7d1c3] text-[#241113] font-bold text-sm transition cursor-pointer shadow-xs"
              >
                Daftar & Sinkron Cloud
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs font-semibold text-[#59171b] animate-fade-up delay-2">
            {[
              '660+ Katalog Media Jepang',
              'Analitik & Tahap JLPT N5–N1',
              'Desktop Tracker + AnkiConnect',
              'Background & Tema Bisa Diubah',
            ].map((pill) => (
              <span
                key={pill}
                className="px-3.5 py-1 rounded-full bg-white/95 border border-[#ead6c9] shadow-2xs"
              >
                {pill}
              </span>
            ))}
          </div>
        </section>

        {/* Dashboard Preview */}
        <section id="preview" className="animate-fade-up delay-2">
          <div className="rounded-2xl bg-white/95 border border-[#ead6c9] shadow-xl shadow-[#59171b]/10 overflow-hidden">
            <div className="px-4 py-3 bg-[#fff8f3] border-b border-[#ead6c9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#59171b]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e39d7f]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#fed7b8]" />
              </div>
              <div className="px-4 py-1 rounded-lg bg-white border border-[#e7d1c3] text-[11px] font-mono text-[#5c3d40]">
                nihongotracker.my.id/dashboard
              </div>
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="text-[11px] font-bold text-[#59171b] hover:underline cursor-pointer transition-colors"
              >
                Masuk Workspace →
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5 bg-[#fffdfb]">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="card-pro p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#7c5659]">
                      Tahap Immersion
                    </span>
                    <span className="text-xs font-mono text-[#59171b]">
                      34.3 / 150 Jam
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-[#241113]">
                    Tahap N5 · Dasar
                  </div>
                  <div className="h-2 rounded-full bg-[#f7e9df] overflow-hidden">
                    <div className="h-full w-1/4 bg-gradient-to-r from-[#59171b] to-[#b54842] rounded-full animate-bar" />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#5c3d40] font-mono">
                    <span>Listening 19.8 jam</span>
                    <span>Reading 14.5 jam</span>
                  </div>
                </div>

                <div className="card-pro p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#7c5659]">
                    <span>Streak Aktif</span>
                    <Flame className="w-4 h-4 text-[#59171b]" />
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#241113] my-2">
                    12 Hari
                  </div>
                  <p className="text-xs font-medium text-[#5c3d40]">
                    Rekor terbaik 24 hari • 34.3 jam total
                  </p>
                </div>

                <div className="card-pro p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#7c5659]">
                    <span>Progres Bulan Ini</span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      ▲ +42%
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#241113] my-2">
                    28.4 Jam
                  </div>
                  <p className="text-xs font-medium text-[#5c3d40]">
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
                    stat: '8.5 jam • 21 episode',
                  },
                  {
                    title: 'Steins;Gate',
                    category: 'visual_novel' as const,
                    label: 'Visual Novel',
                    stat: '6.2 jam • 9 sesi',
                  },
                  {
                    title: 'Anki — Core 2k/6k',
                    category: 'study' as const,
                    label: 'Anki / Study',
                    stat: '4.1 jam • +140 kartu',
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
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#7c5659]">
                        {card.label}
                      </div>
                      <div className="text-sm font-bold text-[#241113] truncate">
                        {card.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#5c3d40]">
                        {card.stat}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Kalkulator Target & Estimasi JLPT Interaktif */}
        <section id="kalkulator" className="space-y-6 animate-fade-up delay-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#59171b] app-canvas-subtitle">
                <Calculator className="w-3.5 h-3.5" />
                SIMULASI RENCANA BELAJAR
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241113] app-canvas-title">
                Kalkulator Target & Estimasi JLPT
              </h2>
              <p className="text-sm font-medium text-[#5c3d40] app-canvas-subtitle">
                Atur durasi immersion harian untuk menghitung perkiraan waktu
                mencapai level JLPT tujuanmu.
              </p>
            </div>
          </div>

          <div className="card-pro p-6 sm:p-7 grid lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5c3d40]">
                  1. Pilih Target Milestone JLPT
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {JLPT_MILESTONES.map((item) => {
                    const active = item.code === selectedMilestoneCode;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setSelectedMilestoneCode(item.code)}
                        className={`p-3 rounded-xl text-left border transition cursor-pointer ${
                          active
                            ? 'bg-[#fff3e8] border-[#59171b] shadow-xs'
                            : 'bg-[#fffaf6] border-[#e7d1c3] hover:border-[#b3746d]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-extrabold ${
                              active ? 'text-[#59171b]' : 'text-[#241113]'
                            }`}
                          >
                            JLPT {item.code}
                          </span>
                          <span className="text-[11px] font-mono text-[#5c3d40]">
                            {item.hours.toLocaleString()}j
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-[#5c3d40] mt-0.5 truncate">
                          {item.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="calc-daily-slider"
                    className="text-xs font-bold uppercase tracking-wider text-[#5c3d40]"
                  >
                    2. Komitmen Immersion Harian
                  </label>
                  <span className="text-sm font-mono text-[#59171b]">
                    {calcMinutes} menit / hari ({(calcMinutes / 60).toFixed(1)} jam)
                  </span>
                </div>
                <input
                  id="calc-daily-slider"
                  type="range"
                  min={30}
                  max={240}
                  step={15}
                  value={calcMinutes}
                  onChange={(e) => setCalcMinutes(Number(e.target.value))}
                  className="w-full accent-[#59171b] cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[45, 90, 120, 180].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCalcMinutes(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition cursor-pointer ${
                        calcMinutes === preset
                          ? 'bg-[#59171b] text-[#fff8f2] border-[#59171b]'
                          : 'bg-white text-[#5c3d40] border-[#e7d1c3] hover:border-[#59171b]'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#fed7b8]/45 via-white to-[#fff5ed] border border-[#ebc6b0] space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c3d40]">
                    Estimasi Tercapai
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#241113] mt-0.5">
                    {calculatorResult.etaLabel}
                  </div>
                  <p className="text-xs font-medium text-[#5c3d40] mt-1">
                    Sekitar{' '}
                    <strong className="font-mono text-[#59171b]">
                      {calculatorResult.daysNeeded.toLocaleString()} hari
                    </strong>{' '}
                    ({calculatorResult.monthsNeeded} bulan) dengan{' '}
                    {calcMinutes} mnt/hari.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white border border-[#e7c3ad] text-right shrink-0">
                  <div className="text-[10px] font-bold uppercase text-[#5c3d40]">
                    Beban Mingguan
                  </div>
                  <div className="text-sm font-mono text-[#59171b]">
                    {calculatorResult.weeklyHours} jam/mgg
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-[#ead6c9]">
                  <div className="text-[11px] font-semibold text-[#5c3d40]">Anime</div>
                  <div className="text-base font-extrabold font-mono text-[#241113] mt-0.5">
                    ~{calculatorResult.animeEpisodes}
                  </div>
                  <div className="text-[10px] font-medium text-[#7c5659]">episode</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#ead6c9]">
                  <div className="text-[11px] font-semibold text-[#5c3d40]">Manga</div>
                  <div className="text-base font-extrabold font-mono text-[#241113] mt-0.5">
                    ~{calculatorResult.mangaVolumes}
                  </div>
                  <div className="text-[10px] font-medium text-[#7c5659]">volume</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#ead6c9]">
                  <div className="text-[11px] font-semibold text-[#5c3d40]">Anki Mining</div>
                  <div className="text-base font-extrabold font-mono text-[#241113] mt-0.5">
                    ~{calculatorResult.estimatedCards.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-medium text-[#7c5659]">kartu kosakata</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCalculatorGoal}
                className="btn-crimson w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                Terapkan Target {calcMinutes} mnt/hari ke Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Full 660+ Media Catalog from Spreadsheet */}
        <section id="katalog" className="space-y-6 animate-fade-up delay-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#59171b] app-canvas-subtitle">
              <Compass className="w-3.5 h-3.5" />
              DATABASE REKOMENDASI MEDIA LENGKAP
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241113] app-canvas-title">
              Katalog 660+ Media Immersion (Novels, Anime, Manga, VN & Lainnya)
            </h2>
            <p className="text-sm font-medium text-[#5c3d40] app-canvas-subtitle">
              Diurutkan berdasarkan tingkat kesulitan mulai dari pemula hingga
              mahir. Cari judul, baca penjelasan tingkat kesulitan, lalu mulai
              mencatat sesi dalam 1 klik.
            </p>
          </div>

          <MediaCatalogBrowser
            defaultSection="Novels"
            pageSize={9}
            onStartMedia={handleStartMediaFromCatalog}
          />
        </section>

        {/* Fitur */}
        <section id="fitur" className="space-y-8 animate-fade-up delay-3">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241113] app-canvas-title">
              Dirancang untuk Pelajar Bahasa Jangka Panjang
            </h2>
            <p className="text-sm font-medium text-[#5c3d40] app-canvas-subtitle">
              Pencatatan cepat tanpa gangguan, analitik akurat, dan sinkronisasi
              langsung ke perangkat Anda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Clock,
                title: 'Riwayat Visual & Timer',
                desc: 'Stopwatch persisten lintas tab & HP, dilengkapi sampul media dan logo Anki otomatis.',
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
                title: 'Milestone & Pencapaian',
                desc: 'Pantau tahap kemahiran N5–N1, heatmap tahunan, keseimbangan input, dan pencapaian belajar.',
              },
            ].map((item) => (
              <div key={item.title} className="card-pro p-5 space-y-3">
                <div className="w-9 h-9 rounded-xl bg-[#fff3e8] border border-[#f2c9ab] flex items-center justify-center text-[#59171b]">
                  <item.icon className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-[#241113] text-sm">
                  {item.title}
                </h3>
                <p className="text-xs font-medium text-[#5c3d40] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Peringkat & Aktivitas Komunitas */}
        <section id="komunitas" className="space-y-6 animate-fade-up delay-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#59171b] app-canvas-subtitle">
              <Users className="w-3.5 h-3.5" />
              BELAJAR BERSAMA KOMUNITAS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#241113] app-canvas-title">
              Peringkat & Aktivitas Pelajar
            </h2>
            <p className="text-sm font-medium text-[#5c3d40] app-canvas-subtitle">
              Pantau progres konsistensi mingguan dan bergabunglah dengan pelajar
              immersion lainnya.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 card-pro p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#59171b]" />
                  <h3 className="font-extrabold text-[#241113] text-sm">
                    Top Pelajar Bulan Ini
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#5c3d40]">
                  Total Jam & Streak
                </span>
              </div>

              <div className="divide-y divide-[#f2e5dc]">
                {COMMUNITY_LEADERBOARD.map((member, idx) => (
                  <div
                    key={member.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-[#59171b] to-[#83262c] text-[#fed7b8]'
                            : idx <= 2
                              ? 'bg-[#fff3e8] text-[#59171b] border border-[#e7c3ad]'
                              : 'bg-[#f6ece4] text-[#5c3d40]'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#241113] truncate">
                          {member.name}
                        </div>
                        <div className="text-[11px] font-medium text-[#5c3d40] truncate">
                          {member.rankTitle} • {member.favoriteMedia}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-[#241113]">
                        {member.totalHours.toLocaleString('id-ID')} j
                      </div>
                      <div className="text-[11px] font-mono text-[#59171b] inline-flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {member.streak}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="card-pro p-5 space-y-3.5 flex-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#59171b]" />
                  <h3 className="font-extrabold text-[#241113] text-sm">
                    Aktivitas Immersion Terbaru
                  </h3>
                </div>

                <div className="space-y-3">
                  {COMMUNITY_ACTIVITY_FEED.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#fffaf6] border border-[#ead6c9] flex items-center gap-3"
                    >
                      <MediaCover
                        title={item.title}
                        category={item.category}
                        className="w-9 h-12 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#241113] leading-snug">
                          <strong>{item.userName}</strong> {item.action}{' '}
                          <span className="font-bold text-[#59171b]">
                            {item.title}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#5c3d40] mt-0.5">
                          +{item.minutes} mnt • {item.timeAgo}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-pro p-5 bg-gradient-to-br from-[#fed7b8]/55 via-white to-[#fff5ed] border-[#e7c3ad] space-y-3">
                <h3 className="font-extrabold text-[#241113] text-sm">
                  Siap mencatatkan perjalanan bahasamu sendiri?
                </h3>
                <p className="text-xs font-medium text-[#5c3d40] leading-relaxed">
                  Buat akun gratis dengan Google atau email untuk menyimpan
                  riwayat belajar, jam immersion, dan target harian di cloud.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/login?mode=signup"
                    className="btn-crimson px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    Gabung & Buat Akun Gratis
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to="/login"
                    className="px-4 py-2.5 rounded-xl bg-white border border-[#e7d1c3] hover:border-[#59171b] text-xs font-bold text-[#241113]"
                  >
                    Masuk
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ead6c9] bg-white/90 py-8 px-4 sm:px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-[#5c3d40]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#59171b] to-[#83262c] flex items-center justify-center font-extrabold text-[#fed7b8] text-[11px]">
              I
            </div>
            <span className="font-extrabold text-[#241113]">ImmersionTrack</span>
            <span>• nihongotracker.my.id</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#kalkulator" className="hover:text-[#59171b] transition">
              Kalkulator JLPT
            </a>
            <a href="#katalog" className="hover:text-[#59171b] transition">
              Katalog 660 Media
            </a>
            <Link to="/login" className="hover:text-[#59171b] transition">
              Masuk / Daftar
            </Link>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="hover:text-[#59171b] transition cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 bg-[#241113]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-[#fffdfb] border border-[#e7d1c3] p-6 shadow-2xl space-y-5 my-auto animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#241113]">
                  {isSignUp ? 'Buat Akun ImmersionTrack' : 'Masuk ke Akun'}
                </h2>
                <p className="text-xs font-medium text-[#5c3d40] mt-0.5">
                  Sinkronkan progresmu lintas perangkat lewat Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-xs font-bold text-[#5c3d40] hover:text-[#241113] px-2.5 py-1 rounded-lg hover:bg-[#f9ebe0] cursor-pointer"
              >
                Tutup
              </button>
            </div>

            {!sbReady && !isSupabaseConfigured && (
              <div className="p-3 rounded-xl bg-[#fff3e8] border border-[#f2c9ab] text-xs font-medium text-[#59171b] space-y-2">
                <div>
                  Kredensial Supabase belum terhubung. Anda bisa{' '}
                  <button
                    type="button"
                    onClick={() => setShowSupabaseSetup(!showSupabaseSetup)}
                    className="underline font-bold text-[#59171b] cursor-pointer"
                  >
                    atur URL & Anon Key Supabase sekarang
                  </button>{' '}
                  atau langsung pakai{' '}
                  <button
                    type="button"
                    onClick={handleOpenDashboard}
                    className="underline font-bold text-[#241113] cursor-pointer"
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
                className="p-3.5 rounded-xl bg-[#fffaf6] border border-[#e7d1c3] space-y-2.5"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#241113]">
                  <Database className="w-3.5 h-3.5 text-[#59171b]" />
                  Hubungkan Proyek Supabase
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://xxxx.supabase.co"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#e7d1c3] text-xs font-mono text-[#241113] focus:outline-none focus:border-[#59171b]"
                />
                <input
                  type="text"
                  required
                  placeholder="Anon Public Key"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#e7d1c3] text-xs font-mono text-[#241113] focus:outline-none focus:border-[#59171b]"
                />
                <button
                  type="submit"
                  disabled={testingSb}
                  className="btn-crimson w-full py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {testingSb ? 'Menguji Koneksi...' : 'Test & Simpan Koneksi'}
                </button>
              </form>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#7c5659] absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#fffaf6] border border-[#e7d1c3] text-sm font-medium text-[#241113] focus:outline-none focus:border-[#59171b] focus:bg-white"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7c5659] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Password (min. 6 karakter)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#fffaf6] border border-[#e7d1c3] text-sm font-medium text-[#241113] focus:outline-none focus:border-[#59171b] focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="btn-crimson w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                {isSignUp ? 'Daftar Akun' : 'Masuk dengan Email'}
              </button>
              <div className="flex items-center justify-between text-xs font-medium text-[#5c3d40] pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[#59171b] font-bold hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                </button>
                <Link
                  to="/login?mode=forgot"
                  className="text-[#5c3d40] hover:text-[#59171b] hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
            </form>

            <div className="flex items-center gap-3 text-xs font-semibold text-[#8c6b6e]">
              <div className="h-px flex-1 bg-[#ead6c9]" />
              <span>opsi lain</span>
              <div className="h-px flex-1 bg-[#ead6c9]" />
            </div>

            <GoogleSignInButton
              onSuccess={() => {
                setShowAuthModal(false);
                navigate('/dashboard');
              }}
              onRequireSupabaseSetup={() => setShowSupabaseSetup(true)}
              disabled={authLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

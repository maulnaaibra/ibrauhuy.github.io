import React, { useMemo, useRef, useState } from 'react';
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
  Play,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSupabaseConfig,
  isGoogleProviderEnabled,
  isSupabaseConfigured,
  saveRuntimeSupabaseConfig,
  supabase,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  COMMUNITY_ACTIVITY_FEED,
  COMMUNITY_LEADERBOARD,
  CURATED_MEDIA_CATALOG,
  JLPT_MILESTONES,
  type CatalogLevelFilter,
} from '../lib/publicShowcase';
import { getCategoryMeta, type ImmersionCategory } from '../types';
import { MediaCover } from '../components/MediaCover';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, isDemoMode, enterDemoMode, updateDemoProfile } = useAuth();
  const navigate = useNavigate();
  const emailInputRef = useRef<HTMLInputElement | null>(null);

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

  const [catalogFilter, setCatalogFilter] =
    useState<CatalogLevelFilter>('all');

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

    const projectedXp = target.hours * 145;
    const projectedLevel = Math.floor(Math.sqrt(projectedXp / 100)) + 1;
    const animeEpisodes = Math.round((target.hours * 0.45 * 60) / 24);
    const mangaVolumes = Math.round(target.hours * 0.35 * 1.4);
    const estimatedCards = Math.round(target.hours * 4.5);

    return {
      target,
      daysNeeded,
      monthsNeeded,
      etaLabel,
      projectedXp,
      projectedLevel,
      animeEpisodes,
      mangaVolumes,
      estimatedCards,
    };
  }, [calcMinutes, selectedMilestoneCode]);

  const filteredCatalog = useMemo(() => {
    if (catalogFilter === 'all') return CURATED_MEDIA_CATALOG;
    return CURATED_MEDIA_CATALOG.filter((item) => item.level === catalogFilter);
  }, [catalogFilter]);

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

  const handleGoogleLogin = async () => {
    if (!sbReady && !isSupabaseConfigured) {
      setShowSupabaseSetup(true);
      toast.error('Hubungkan kredensial Supabase terlebih dahulu di bawah.');
      return;
    }
    setAuthLoading(true);
    const enabled = await isGoogleProviderEnabled();
    if (!enabled) {
      toast.error(
        'Login Google belum diaktifkan di server Supabase. Silakan daftar/masuk instan menggunakan Email & Password di atas!'
      );
      setAuthLoading(false);
      emailInputRef.current?.focus();
      return;
    }

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
    <div className="min-h-screen bg-gradient-to-b from-red-50/80 via-white to-slate-50 text-slate-900 flex flex-col relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[340px] bg-gradient-to-b from-red-200/40 via-rose-100/25 to-transparent blur-3xl rounded-full"
      />

      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-bold text-white shadow-sm shadow-red-600/25">
              I
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              ImmersionTrack
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#preview" className="hover:text-red-700 transition-colors">
              Ringkasan
            </a>
            <a
              href="#kalkulator"
              className="hover:text-red-700 transition-colors"
            >
              Kalkulator JLPT
            </a>
            <a href="#katalog" className="hover:text-red-700 transition-colors">
              Katalog Media
            </a>
            <a href="#fitur" className="hover:text-red-700 transition-colors">
              Fitur
            </a>
            <a
              href="#komunitas"
              className="hover:text-red-700 transition-colors"
            >
              Komunitas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {isCloudLoggedIn ? (
              <button
                type="button"
                onClick={handleOpenDashboard}
                className="btn-crimson px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
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
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-red-700 hover:bg-red-50/70 transition cursor-pointer"
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-14 pb-20 space-y-24 relative z-10">
        {/* Hero */}
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
              {isCloudLoggedIn
                ? 'Lanjutkan Progres Saya'
                : 'Mulai Tracking Sekarang'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {isCloudLoggedIn ? (
              <Link
                to="/settings"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition shadow-xs text-center"
              >
                Pengaturan Akun Cloud
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setShowAuthModal(true);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition cursor-pointer shadow-xs"
              >
                Daftar & Sinkron Cloud
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-slate-600 animate-fade-up delay-2">
            {[
              '9 Kategori Media',
              'Analitik & XP Otomatis',
              'Desktop Tracker + AnkiConnect',
              'Sinkronisasi Cloud Supabase',
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

        {/* Dashboard Preview */}
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

        {/* Kalkulator Target & Estimasi JLPT Interaktif */}
        <section id="kalkulator" className="space-y-6 animate-fade-up delay-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <Calculator className="w-3.5 h-3.5" />
                SIMULASI RENCANA BELAJAR
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Kalkulator Target & Estimasi JLPT
              </h2>
              <p className="text-sm text-slate-600">
                Atur durasi immersion harian untuk menghitung perkiraan waktu
                mencapai level JLPT tujuanmu.
              </p>
            </div>
          </div>

          <div className="card-pro p-6 sm:p-7 grid lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                            ? 'bg-red-50/90 border-red-300 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-bold ${
                              active ? 'text-red-700' : 'text-slate-900'
                            }`}
                          >
                            JLPT {item.code}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {item.hours.toLocaleString()}j
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
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
                    className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    2. Komitmen Immersion Harian
                  </label>
                  <span className="text-sm font-mono font-bold text-red-600">
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
                  className="w-full accent-red-600 cursor-pointer"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[45, 90, 120, 180].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCalcMinutes(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer ${
                        calcMinutes === preset
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-red-50/70 via-white to-slate-50 border border-red-100 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Estimasi Tercapai
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-0.5">
                    {calculatorResult.etaLabel}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Sekitar{' '}
                    <strong className="font-mono text-red-700">
                      {calculatorResult.daysNeeded.toLocaleString()} hari
                    </strong>{' '}
                    ({calculatorResult.monthsNeeded} bulan) dengan{' '}
                    {calcMinutes} mnt/hari.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-right shrink-0">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Proyeksi RPG
                  </div>
                  <div className="text-sm font-mono font-bold text-red-600">
                    Lv.{calculatorResult.projectedLevel}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[11px] text-slate-500">Anime</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    ~{calculatorResult.animeEpisodes}
                  </div>
                  <div className="text-[10px] text-slate-400">episode</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[11px] text-slate-500">Manga</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    ~{calculatorResult.mangaVolumes}
                  </div>
                  <div className="text-[10px] text-slate-400">volume</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                  <div className="text-[11px] text-slate-500">Anki Mining</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                    ~{calculatorResult.estimatedCards.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">kartu kosa kata</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCalculatorGoal}
                className="btn-crimson w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                Terapkan Target {calcMinutes} mnt/hari ke Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Katalog & Rekomendasi Media Immersion Populer */}
        <section id="katalog" className="space-y-6 animate-fade-up delay-3">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <Compass className="w-3.5 h-3.5" />
                REKOMENDASI KURASI BAHAN BELAJAR
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Katalog Media Immersion Populer
              </h2>
              <p className="text-sm text-slate-600">
                Bingung mulai dari mana? Pilih judul sesuai level kemampuanmu
                dan langsung catat sesinya.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'Pemula N5–N4', label: 'Pemula N5–N4' },
                  { id: 'Menengah N3', label: 'Menengah N3' },
                  { id: 'Mahir N2–N1', label: 'Mahir N2–N1' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    catalogFilter === tab.id
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCatalog.map((item) => {
              const meta = getCategoryMeta(item.category);
              return (
                <div
                  key={item.title}
                  className="card-pro-interactive p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MediaCover
                        title={item.title}
                        category={item.category}
                        className="w-16 h-22 rounded-xl"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-red-50 border border-red-200/80 text-[10px] font-semibold text-red-700">
                          {item.level}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                          {item.title}
                        </h3>
                        <div className="text-[11px] font-mono text-slate-500">
                          {meta.shortLabel} • {meta.xpPerHour} XP/jam
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleStartMediaFromCatalog(
                        item.title,
                        item.category,
                        item.suggestedMinutes
                      )
                    }
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-red-600 border border-slate-200 hover:border-red-600 text-slate-800 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mulai Immersion ({item.suggestedMinutes}m)
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fitur */}
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

        {/* Peringkat & Aktivitas Komunitas */}
        <section id="komunitas" className="space-y-6 animate-fade-up delay-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <Users className="w-3.5 h-3.5" />
              BELAJAR BERSAMA KOMUNITAS
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Peringkat & Aktivitas Pelajar
            </h2>
            <p className="text-sm text-slate-600">
              Pantau progres konsistensi mingguan dan bergabunglah dengan pelajar
              immersion lainnya.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 card-pro p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Top Pelajar Bulan Ini
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Jam & Streak
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {COMMUNITY_LEADERBOARD.map((member, idx) => (
                  <div
                    key={member.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-red-600 to-rose-600 text-white'
                            : idx <= 2
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {member.rankTitle} • {member.favoriteMedia}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-bold text-slate-900">
                        {member.totalHours.toLocaleString('id-ID')} j
                      </div>
                      <div className="text-[11px] font-mono text-red-600 inline-flex items-center gap-1">
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
                  <BookOpen className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Aktivitas Immersion Terbaru
                  </h3>
                </div>

                <div className="space-y-3">
                  {COMMUNITY_ACTIVITY_FEED.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3"
                    >
                      <MediaCover
                        title={item.title}
                        category={item.category}
                        className="w-9 h-12 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-800 leading-snug">
                          <strong>{item.userName}</strong> {item.action}{' '}
                          <span className="font-semibold text-red-700">
                            {item.title}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          +{item.minutes} mnt • {item.timeAgo}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-pro p-5 bg-gradient-to-br from-red-50/90 via-white to-rose-50/70 border-red-200/80 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">
                  Siap mencatatkan perjalanan bahasamu sendiri?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Buat akun gratis dengan email untuk menyimpan seluruh riwayat,
                  statistik XP, dan target harian secara otomatis di cloud.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/login?mode=signup"
                    className="btn-crimson px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    Gabung & Buat Akun Gratis
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to="/login"
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 text-xs font-semibold text-slate-700"
                  >
                    Masuk
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-8 px-4 sm:px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center font-bold text-white text-[11px]">
              I
            </div>
            <span className="font-semibold text-slate-800">ImmersionTrack</span>
            <span>• nihongotracker.my.id</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#kalkulator" className="hover:text-red-700 transition">
              Kalkulator JLPT
            </a>
            <a href="#katalog" className="hover:text-red-700 transition">
              Katalog Media
            </a>
            <Link to="/login" className="hover:text-red-700 transition">
              Masuk / Daftar
            </Link>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="hover:text-red-700 transition cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>
      </footer>

      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
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

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  ref={emailInputRef}
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
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-red-600 font-semibold hover:underline cursor-pointer"
                >
                  {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
                </button>
                <Link
                  to="/login?mode=forgot"
                  className="text-slate-500 hover:text-red-600 hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
            </form>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>opsi lain</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition disabled:opacity-60 cursor-pointer shadow-2xs"
            >
              Lanjutkan dengan Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

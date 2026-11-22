import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  Image,
  Palette,
  Save,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BACKGROUND_PRESETS,
  compressImageToDataUrl,
  DEFAULT_APPEARANCE,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
  type BackgroundPresetId,
  type CustomOverlayStrength,
} from '../lib/appearance';
import {
  clearRuntimeSupabaseConfig,
  getSupabaseConfig,
  saveRuntimeSupabaseConfig,
  SUPABASE_SCHEMA_SQL,
  supabase,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  exportWorkspaceJson,
  loadDemoLogs,
  loadUserGoals,
  parseWorkspaceBackup,
  saveUserGoals,
} from '../lib/demoData';
import { useAuth } from '../context/AuthContext';
import type { ImmersionLog, Profile } from '../types';
import { getLocalDateString } from '../utils/stats';

const LANGUAGE_PRESETS = [
  'Japanese',
  'Korean',
  'English',
  'Mandarin',
  'Spanish',
];
const GOAL_PRESETS = [30, 60, 90, 120, 180];

interface SettingsFormProps {
  initialProfile: Profile | null;
  userId: string;
  onRefreshProfile: () => Promise<void>;
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  initialProfile,
  userId,
  onRefreshProfile,
}) => {
  const [fullName, setFullName] = useState(
    () => initialProfile?.full_name ?? ''
  );
  const [targetLanguage, setTargetLanguage] = useState(
    () => initialProfile?.target_language ?? 'Japanese'
  );
  const [dailyGoal, setDailyGoal] = useState(
    () => initialProfile?.daily_goal_minutes ?? 90
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      full_name: fullName.trim() || null,
      target_language: targetLanguage.trim() || 'Japanese',
      daily_goal_minutes: Math.max(5, Number(dailyGoal)),
    };

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      ...payload,
    });

    if (error) {
      toast.error('Gagal menyimpan pengaturan');
    } else {
      await onRefreshProfile();
      toast.success('Pengaturan profil diperbarui!');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Nama Tampilan
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama kamu"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Bahasa Target
          </label>
          <div className="flex flex-wrap gap-1">
            {LANGUAGE_PRESETS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setTargetLanguage(lang)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  targetLanguage === lang
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          required
          placeholder="Contoh: Japanese, Korean, Spanish"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Target Harian (menit)
          </label>
          <div className="flex flex-wrap gap-1">
            {GOAL_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDailyGoal(mins)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono transition cursor-pointer ${
                  dailyGoal === mins
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          required
          min={5}
          max={1440}
          value={dailyGoal}
          onChange={(e) => setDailyGoal(Number(e.target.value))}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white transition"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="btn-crimson w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>
    </form>
  );
};

export const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bgUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  const [appearance, setAppearance] = useState<AppearanceSettings>(
    loadAppearanceSettings
  );
  const [customBgUrlInput, setCustomBgUrlInput] = useState(
    () =>
      loadAppearanceSettings().customImageUrl.startsWith('data:')
        ? ''
        : loadAppearanceSettings().customImageUrl
  );

  const updateAppearance = (patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      saveAppearanceSettings(next);
      return next;
    });
  };

  const handleSelectPreset = (preset: BackgroundPresetId) => {
    const isDarkPreset = preset === 'midnight-slate';
    updateAppearance({
      preset,
      darkMode: isDarkPreset ? true : appearance.darkMode,
    });
    toast.success('Background & tema website diperbarui!');
  };

  const handleUploadCustomWallpaper = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      updateAppearance({
        preset: 'custom',
        customImageUrl: dataUrl,
      });
      setCustomBgUrlInput('');
      toast.success('Wallpaper kustom diterapkan ke seluruh website!');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memasang gambar background'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyCustomBgUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customBgUrlInput.trim();
    if (!clean.startsWith('https://') && !clean.startsWith('http://')) {
      toast.error('Masukkan URL gambar yang valid (https://...).');
      return;
    }
    updateAppearance({
      preset: 'custom',
      customImageUrl: clean,
    });
    toast.success('URL background diterapkan!');
  };

  const initialSb = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(initialSb.url);
  const [sbKey, setSbKey] = useState(initialSb.anonKey);
  const [sbSource, setSbSource] = useState(initialSb.source);
  const [testingSb, setTestingSb] = useState(false);
  const [sbStatusMsg, setSbStatusMsg] = useState<string | null>(null);
  const [sbTablesReady, setSbTablesReady] = useState<boolean | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [migratingLogs, setMigratingLogs] = useState(false);

  const handleMigrateLocalToCloud = async () => {
    if (!user) return;
    const localLogs = loadDemoLogs();
    if (localLogs.length === 0) {
      toast('Tidak ada data lokal untuk disinkronkan.');
      return;
    }
    setMigratingLogs(true);
    try {
      const rows = localLogs.map((l) => ({
        user_id: user.id,
        title: l.title,
        category: l.category,
        duration_minutes: l.duration_minutes,
        cards_mined: l.cards_mined,
        notes: l.notes,
        logged_date: l.logged_date,
      }));
      const { error } = await supabase.from('immersion_logs').insert(rows);
      if (error) throw error;
      toast.success(
        `${rows.length} catatan lokal berhasil diunggah ke akun cloud!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal menyinkronkan data ke Supabase'
      );
    } finally {
      setMigratingLogs(false);
    }
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingSb(true);
    const check = await testSupabaseConnection(sbUrl, sbKey);
    setSbStatusMsg(check.message);
    setSbTablesReady(check.tablesReady);

    if (!check.ok) {
      toast.error(check.message);
      setTestingSb(false);
      return;
    }

    saveRuntimeSupabaseConfig(sbUrl, sbKey);
    setSbSource(getSupabaseConfig().source);
    toast.success(
      check.tablesReady
        ? 'Supabase terhubung & tabel siap!'
        : 'Koneksi valid! Silakan jalankan Skrip SQL di Supabase.'
    );
    setTestingSb(false);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      toast.success('Skrip SQL disalin! Tempel di SQL Editor Supabase.');
    } catch {
      setShowSql(true);
      toast('Silakan salin SQL dari kotak di bawah.');
    }
  };

  const handleDisconnectSupabase = () => {
    clearRuntimeSupabaseConfig();
    const next = getSupabaseConfig();
    setSbUrl(next.url);
    setSbKey(next.anonKey);
    setSbSource(next.source);
    setSbStatusMsg(null);
    setSbTablesReady(null);
    toast.success('Koneksi lokal Supabase dihapus.');
  };

  const handleExport = async () => {
    if (!user) return;
    setBackingUp(true);
    try {
      const { data, error } = await supabase
        .from('immersion_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: false });
      if (error) throw error;

      const logs = (data as ImmersionLog[]) ?? [];
      const goals = loadUserGoals(user.id);
      const json = exportWorkspaceJson(logs, profile, goals);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `immersiontrack-backup-${getLocalDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup JSON berhasil diunduh (${logs.length} sesi)`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal mengekspor data backup'
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBackingUp(true);
    try {
      const text = await file.text();
      const backup = parseWorkspaceBackup(text);
      if (backup.logs.length > 0) {
        const rows = backup.logs.map((l) => ({
          user_id: user.id,
          title: l.title,
          category: l.category,
          duration_minutes: l.duration_minutes,
          cards_mined: l.cards_mined,
          notes: l.notes,
          logged_date: l.logged_date,
        }));
        const { error } = await supabase.from('immersion_logs').insert(rows);
        if (error) throw error;
      }
      if (backup.goals.length > 0) {
        saveUserGoals(user.id, backup.goals);
      }
      if (backup.profile) {
        await supabase.from('profiles').upsert({
          full_name: backup.profile.full_name ?? null,
          target_language: backup.profile.target_language ?? 'Japanese',
          daily_goal_minutes: backup.profile.daily_goal_minutes ?? 90,
          id: user.id,
        });
        await refreshProfile();
      }
      toast.success(
        `Backup dipulihkan ke cloud (${backup.logs.length} sesi immersion)!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal membaca file backup'
      );
    } finally {
      setBackingUp(false);
      e.target.value = '';
    }
  };

  return (
    <div className="app-bg-canvas text-slate-900 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-rose-600 app-canvas-subtitle transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>

        <div className="card-pro p-6 space-y-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Pengaturan Immersion
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Sesuaikan nama tampilan, bahasa target, dan target durasi harian.
            </p>
          </div>

          {user && (
            <SettingsForm
              key={`${profile?.id ?? 'none'}-${profile?.daily_goal_minutes ?? 'init'}-${profile?.target_language ?? ''}`}
              initialProfile={profile}
              userId={user.id}
              onRefreshProfile={refreshProfile}
            />
          )}
        </div>

        <div className="card-pro p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Tampilan & Background Website
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih tema warna cerah/elegan atau unggah wallpaper sendiri.
                  Tersimpan otomatis di browser Anda.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomBgUrlInput('');
                setAppearance(DEFAULT_APPEARANCE);
                saveAppearanceSettings(DEFAULT_APPEARANCE);
                toast.success('Background dikembalikan ke default.');
              }}
              className="text-xs font-bold text-rose-600 hover:underline shrink-0 cursor-pointer"
            >
              Reset Default
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {BACKGROUND_PRESETS.map((preset) => {
              const active = appearance.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer space-y-2 ${
                    active
                      ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className="h-12 rounded-lg border border-black/10 shadow-inner"
                    style={{ background: preset.swatchStyle }}
                  />
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between gap-1">
                      <span>{preset.name}</span>
                      {active && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Image className="w-4 h-4 text-rose-600" />
                Gunakan Gambar / Wallpaper Kustom
              </div>
              <button
                type="button"
                onClick={() => bgUploadInputRef.current?.click()}
                className="btn-crimson px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Unggah Gambar dari Perangkat
              </button>
              <input
                ref={bgUploadInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadCustomWallpaper}
                className="hidden"
              />
            </div>

            <form
              onSubmit={handleApplyCustomBgUrl}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="url"
                placeholder="Atau tempel URL gambar (https://...)"
                value={customBgUrlInput}
                onChange={(e) => setCustomBgUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-rose-600 cursor-pointer"
              >
                Pakai URL
              </button>
            </form>

            {appearance.preset === 'custom' && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  Kepekatan Lapisan Gelap:
                </span>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'light', label: 'Tipis' },
                      { id: 'medium', label: 'Sedang' },
                      { id: 'strong', label: 'Pekat' },
                    ] as Array<{ id: CustomOverlayStrength; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updateAppearance({ customOverlayStrength: opt.id })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                        appearance.customOverlayStrength === opt.id
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card-pro p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Koneksi Cloud Supabase (Database & Auth)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hubungkan proyek Supabase Anda untuk sinkronisasi akun & data
                  di semua perangkat.
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                sbSource !== 'none'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {sbSource === 'env'
                ? 'Terhubung (Env)'
                : sbSource === 'local'
                  ? 'Terhubung'
                  : 'Lokal'}
            </span>
          </div>

          <form onSubmit={handleTestAndSaveSupabase} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Project URL
              </label>
              <input
                type="url"
                required
                placeholder="https://your-project-id.supabase.co"
                value={sbUrl}
                onChange={(e) => setSbUrl(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Anon Public Key
              </label>
              <input
                type="text"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={sbKey}
                onChange={(e) => setSbKey(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={testingSb}
                className="btn-crimson px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {testingSb
                  ? 'Menguji Koneksi...'
                  : 'Test & Simpan Koneksi Supabase'}
              </button>

              <button
                type="button"
                onClick={handleCopySql}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-rose-600" />
                Salin Skrip SQL Tabel & RLS
              </button>

              {sbSource === 'local' && (
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:text-red-600 text-xs font-medium text-slate-500 cursor-pointer"
                >
                  Putuskan
                </button>
              )}

              {user && loadDemoLogs().length > 0 && (
                <button
                  type="button"
                  disabled={migratingLogs}
                  onClick={handleMigrateLocalToCloud}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {migratingLogs
                    ? 'Mengunggah...'
                    : 'Sinkronkan Data Lokal ke Cloud'}
                </button>
              )}
            </div>
          </form>

          {sbStatusMsg && (
            <div
              className={`p-3 rounded-xl text-xs border flex items-start justify-between gap-2 ${
                sbTablesReady
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <span className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{sbStatusMsg}</span>
              </span>
            </div>
          )}

          <div className="pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
            >
              Lihat Skrip SQL Supabase
              {showSql ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showSql && (
              <pre className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            )}
          </div>
        </div>

        <div className="card-pro p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Manajemen Data & Backup Cloud
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ekspor cadangan riwayat belajar ke file JSON atau impor data
              cadangan langsung ke akun Supabase Anda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={backingUp}
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4 text-rose-600" />
              Ekspor Backup JSON
            </button>

            <button
              type="button"
              disabled={backingUp}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              Impor Backup JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

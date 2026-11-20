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
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  clearRuntimeSupabaseConfig,
  getSupabaseConfig,
  saveRuntimeSupabaseConfig,
  SUPABASE_SCHEMA_SQL,
  supabase,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  clearDemoLogs,
  exportWorkspaceJson,
  loadDemoLogs,
  loadUserGoals,
  parseWorkspaceBackup,
  resetDemoLogs,
  saveDemoLogs,
  saveUserGoals,
} from '../lib/demoData';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types';
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
  isDemoMode: boolean;
  onUpdateDemoProfile: (patch: Partial<Profile>) => void;
  onRefreshProfile: () => Promise<void>;
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  initialProfile,
  userId,
  isDemoMode,
  onUpdateDemoProfile,
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

    if (isDemoMode) {
      onUpdateDemoProfile(payload);
      toast.success('Pengaturan profil diperbarui!');
      setSaving(false);
      return;
    }

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
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Nama Tampilan
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama kamu"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-600">
            Bahasa Target
          </label>
          <div className="flex flex-wrap gap-1">
            {LANGUAGE_PRESETS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setTargetLanguage(lang)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  targetLanguage === lang
                    ? 'bg-red-600 text-white'
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
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-600">
            Target Harian (menit)
          </label>
          <div className="flex flex-wrap gap-1">
            {GOAL_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setDailyGoal(mins)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium font-mono transition cursor-pointer ${
                  dailyGoal === mins
                    ? 'bg-red-600 text-white'
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
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
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
  const { user, profile, isDemoMode, updateDemoProfile, refreshProfile, signOut } =
    useAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!user || isDemoMode) return;
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

  const handleExport = () => {
    if (!user) return;
    const logs = loadDemoLogs();
    const goals = loadUserGoals(user.id);
    const json = exportWorkspaceJson(logs, profile, goals);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `immersiontrack-backup-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup JSON berhasil diunduh');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const text = await file.text();
      const backup = parseWorkspaceBackup(text);
      saveDemoLogs(backup.logs);
      if (backup.goals.length > 0) {
        saveUserGoals(user.id, backup.goals);
      }
      if (backup.profile) {
        updateDemoProfile(backup.profile);
      }
      toast.success(
        `Backup dipulihkan (${backup.logs.length} sesi immersion)!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal membaca file backup'
      );
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50/50 via-slate-50 to-slate-50 text-slate-900 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-6 animate-fade-up">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>

        <div className="card-pro p-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
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
              isDemoMode={isDemoMode}
              onUpdateDemoProfile={updateDemoProfile}
              onRefreshProfile={refreshProfile}
            />
          )}
        </div>

        <div className="card-pro p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600">
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
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-red-600" />
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

              {!isDemoMode && user && (
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
              {sbTablesReady && isDemoMode && (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="underline font-semibold shrink-0 cursor-pointer"
                >
                  Login Sekarang
                </button>
              )}
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

        {isDemoMode && (
          <div className="card-pro p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Data & Backup
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ekspor cadangan riwayat belajar ke JSON, pulihkan dari file,
                atau atur ulang catatan lokal Anda.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-red-600" />
                Ekspor Backup JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
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

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDemoLogs();
                  toast.success('Data contoh awal dimuat ulang');
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:text-slate-900 text-xs font-medium text-slate-600 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Muat Data Contoh
              </button>

              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearDemoLogs();
                      setConfirmClear(false);
                      toast.success('Semua riwayat belajar dikosongkan');
                    }}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    Ya, Kosongkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-red-300 hover:text-red-600 text-xs font-medium text-slate-500 inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Kosongkan Semua Data
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

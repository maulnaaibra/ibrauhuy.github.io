import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Palette,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AppearanceControlsContent } from '../components/WallpaperCustomizerPopover';
import { supabase } from '../lib/supabase';
import {
  exportWorkspaceJson,
  loadDemoLogs,
  loadUserGoals,
  parseWorkspaceBackup,
  saveUserGoals,
} from '../lib/demoData';
import {
  loadExtendedProfileMeta,
  saveExtendedProfileMeta,
} from '../lib/profileMeta';
import { useAuth } from '../context/AuthContext';
import type { ImmersionLog, Profile } from '../types';
import { getLocalDateString, type JlptLevelSetting } from '../utils/stats';

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
  userEmail?: string | null;
  userMetadata?: Record<string, unknown> | null;
  onRefreshProfile: () => Promise<void>;
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  initialProfile,
  userId,
  userEmail,
  userMetadata,
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
  const [jlptLevel, setJlptLevel] = useState<JlptLevelSetting>(() => {
    const loaded = loadExtendedProfileMeta(
      userId,
      initialProfile,
      userEmail,
      userMetadata
    ).jlpt_level;
    return loaded === 'auto' ? 'N5' : loaded;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const ext = loadExtendedProfileMeta(
      userId,
      initialProfile,
      userEmail,
      userMetadata
    );
    const cleanName = fullName.trim() || ext.full_name;
    const cleanLang = targetLanguage.trim() || 'Japanese';
    const cleanGoal = Math.max(5, Number(dailyGoal));

    const res = await saveExtendedProfileMeta(userId, {
      ...ext,
      full_name: cleanName,
      target_language: cleanLang,
      daily_goal_minutes: cleanGoal,
      jlpt_level: jlptLevel,
    });

    if (!res.ok) {
      toast.error(res.error || 'Gagal menyimpan pengaturan');
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Level JLPT Saat Ini
          </label>
          <span className="text-[11px] text-slate-500">
            Tentukan level bahasa Jepang Anda saat ini
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {(['N5', 'N4', 'N3', 'N2', 'N1', 'Native'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setJlptLevel(lvl)}
              className={`py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                jlptLevel === lvl
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
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
  const [backingUp, setBackingUp] = useState(false);
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
          : 'Gagal menyinkronkan data ke cloud'
      );
    } finally {
      setMigratingLogs(false);
    }
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
              userEmail={user.email}
              userMetadata={user.user_metadata}
              onRefreshProfile={refreshProfile}
            />
          )}
        </div>

        <div className="card-pro p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Tampilan, Wallpaper &amp; Blur Tema
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur wallpaper, blur &amp; opacity wallpaper, serta blur kaca
                tema secara langsung. Tersimpan otomatis di browser Anda.
              </p>
            </div>
          </div>

          <AppearanceControlsContent />
        </div>

        <div className="card-pro p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Manajemen Data & Backup Cloud
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ekspor cadangan riwayat belajar ke file JSON atau impor data
                cadangan langsung ke akun cloud Anda.
              </p>
            </div>
            {user && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 inline-flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                Terlindung RLS
              </span>
            )}
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

          {user && loadDemoLogs().length > 0 && (
            <button
              type="button"
              disabled={migratingLogs}
              onClick={handleMigrateLocalToCloud}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {migratingLogs
                ? 'Mengunggah...'
                : 'Sinkronkan Data Lokal ke Cloud'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

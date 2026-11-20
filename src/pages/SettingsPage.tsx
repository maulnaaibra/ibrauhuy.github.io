import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types';

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
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Nama Tampilan
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nama kamu"
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">
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
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
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
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-400">
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
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
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
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer shadow-lg shadow-indigo-600/20"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>
    </form>
  );
};

export const SettingsPage: React.FC = () => {
  const { user, profile, isDemoMode, updateDemoProfile, refreshProfile } =
    useAuth();

  return (
    <div className="min-h-screen bg-[#0e1218] text-slate-100 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard
        </Link>

        <div className="p-6 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-5">
          <div>
            <h1 className="text-xl font-bold">Pengaturan Immersion</h1>
            <p className="text-sm text-slate-400 mt-1">
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
      </div>
    </div>
  );
};

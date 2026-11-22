import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Flame,
  Globe,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Palette,
  Save,
  Share2,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import rawCatalog from '../data/immersionCatalog.json';
import {
  compressImageToDataUrl,
  DEFAULT_APPEARANCE,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type AppearanceSettings,
} from '../lib/appearance';
import { getCatalogMediaDestinations } from '../lib/mediaLinks';
import {
  AVATAR_PRESETS,
  BANNER_IMAGE_PRESETS,
  compressAvatarFile,
  compressBannerFile,
  getPublicProfileShareUrl,
  PROFILE_BANNER_THEMES,
  type ExtendedUserProfile,
  type ProfileBannerThemeId,
  type PublicProfileSnapshot,
} from '../lib/profileMeta';
import { COMMUNITY_LEADERBOARD } from '../lib/publicShowcase';
import {
  getCategoryMeta,
  PRIMARY_CATEGORIES,
  type ImmersionLog,
  type PrimaryMediaCategory,
} from '../types';
import { ActivityHeatmap } from './ActivityHeatmap';
import { MediaCover } from './MediaCover';

interface CatalogQuickItem {
  id: string;
  title: string;
  category: PrimaryMediaCategory;
  section: string;
}

const CATALOG_QUICK_LIST = (rawCatalog as CatalogQuickItem[]).slice(0, 745);

interface ProfileDashboardSectionProps {
  snapshot: PublicProfileSnapshot;
  logs?: ImmersionLog[];
  isOwnProfile: boolean;
  onSaveProfile?: (
    updated: ExtendedUserProfile
  ) => Promise<{ ok: boolean; error?: string }>;
  onInspectMember?: (memberId: string) => void;
}

export const ProfileDashboardSection: React.FC<
  ProfileDashboardSectionProps
> = ({
  snapshot,
  logs,
  isOwnProfile,
  onSaveProfile,
  onInspectMember,
}) => {
  const { profile, stats, topMedia, recentLogs, unlockedBadges } = snapshot;

  const [isEditing, setIsEditing] = useState(false);
  const [showQuickBgGallery, setShowQuickBgGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExtendedUserProfile>(() => profile);

  useEffect(() => {
    setForm(profile);
  }, [profile]);
  const [bannerUrlInput, setBannerUrlInput] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    loadAppearanceSettings
  );

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);

  const bannerTheme =
    PROFILE_BANNER_THEMES.find(
      (t) => t.id === (isEditing ? form.banner_theme : profile.banner_theme)
    ) ?? PROFILE_BANNER_THEMES[0];

  const shareUrl = useMemo(
    () => getPublicProfileShareUrl(snapshot),
    [snapshot]
  );

  const matchingCatalogSuggestions = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return CATALOG_QUICK_LIST.slice(0, 6);
    return CATALOG_QUICK_LIST.filter((item) =>
      item.title.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [catalogSearch]);

  const handleOpenEditor = () => {
    setForm(profile);
    setBannerUrlInput(
      profile.banner_url && !profile.banner_url.startsWith('data:')
        ? profile.banner_url
        : ''
    );
    setCatalogSearch('');
    setIsEditing(true);
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      const updatedProfile: ExtendedUserProfile = {
        ...(isEditing ? form : profile),
        avatar_url: dataUrl,
      };
      setForm(updatedProfile);
      if (onSaveProfile) {
        const res = await onSaveProfile(updatedProfile);
        if (res.ok) {
          toast.success('Foto profil berhasil diperbarui!');
        }
      } else {
        toast.success('Foto profil siap disimpan!');
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memuat foto profil'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleBannerFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressBannerFile(file);
      const updatedProfile: ExtendedUserProfile = {
        ...(isEditing ? form : profile),
        banner_url: dataUrl,
      };
      setForm(updatedProfile);
      if (onSaveProfile) {
        const res = await onSaveProfile(updatedProfile);
        if (res.ok) {
          toast.success('Gambar sampul / banner dashboard berhasil dipasang!');
        }
      } else {
        toast.success('Gambar banner dashboard siap disimpan!');
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memuat gambar banner'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleWallpaperFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const next: AppearanceSettings = {
        ...appearance,
        preset: 'custom',
        customImageUrl: dataUrl,
      };
      setAppearance(next);
      saveAppearanceSettings(next);
      toast.success(
        'Gambar background seluruh halaman dashboard berhasil dipasang!'
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal memasang wallpaper dashboard'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleQuickSelectBanner = async (newBannerUrl: string | null) => {
    const storedVal = newBannerUrl === null ? 'none' : newBannerUrl;
    const updatedProfile: ExtendedUserProfile = {
      ...(isEditing ? form : profile),
      banner_url: storedVal,
    };
    setForm(updatedProfile);
    if (onSaveProfile) {
      const res = await onSaveProfile(updatedProfile);
      if (res.ok) {
        toast.success('Background profil berhasil diperbarui!');
      }
    }
  };

  const handleApplyBannerUrl = async () => {
    const clean = bannerUrlInput.trim();
    if (!clean.startsWith('https://') && !clean.startsWith('http://')) {
      toast.error('Masukkan URL gambar yang valid (https://...)');
      return;
    }
    await handleQuickSelectBanner(clean);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveProfile) return;
    setSaving(true);
    try {
      const res = await onSaveProfile(form);
      if (!res.ok) {
        toast.error(res.error || 'Gagal menyimpan profil');
        return;
      }
      toast.success('Profil & gambar dashboard publik berhasil disimpan!');
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(
        'Link Profil & Dashboard Publik berhasil disalin! Bagikan ke teman-temanmu.'
      );
    } catch {
      toast.error('Gagal menyalin link profil');
    }
  };

  const activeProfile = isEditing ? form : profile;
  const avatarInitial = (activeProfile.full_name || 'U')[0].toUpperCase();
  const favDestination = activeProfile.favorite_media
    ? getCatalogMediaDestinations({
        title: activeProfile.favorite_media,
        category: activeProfile.favorite_category,
      })
    : null;

  const hasCustomBanner = Boolean(
    activeProfile.banner_url &&
      activeProfile.banner_url.trim() &&
      activeProfile.banner_url !== 'none'
  );

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for quick avatar, banner, and full-page wallpaper upload */}
      {isOwnProfile && (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerFileChange}
            className="hidden"
          />
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/*"
            onChange={handleWallpaperFileChange}
            className="hidden"
          />
        </>
      )}

      {/* Profile Hero Banner & Identity Card — Proportional Widescreen Banner (Never stretched/gepeng) */}
      <div className="card-pro overflow-hidden shadow-xl border border-slate-200/90">
        <div
          className="relative w-full h-40 sm:h-56 lg:h-64 overflow-hidden flex flex-col justify-between p-3.5 sm:p-6"
          style={
            !hasCustomBanner
              ? {
                  background: bannerTheme.backgroundStyle,
                }
              : undefined
          }
        >
          {hasCustomBanner && (
            <>
              <img
                src={activeProfile.banner_url!}
                alt="Profile Banner"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/35 via-slate-950/15 to-slate-950/75" />
            </>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/25 text-white text-xs font-bold shadow-xs">
              <Globe className="w-3.5 h-3.5" />
              {activeProfile.is_public
                ? 'Dashboard Profil Publik'
                : 'Profil Privat'}
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {isOwnProfile && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowQuickBgGallery((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 backdrop-blur-md text-white border border-rose-400/40 text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Pilih Background Profil
                  </button>

                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md text-white border border-white/25 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-rose-400" />
                    Upload Gambar
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-rose-600" />
                Bagikan Link Profil
              </button>

              {isOwnProfile && !isEditing && (
                <button
                  type="button"
                  onClick={handleOpenEditor}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-900 text-white border border-white/20 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profil
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap relative z-10">
            <div className="flex items-center gap-2 text-white text-xs font-mono">
              <span className="px-2.5 py-0.5 rounded-md bg-black/45 backdrop-blur-xs border border-white/20 font-bold">
                Target JLPT {activeProfile.jlpt_target}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-black/45 backdrop-blur-xs border border-white/20 font-bold">
                {stats.stageLabel} ({stats.stageCode})
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Quick Background Gallery Drawer */}
        {isOwnProfile && showQuickBgGallery && (
          <div className="p-5 bg-slate-900 text-white border-b border-slate-800 space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  Galeri Background Profil & Anime HD (Klik untuk Langsung Pasang)
                </h4>
                <p className="text-xs text-slate-400">
                  Pilih salah satu artwork anime HD di bawah atau unggah gambar
                  sendiri dari perangkat Anda.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="btn-crimson px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload File Gambar
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickBgGallery(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {BANNER_IMAGE_PRESETS.map((preset) => {
                const selected = activeProfile.banner_url === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void handleQuickSelectBanner(preset.url)}
                    className={`group rounded-xl overflow-hidden border text-left transition cursor-pointer ${
                      selected
                        ? 'border-rose-500 ring-2 ring-rose-500/40 bg-white/10'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div
                      className="h-20 w-full bg-cover bg-center group-hover:scale-105 transition duration-500"
                      style={{ backgroundImage: `url("${preset.url}")` }}
                    />
                    <div className="p-2">
                      <div className="text-xs font-bold text-white truncate flex items-center justify-between gap-1">
                        <span className="truncate">{preset.label}</span>
                        {selected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                      </div>
                      {preset.subtitle && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {preset.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="url"
                value={bannerUrlInput}
                onChange={(e) => setBannerUrlInput(e.target.value)}
                placeholder="Atau tempel URL gambar background apa saja (https://...)"
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => void handleApplyBannerUrl()}
                className="px-4 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-xs font-extrabold cursor-pointer"
              >
                Pasang URL
              </button>
            </div>
          </div>
        )}

        <div className="px-5 sm:px-7 pb-6 pt-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="relative group w-24 h-24 sm:w-28 sm:h-28 -mt-14 sm:-mt-16 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-200 shrink-0">
                {activeProfile.avatar_url ? (
                  <img
                    src={activeProfile.avatar_url}
                    alt={activeProfile.full_name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center text-3xl font-extrabold">
                    {avatarInitial}
                  </div>
                )}

                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    title="Ganti foto profil"
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/85 hover:bg-rose-600 text-white shadow-md transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-1 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {activeProfile.full_name}
                  </h2>
                  <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                    @{activeProfile.username}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  {activeProfile.bio ||
                    'Fokus membangun kebiasaan immersion bahasa Jepang setiap hari.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                    Bahasa: {activeProfile.target_language}
                  </span>
                  {activeProfile.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {activeProfile.location}
                    </span>
                  )}
                  {activeProfile.discord_handle && (
                    <span className="inline-flex items-center gap-1 font-mono text-slate-700">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                      {activeProfile.discord_handle}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Target className="w-3.5 h-3.5 text-rose-600" />
                    Target: {activeProfile.daily_goal_minutes} mnt/hari
                  </span>
                </div>
              </div>
            </div>

            {/* Favorite Media Highlight Badge */}
            {activeProfile.favorite_media && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-3 max-w-xs shrink-0">
                <MediaCover
                  title={activeProfile.favorite_media}
                  category={activeProfile.favorite_category}
                  className="w-11 h-15 rounded-lg shrink-0"
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Media Favorit Utama
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {activeProfile.favorite_media}
                  </div>
                  {favDestination && (
                    <a
                      href={favDestination.primary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {favDestination.primary.shortLabel}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Public Share Link Bar */}
          <div className="mt-5 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-4 h-4 text-rose-600 shrink-0" />
              <div className="text-xs text-slate-700 truncate">
                <span className="font-bold text-slate-900">
                  Link Dashboard Publik:
                </span>{' '}
                <span className="font-mono text-rose-700">
                  {window.location.origin}
                  {import.meta.env.BASE_URL}u/{activeProfile.username}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin Link
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Tampilan Publik
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Profile Editor Drawer */}
      {isOwnProfile && isEditing && (
        <form
          onSubmit={handleSubmitEdit}
          className="card-pro p-6 space-y-5 border-2 border-rose-500/30 animate-scale-in"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-rose-600" />
              <h3 className="font-extrabold text-base text-slate-900">
                Ubah Profil & Kustomisasi Gambar Dashboard Publik
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Tampilan
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, full_name: e.target.value }))
                }
                placeholder="Nama lengkap atau panggilan"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username Publik (@handle)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-mono font-bold text-slate-400">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      username: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_.-]/g, ''),
                    }))
                  }
                  placeholder="username"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Bio / Status Belajar
            </label>
            <textarea
              rows={2}
              value={form.bio}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Ceritakan target bahasa Jepang, metode belajar, atau media favoritmu..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
            />
          </div>

          {/* 1. GAMBAR SAMPUL / BANNER HEADER DASHBOARD PROFIL */}
          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rose-600" />
                <div>
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Gambar Sampul / Banner Dashboard Profil
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Unggah gambar anime/pemandangan dari perangkat Anda atau
                    pilih preset Jepang di bawah
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Unggah Gambar Banner dari Perangkat
                </button>

                {form.banner_url && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, banner_url: null }));
                      setBannerUrlInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-600 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Gambar
                  </button>
                )}
              </div>
            </div>

            {/* Paste Banner URL */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={bannerUrlInput}
                onChange={(e) => setBannerUrlInput(e.target.value)}
                placeholder="Atau tempel URL gambar banner (https://...)"
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleApplyBannerUrl}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-rose-600 cursor-pointer"
              >
                Pasang URL Gambar
              </button>
            </div>

            {/* Scenery Image Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-600">
                Preset Gambar Pemandangan Jepang:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BANNER_IMAGE_PRESETS.map((preset) => {
                  const selected = form.banner_url === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, banner_url: preset.url }))
                      }
                      className={`p-1.5 rounded-xl border text-left transition cursor-pointer ${
                        selected
                          ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-500/20'
                          : 'border-slate-200 bg-white hover:border-rose-300'
                      }`}
                    >
                      <div
                        className="h-12 rounded-lg bg-cover bg-center"
                        style={{ backgroundImage: `url("${preset.url}")` }}
                      />
                      <div className="text-[11px] font-bold text-slate-800 mt-1 flex items-center justify-between">
                        <span className="truncate">{preset.label}</span>
                        {selected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Gradient Themes */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <Palette className="w-3.5 h-3.5 text-rose-600" />
                Atau Pilih Tema Gradasi Warna Header:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {PROFILE_BANNER_THEMES.map((theme) => {
                  const active =
                    !form.banner_url && form.banner_theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          banner_url: null,
                          banner_theme: theme.id as ProfileBannerThemeId,
                        }))
                      }
                      className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="h-7 rounded-lg"
                        style={{ background: theme.backgroundStyle }}
                      />
                      <div className="text-[11px] font-bold text-slate-800 mt-1.5 flex items-center justify-between">
                        <span className="truncate">{theme.name}</span>
                        {active && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. FOTO PROFIL / AVATAR */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Foto Profil / Avatar Jepang
              </span>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="btn-crimson px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Unggah Foto Avatar dari Perangkat
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const selected = form.avatar_url === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, avatar_url: preset.url }))
                    }
                    className={`p-1.5 rounded-xl border text-center transition cursor-pointer ${
                      selected
                        ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-500/20'
                        : 'border-slate-200 bg-white hover:border-rose-300'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-10 h-10 rounded-full mx-auto"
                    />
                    <div className="text-[10px] font-bold text-slate-700 mt-1 truncate">
                      {preset.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. BACKGROUND / WALLPAPER SELURUH HALAMAN DASHBOARD */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Wallpaper / Background Seluruh Halaman Dashboard
              </div>
              <div className="text-[11px] text-slate-500">
                Ganti gambar latar belakang utama di seluruh halaman website
                ImmersionTrack
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => wallpaperInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Unggah Wallpaper Seluruh Dashboard
              </button>
              {appearance.preset === 'custom' && (
                <button
                  type="button"
                  onClick={() => {
                    setAppearance(DEFAULT_APPEARANCE);
                    saveAppearanceSettings(DEFAULT_APPEARANCE);
                    toast.success('Wallpaper dashboard direset ke default.');
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-rose-600 cursor-pointer"
                >
                  Reset Wallpaper
                </button>
              )}
            </div>
          </div>

          {/* JLPT Target, Favorite Media, Location, Discord, Daily Goal */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Level JLPT
              </label>
              <div className="flex gap-1.5">
                {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, jlpt_target: lvl }))
                    }
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                      form.jlpt_target === lvl
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lokasi / Kota
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Contoh: Jakarta, Indonesia"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username Discord / Sosial
              </label>
              <input
                type="text"
                value={form.discord_handle}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discord_handle: e.target.value,
                  }))
                }
                placeholder="Contoh: @maulana_jp"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Media Favorit (Tampil di Header Profil)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.favorite_media}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      favorite_media: e.target.value,
                    }));
                    setCatalogSearch(e.target.value);
                  }}
                  placeholder="Ketik atau pilih judul anime, novel, manga, VN..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
                <select
                  value={form.favorite_category}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      favorite_category: e.target
                        .value as PrimaryMediaCategory,
                    }))
                  }
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
                >
                  {PRIMARY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryMeta(cat).shortLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matchingCatalogSuggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        favorite_media: item.title,
                        favorite_category: item.category,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-semibold text-slate-700 hover:text-rose-700 truncate max-w-56 cursor-pointer"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Target Harian (menit/hari)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={form.daily_goal_minutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    daily_goal_minutes: Number(e.target.value),
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />

              <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_public: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                Izinkan orang lain melihat dashboard profil saya
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-crimson px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
            </button>
          </div>
        </form>
      )}

      {/* 4 Public Dashboard Stat Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-pro p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Immersion
            </span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {stats.totalHours.toFixed(1)} Jam
          </div>
          <div className="text-xs font-medium text-slate-500">
            {stats.totalSessions} sesi tercatat • Hari ini {stats.todayMinutes}m
          </div>
        </div>

        <div className="card-pro p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Konsistensi Streak
            </span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {stats.streak} Hari
          </div>
          <div className="text-xs font-medium text-slate-500">
            Rekor terbaik: {stats.longestStreak} hari berturut-turut
          </div>
        </div>

        <div className="card-pro p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tahap Kemahiran
            </span>
            <Award className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-extrabold text-slate-900">
              {stats.stageLabel}
            </span>
            <span className="text-xs font-mono text-rose-600 font-bold">
              {stats.stageProgressPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
              style={{ width: `${stats.stageProgressPct}%` }}
            />
          </div>
        </div>

        <div className="card-pro p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Listening vs Reading
            </span>
            <BookOpen className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg font-extrabold font-mono text-slate-900">
            {stats.listeningHours}j L • {stats.readingHours}j R
          </div>
          <div className="text-xs font-medium text-slate-500">
            +{stats.totalCards.toLocaleString('id-ID')} kartu Anki ditambang
          </div>
        </div>
      </div>

      {/* Media Showcase & Unlocked Achievements */}
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 card-pro p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Media yang Dipelajari oleh {activeProfile.full_name}
              </h3>
              <p className="text-xs text-slate-500">
                Daftar anime, novel, manga, dan media dengan akumulasi jam
                tertinggi.
              </p>
            </div>
            <span className="text-xs font-mono text-rose-600 font-bold">
              {topMedia.length} Judul
            </span>
          </div>

          {topMedia.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/70">
              Belum ada media tercatat. Mulai catat sesi dari Katalog Media!
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {topMedia.map((media) => {
                const meta = getCategoryMeta(media.category);
                const dest =
                  media.category !== 'study'
                    ? getCatalogMediaDestinations({
                        title: media.title,
                        category: media.category,
                      })
                    : null;
                return (
                  <div
                    key={`${media.title}-${media.category}`}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3"
                  >
                    <MediaCover
                      title={media.title}
                      category={media.category}
                      className="w-12 h-17 rounded-lg shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                        {meta.shortLabel}
                      </span>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {media.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {(media.totalMinutes / 60).toFixed(1)} jam •{' '}
                        {media.sessions} sesi
                      </div>
                      {dest && (
                        <a
                          href={dest.primary.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {dest.primary.shortLabel}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 card-pro p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-rose-600" />
              <h3 className="font-extrabold text-slate-900 text-sm">
                Badge & Pencapaian Terbuka
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {unlockedBadges.length} Badge
            </span>
          </div>

          {unlockedBadges.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/70">
              Catat sesi immersion pertamamu untuk membuka badge pencapaian!
            </div>
          ) : (
            <div className="space-y-2.5">
              {unlockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {badge.title}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {badge.description}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold uppercase text-rose-700 shrink-0">
                    {badge.rarity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Annual Activity Heatmap if full logs available */}
      {logs && logs.length > 0 && (
        <ActivityHeatmap
          logs={logs}
          dailyGoal={activeProfile.daily_goal_minutes}
        />
      )}

      {/* Recent Immersion Activity Log on Profile */}
      {recentLogs.length > 0 && (
        <div className="card-pro p-5 space-y-3.5">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Riwayat Sesi Terbaru ({activeProfile.full_name})
          </h3>
          <div className="divide-y divide-slate-100">
            {recentLogs.map((log) => {
              const meta = getCategoryMeta(log.category);
              return (
                <div
                  key={log.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MediaCover
                      title={log.title}
                      category={log.category}
                      className="w-10 h-14 rounded-lg shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {log.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {meta.shortLabel} • {log.logged_date}
                        {log.cards_mined > 0
                          ? ` • +${log.cards_mined} kartu`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-xs font-mono font-bold text-rose-700 shrink-0">
                    {log.duration_minutes} mnt
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Directory: Inspect Other Learners' Profile Dashboards */}
      <div className="card-pro p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-600" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Direktori Profil Pelajar Lain (Cek Dashboard Komunitas)
              </h3>
              <p className="text-xs text-slate-500">
                Klik profil pelajar di bawah untuk melihat tampilan dashboard
                publik, streak, dan media favorit mereka.
              </p>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COMMUNITY_LEADERBOARD.map((member, idx) => {
            const avatarUrl = AVATAR_PRESETS[idx % AVATAR_PRESETS.length].url;
            return (
              <div
                key={member.id}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-200/80 hover:border-rose-300 flex items-center justify-between gap-3 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={avatarUrl}
                    alt={member.name}
                    className="w-10 h-10 rounded-full shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 truncate">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {member.rankTitle}
                    </div>
                    <div className="text-[11px] font-mono text-rose-600 font-bold">
                      {member.totalHours}j • {member.streak}h streak
                    </div>
                  </div>
                </div>

                {onInspectMember ? (
                  <button
                    type="button"
                    onClick={() => onInspectMember(member.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white border border-slate-200 text-[11px] font-bold text-rose-600 transition shrink-0 cursor-pointer"
                  >
                    Cek Profil
                  </button>
                ) : (
                  <Link
                    to={`/u/${member.id}`}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white border border-slate-200 text-[11px] font-bold text-rose-600 transition shrink-0"
                  >
                    Cek Profil
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

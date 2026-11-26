import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, LogIn, UserCheck } from 'lucide-react';
import { ProfileDashboardSection } from '../components/ProfileDashboardSection';
import { useAuth } from '../context/AuthContext';
import {
  buildCommunityMemberSnapshot,
  buildPublicProfileSnapshot,
  buildPublicShowcaseFromRpc,
  decodeProfileSnapshotFromToken,
  loadExtendedProfileMeta,
  saveExtendedProfileMeta,
  type ExtendedUserProfile,
  type PublicProfileSnapshot,
  type RpcPublicProfileShowcase,
} from '../lib/profileMeta';
import { supabase } from '../lib/supabase';
import type { ImmersionLog } from '../types';

export const PublicProfilePage: React.FC = () => {
  const { handle } = useParams<{ handle?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const snapshotParam = searchParams.get('s') || '';
  const decodedFromUrl = useMemo(
    () => decodeProfileSnapshotFromToken(snapshotParam),
    [snapshotParam]
  );

  const ownExtProfile = useMemo(() => {
    if (!user) return null;
    return loadExtendedProfileMeta(
      user.id,
      profile,
      user.email,
      user.user_metadata
    );
  }, [user, profile]);

  const isViewingSelf = useMemo(() => {
    if (!user || !ownExtProfile) return false;
    if (!handle || handle === 'me') return true;
    const clean = handle.toLowerCase();
    return (
      clean === user.id.toLowerCase() ||
      clean === ownExtProfile.username.toLowerCase()
    );
  }, [user, ownExtProfile, handle]);

  const [remoteSnapshot, setRemoteSnapshot] =
    useState<PublicProfileSnapshot | null>(null);
  const [ownLogs, setOwnLogs] = useState<ImmersionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [localExtOverride, setLocalExtOverride] =
    useState<ExtendedUserProfile | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      // 1. If viewing own profile, load own live logs from Supabase
      if (isViewingSelf && user && ownExtProfile) {
        const { data } = await supabase
          .from('immersion_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('logged_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (!active) return;
        const logs = (data as ImmersionLog[]) ?? [];
        setOwnLogs(logs);
        setRemoteSnapshot(
          buildPublicProfileSnapshot(localExtOverride ?? ownExtProfile, logs)
        );
        setLoading(false);
        return;
      }

      // 2. If URL has encoded snapshot token (?s=...), use it directly
      if (decodedFromUrl) {
        if (active) {
          setRemoteSnapshot(decodedFromUrl);
          setLoading(false);
        }
        return;
      }

      // 3. Check if handle matches a community member
      if (handle) {
        const comm = buildCommunityMemberSnapshot(handle);
        if (comm) {
          if (active) {
            setRemoteSnapshot(comm);
            setLoading(false);
          }
          return;
        }
      }

      // 4. Try fetching public showcase summary via least-privilege RPC (only if is_public = true)
      if (handle) {
        const cleanHandle = handle.trim().slice(0, 64);
        const { data: showcaseData } = await supabase.rpc(
          'get_public_profile_showcase',
          { p_handle: cleanHandle }
        );

        if (!active) return;
        const row = Array.isArray(showcaseData)
          ? (showcaseData[0] as RpcPublicProfileShowcase | undefined)
          : (showcaseData as RpcPublicProfileShowcase | null);

        if (row && row.id) {
          setRemoteSnapshot(buildPublicShowcaseFromRpc(row));
          setLoading(false);
          return;
        }
      }

      if (active) {
        setRemoteSnapshot(null);
        setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [
    handle,
    isViewingSelf,
    user,
    ownExtProfile,
    decodedFromUrl,
    localExtOverride,
  ]);

  const handleSaveOwnProfile = async (updated: ExtendedUserProfile) => {
    if (!user) return { ok: false, error: 'Silakan login terlebih dahulu' };
    const res = await saveExtendedProfileMeta(user.id, updated);
    if (res.ok) {
      setLocalExtOverride(updated);
      await refreshProfile();
    }
    return res;
  };

  return (
    <div className="min-h-screen app-bg-canvas text-slate-900">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to={user ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-rose-600 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {user ? 'Kembali ke Dashboard' : 'Halaman Login'}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {!isViewingSelf && (
                  <Link
                    to="/u/me"
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-xs font-bold text-slate-700 hover:text-rose-700 inline-flex items-center gap-1.5 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-rose-600" />
                    Profil Saya
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard Utama
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Masuk / Buat Profilmu
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
        {loading ? (
          <div className="space-y-4">
            <div className="card-pro h-64 animate-pulse" />
            <div className="grid sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card-pro h-28 animate-pulse" />
              ))}
            </div>
          </div>
        ) : !remoteSnapshot ? (
          <div className="card-pro p-10 text-center max-w-lg mx-auto space-y-4">
            <h1 className="text-lg font-extrabold text-slate-900">
              Profil Pelajar Tidak Ditemukan
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pastikan link profil publik yang Anda buka lengkap, atau pilih
              salah satu profil pelajar dari direktori komunitas di bawah.
            </p>
            <div className="flex justify-center gap-2">
              <Link
                to={user ? '/dashboard' : '/login'}
                className="btn-crimson px-4 py-2 rounded-xl text-xs font-bold"
              >
                {user ? 'Ke Dashboard Saya' : 'Masuk Akun'}
              </Link>
            </div>
          </div>
        ) : (
          <ProfileDashboardSection
            snapshot={remoteSnapshot}
            logs={isViewingSelf ? ownLogs : undefined}
            isOwnProfile={isViewingSelf}
            onSaveProfile={handleSaveOwnProfile}
            onInspectMember={(memberId) => navigate(`/u/${memberId}`)}
          />
        )}
      </main>
    </div>
  );
};

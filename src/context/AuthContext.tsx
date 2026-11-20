import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  DEMO_MODE_KEY,
  DEMO_USER_ID,
  loadDemoLogs,
  loadDemoProfile,
  saveDemoProfile,
} from '../lib/demoData';
import type { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  updateDemoProfile: (patch: Partial<Profile>) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER = {
  id: DEMO_USER_ID,
  email: 'maulana@nihongotracker.my.id',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Maulana' },
  created_at: new Date().toISOString(),
} as unknown as User;

function readInitialDemoFlag(): boolean {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(readInitialDemoFlag);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() =>
    readInitialDemoFlag() ? loadDemoProfile() : null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !readInitialDemoFlag() && isSupabaseConfigured
  );

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  useEffect(() => {
    if (isDemoMode || !isSupabaseConfigured) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession?.user) {
          fetchProfile(currentSession.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode]);

  const enterDemoMode = () => {
    try {
      localStorage.setItem(DEMO_MODE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    loadDemoLogs();
    const demoProfile = loadDemoProfile();
    setProfile(demoProfile);
    setIsDemoMode(true);
    setLoading(false);
  };

  const updateDemoProfile = (patch: Partial<Profile>) => {
    const current = profile ?? loadDemoProfile();
    const updated: Profile = { ...current, ...patch };
    saveDemoProfile(updated);
    setProfile(updated);
  };

  const refreshProfile = async () => {
    if (isDemoMode) {
      setProfile(loadDemoProfile());
      return;
    }
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {
      // ignore storage errors
    }
    if (!isDemoMode && isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
  };

  const activeUser: User | null = isDemoMode
    ? LOCAL_USER
    : (session?.user ?? null);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: activeUser,
        profile,
        loading,
        isDemoMode,
        enterDemoMode,
        updateDemoProfile,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

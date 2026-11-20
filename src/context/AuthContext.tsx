import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
  passwordRecoveryMode: boolean;
  clearPasswordRecovery: () => void;
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
  const [supabaseReady, setSupabaseReady] = useState<boolean>(
    () => isSupabaseConfigured
  );
  const [isDemoMode, setIsDemoMode] = useState<boolean>(readInitialDemoFlag);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() =>
    readInitialDemoFlag() ? loadDemoProfile() : null
  );
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [loading, setLoading] = useState<boolean>(
    () => !readInitialDemoFlag() && isSupabaseConfigured
  );

  const fetchOrInitProfile = useCallback(async (authUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) return;

    if (data) {
      setProfile(data as Profile);
      return;
    }

    const fallbackName =
      (authUser.user_metadata?.full_name as string | undefined) ||
      authUser.email?.split('@')[0] ||
      'Learner';
    const fallbackAvatar =
      (authUser.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data: created } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        full_name: fallbackName,
        avatar_url: fallbackAvatar,
      })
      .select()
      .single();

    if (created) {
      setProfile(created as Profile);
    }
  }, []);

  useEffect(() => {
    const onConfigChange = () => {
      setSupabaseReady(isSupabaseConfigured);
    };
    window.addEventListener('supabase-config-changed', onConfigChange);
    return () =>
      window.removeEventListener('supabase-config-changed', onConfigChange);
  }, []);

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!active) return;
        if (currentSession?.user) {
          try {
            localStorage.removeItem(DEMO_MODE_KEY);
          } catch {
            // ignore storage errors
          }
          setIsDemoMode(false);
          setSession(currentSession);
          void fetchOrInitProfile(currentSession.user).finally(() => {
            if (active) setLoading(false);
          });
        } else {
          setSession(null);
          if (readInitialDemoFlag()) {
            setIsDemoMode(true);
            setProfile(loadDemoProfile());
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setPasswordRecoveryMode(false);
      }

      setSession(newSession);

      if (newSession?.user) {
        try {
          localStorage.removeItem(DEMO_MODE_KEY);
        } catch {
          // ignore storage errors
        }
        setIsDemoMode(false);
        void fetchOrInitProfile(newSession.user);
      } else if (!readInitialDemoFlag()) {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseReady, fetchOrInitProfile]);

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
      await fetchOrInitProfile(session.user);
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
    setPasswordRecoveryMode(false);
    setIsDemoMode(false);
    setSession(null);
    setProfile(null);
  };

  const clearPasswordRecovery = () => setPasswordRecoveryMode(false);

  const activeUser: User | null = session?.user
    ? session.user
    : isDemoMode
      ? LOCAL_USER
      : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: activeUser,
        profile,
        loading,
        isDemoMode: Boolean(!session?.user && isDemoMode),
        passwordRecoveryMode,
        clearPasswordRecovery,
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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEMO_MODE_KEY } from '../lib/demoData';
import type { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecoveryMode: boolean;
  clearPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured);

  useEffect(() => {
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

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
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!active) return;
        if (currentSession?.user) {
          setSession(currentSession);
          void fetchOrInitProfile(currentSession.user).finally(() => {
            if (active) setLoading(false);
          });
        } else {
          setSession(null);
          setProfile(null);
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
        void fetchOrInitProfile(newSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchOrInitProfile]);

  const refreshProfile = async () => {
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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setPasswordRecoveryMode(false);
    setSession(null);
    setProfile(null);
  };

  const clearPasswordRecovery = () => setPasswordRecoveryMode(false);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        passwordRecoveryMode,
        clearPasswordRecovery,
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

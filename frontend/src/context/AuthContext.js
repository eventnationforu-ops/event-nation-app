import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_BASE = 'https://event-nation-backend.onrender.com/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        // profiles table may not exist yet; treat as no profile
        setProfile(null);
        return;
      }
      setProfile(data ?? null);
    } catch {
      setProfile(null);
    }
  }

  async function checkAdminRole(userId) {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  }

  async function hydrateUser(currentSession) {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (currentSession?.user) {
      // Fire and forget — these enrich state but never block sign-in.
      // Supabase session validity is the source of truth for auth.
      loadProfile(currentSession.user.id).catch(() => {});
      checkAdminRole(currentSession.user.id).catch(() => {});
    } else {
      setProfile(null);
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      hydrateUser(s).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        hydrateUser(s);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const token = session?.access_token;
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-critical — Supabase handles actual token invalidation
      }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const refreshUser = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      await Promise.all([
        loadProfile(s.user.id),
        checkAdminRole(s.user.id),
      ]);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      isAdmin,
      loading,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [session, user, profile, isAdmin, loading, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

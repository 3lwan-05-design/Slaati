import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authStore from './auth/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    authStore
      .loadSession()
      .then((saved) => {
        if (!alive) return;
        setSession(saved);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session && !session.guest ? session.user : null,
      isGuest: !!(session && session.guest),
      // "authOpen" = the sign-in screen was requested from inside the app.
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false),
      applySession: (next) => {
        setSession(next);
        setAuthOpen(false);
      },
      continueAsGuest: async () => {
        const next = await authStore.continueAsGuest();
        setSession(next);
        setAuthOpen(false);
      },
      signIn: async (credentials) => {
        const result = await authStore.signIn(credentials);
        if (result.ok) {
          setSession(result.session);
          setAuthOpen(false);
        }
        return result;
      },
      signUp: async (payload) => {
        const result = await authStore.signUp(payload);
        if (result.ok) {
          setSession(result.session);
          setAuthOpen(false);
        }
        return result;
      },
      socialSignIn: async (payload) => {
        const result = await authStore.socialSignIn(payload);
        if (result.ok) {
          setSession(result.session);
          setAuthOpen(false);
        }
        return result;
      },
      signOut: async () => {
        await authStore.signOut();
        const next = await authStore.continueAsGuest();
        setSession(next);
        setAuthOpen(false);
      },
      deleteAccount: async () => {
        const next = await authStore.deleteCurrentAccount();
        setSession(next);
        setAuthOpen(false);
        return { ok: true };
      },
    }),
    [loading, session, authOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

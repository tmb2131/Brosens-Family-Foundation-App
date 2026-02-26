"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { UserProfile } from "@/lib/types";

interface AuthState {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchCurrentProfile() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store"
    });

    if (response.ok) {
      const payload = await response.json();
      return payload.user as UserProfile | null;
    }

    if (response.status !== 401) {
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }

  return null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const supabase = useMemo(() => createClient(), []);
  const syncedTimezoneRef = useRef<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      if (data.session) {
        const profile = await fetchCurrentProfile();
        if (mounted) {
          setUser(profile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      if (nextSession) {
        const profile = await fetchCurrentProfile();
        if (mounted) {
          setUser(profile);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session || !user) {
      syncedTimezoneRef.current = null;
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (!timezone) {
      return;
    }

    const syncKey = `${session.user.id}:${timezone}`;
    if (syncedTimezoneRef.current === syncKey) {
      return;
    }

    syncedTimezoneRef.current = syncKey;
    void fetch("/api/auth/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone })
    }).catch(() => {
      syncedTimezoneRef.current = null;
    });
  }, [session, user]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      setSession(null);
      setUser(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }

    setSession(null);
    setUser(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    const profile = await fetchCurrentProfile();
    setUser(profile);
  }, []);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!supabase) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }

      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (password: string) => {
      if (!supabase) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      configured: Boolean(supabase),
      signIn,
      signOut,
      refreshProfile,
      sendPasswordReset,
      updatePassword
    }),
    [session, user, loading, supabase, signIn, signOut, refreshProfile, sendPasswordReset, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

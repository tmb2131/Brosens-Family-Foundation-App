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
import type { Session, SupabaseClient } from "@supabase/supabase-js";
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const SeedProfileContext = createContext<((profile: UserProfile) => void) | null>(null);

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

export function useSeedProfile() {
  return useContext(SeedProfileContext);
}

const URL_CREDENTIAL_PARAMS = ["code", "token_hash", "type"] as const;

/**
 * Removes consumed auth credentials from the address bar without a navigation.
 * `fragmentOnly` leaves the query string alone, so a page's own `?error=` copy
 * survives when all that needed clearing was the fragment.
 */
function stripAuthCredentialsFromUrl(fragmentOnly = false) {
  const url = new URL(window.location.href);
  if (!fragmentOnly) {
    for (const param of URL_CREDENTIAL_PARAMS) {
      url.searchParams.delete(param);
    }
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/**
 * Establishes a session from credentials carried in the current URL.
 *
 * `/auth/callback` handles this server-side for links that reach it, but
 * Supabase does not always route through it: implicit-flow links return their
 * tokens in the fragment (which never leaves the browser), and a project whose
 * redirect allow-list rejects the callback URL falls back to the Site URL. In
 * both cases the credentials land on an ordinary page, so consume them here
 * rather than leaving the user on a page that looks signed out.
 */
async function consumeAuthCredentialsFromUrl(supabase: SupabaseClient): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    stripAuthCredentialsFromUrl();
    return;
  }

  // An expired link reports the failure in the fragment too; drop it so the
  // page can render its own "request a new link" messaging.
  if (hashParams.get("error") || hashParams.get("error_code")) {
    stripAuthCredentialsFromUrl(true);
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      stripAuthCredentialsFromUrl();
    }
    return;
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) {
      stripAuthCredentialsFromUrl();
    }
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const supabase = useMemo(() => createClient(), []);
  const syncedTimezoneRef = useRef<string | null>(null);
  const serverSeededRef = useRef(false);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const seedProfile = useCallback((profile: UserProfile) => {
    serverSeededRef.current = true;
    setUser(profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const bootstrapSession = async () => {
      // Email links (password reset, magic link) can deliver their credentials
      // straight to this page; redeem them before reading the session.
      await consumeAuthCredentialsFromUrl(supabase).catch(() => {});

      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      setSession(data.session);
      if (serverSeededRef.current) {
        return;
      }
      if (data.session) {
        const profile = await fetchCurrentProfile();
        if (mounted) {
          setUser(profile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    // Without the catch a rejected read would leave every gated page stuck on
    // its "loading" branch forever.
    void bootstrapSession().catch(() => {
      if (mounted) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      if (nextSession) {
        if (serverSeededRef.current) {
          serverSeededRef.current = false;
          return;
        }
        const profile = await fetchCurrentProfile();
        if (mounted) {
          setUser(profile);
        }
      } else {
        serverSeededRef.current = false;
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

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!supabase) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }

      const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !authUser?.email) {
        throw new Error("Unable to verify your account. Please sign in again.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword
      });
      if (signInError) {
        throw signInError;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw updateError;
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
      updatePassword,
      changePassword
    }),
    [session, user, loading, supabase, signIn, signOut, refreshProfile, sendPasswordReset, updatePassword, changePassword]
  );

  return (
    <AuthContext.Provider value={value}>
      <SeedProfileContext.Provider value={seedProfile}>
        {children}
      </SeedProfileContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

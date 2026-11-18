"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { getClientIsMobile } from "@/lib/device-detection";
import { UserProfile, type AuthUsersResponse } from "@/lib/types";

type AppRole = UserProfile["role"];

/** Pages a sign-in may return to, and the roles that can open each one. */
const REDIRECT_ROLES: Record<string, readonly AppRole[]> = {
  "/mobile": ["member", "oversight", "manager", "admin"],
  "/dashboard": ["member", "oversight", "manager", "admin"],
  "/workspace": ["member", "oversight"],
  "/meeting": ["oversight", "manager"],
  "/admin": ["admin"],
  "/settings": ["member", "oversight", "manager", "admin"],
  "/proposals/new": ["member", "oversight", "manager", "admin"],
  "/frank-deenie": ["member", "oversight", "manager", "admin"],
  "/mandate": ["member", "oversight", "manager", "admin"],
  "/reports": ["member", "oversight", "manager", "admin"]
};

/** `/proposals/<uuid>` — a shared link to a single proposal. */
const PROPOSAL_DETAIL_PATH =
  /^\/proposals\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REDIRECT_BASE = "https://redirect.invalid";

/**
 * The page to return to after sign-in, or null. Keeps the query string (email
 * links carry `?proposalId=` and `/mobile?next=`), but only for known pages on
 * this origin, so it can't be used as an open redirect.
 */
function sanitizeRedirect(target: string | null): Route | null {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(target, REDIRECT_BASE);
  } catch {
    return null;
  }
  if (url.origin !== REDIRECT_BASE) {
    return null;
  }
  if (!(url.pathname in REDIRECT_ROLES) && !PROPOSAL_DETAIL_PATH.test(url.pathname)) {
    return null;
  }
  return `${url.pathname}${url.search}` as Route;
}

function canOpen(role: AppRole, target: Route): boolean {
  const pathname = new URL(target, REDIRECT_BASE).pathname;
  if (PROPOSAL_DETAIL_PATH.test(pathname)) {
    return true;
  }
  return REDIRECT_ROLES[pathname]?.includes(role) ?? false;
}

function defaultLandingPage(role: AppRole | null | undefined, isMobile: boolean): Route {
  if (role === "admin") {
    return "/admin";
  }
  if (role === "member") {
    return isMobile ? "/mobile" : "/workspace";
  }
  if (role === "manager") {
    return "/frank-deenie";
  }
  return "/dashboard";
}

/**
 * Where to go after sign-in: the page the visitor was sent here from (a shared
 * link, an email link, or the page whose session expired) when their role can
 * open it, otherwise their role's usual landing page.
 */
function resolvePostLoginRedirect(
  role: AppRole | null | undefined,
  requested: Route | null,
  isMobile: boolean
): Route {
  if (requested && role && canOpen(role, requested)) {
    return requested;
  }
  return defaultLandingPage(role, isMobile);
}

async function loadSignedInProfile() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return (payload?.user ?? null) as UserProfile | null;
}

function parseLoginError(error: unknown): { message: string; allowRecovery: boolean } {
  if (!(error instanceof Error)) {
    return {
      message: "Unable to sign in right now. Please try again.",
      allowRecovery: false
    };
  }

  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return {
      message: "Incorrect email or password.",
      allowRecovery: true
    };
  }
  if (message.includes("email not confirmed")) {
    return {
      message: "Please confirm your email before signing in.",
      allowRecovery: false
    };
  }
  if (message.includes("too many requests")) {
    return {
      message: "Too many sign-in attempts. Please wait and try again.",
      allowRecovery: false
    };
  }
  if (message.includes("failed to fetch")) {
    return {
      message: "Unable to reach the server. Check your connection and try again.",
      allowRecovery: false
    };
  }

  return {
    message: "Unable to sign in right now. Please try again.",
    allowRecovery: false
  };
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const resetSuccess = params.get("reset") === "success";
  const safeRedirect = sanitizeRedirect(params.get("redirect"));
  const isMobile = getClientIsMobile();
  const { signIn, refreshProfile, user, configured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<AuthUsersResponse["users"]>([]);
  const [isEmailDropdownOpen, setIsEmailDropdownOpen] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(resolvePostLoginRedirect(user.role, safeRedirect, isMobile));
    }
  }, [router, safeRedirect, user, isMobile]);

  useEffect(() => {
    fetch("/api/auth/users")
      .then((res) => res.json())
      .then((data: AuthUsersResponse) => setAllUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const forgotPasswordHref = useMemo(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return "/forgot-password";
    }

    return `/forgot-password?email=${encodeURIComponent(trimmedEmail)}`;
  }, [email]);

  const matchingUsers = useMemo(() => {
    const q = email.trim().toLowerCase();
    if (!q) return allUsers;
    const startsWith = allUsers.filter(
      (u) => u.email.toLowerCase().startsWith(q) || u.name.toLowerCase().startsWith(q)
    );
    const contains = allUsers.filter(
      (u) =>
        !u.email.toLowerCase().startsWith(q) &&
        !u.name.toLowerCase().startsWith(q) &&
        (u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    );
    return [...startsWith, ...contains];
  }, [email, allUsers]);

  const showEmailDropdown = isEmailDropdownOpen && matchingUsers.length > 0;

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setShowForgotPassword(false);
    try {
      await signIn(email.trim(), password);
      const profile = await loadSignedInProfile();
      await refreshProfile();
      router.replace(resolvePostLoginRedirect(profile?.role, safeRedirect, isMobile));
    } catch (err) {
      const parsedError = parseLoginError(err);
      setError(parsedError.message);
      setShowForgotPassword(parsedError.allowRecovery);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <GlassCard className="w-full rounded-3xl p-5">
        <CardLabel>Secure Access</CardLabel>
        <CardValue>Foundation Login</CardValue>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with your email and password.</p>
        <p className="mt-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          The default password is <strong className="font-medium text-foreground">password</strong>. Change it
          in{" "}
          <Link href="/settings" className="font-medium text-foreground underline-offset-2 hover:underline">
            Settings
          </Link>{" "}
          after signing in, or use the Forgot password link below.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitLogin} aria-busy={loading}>
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <div
              className="relative flex rounded-xl border border-input shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-[hsl(var(--accent)/0.45)] focus-within:shadow-[0_0_0_2px_hsl(var(--accent)/0.22)]"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsEmailDropdownOpen(false);
                }
              }}
            >
              <input
                id="login-email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setIsEmailDropdownOpen(true);
                }}
                onFocus={() => setIsEmailDropdownOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setIsEmailDropdownOpen(false);
                }}
                required
                type="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                className="min-w-0 flex-1 rounded-l-xl border-none bg-transparent px-3 py-2 text-sm text-foreground shadow-none outline-none"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsEmailDropdownOpen((open) => !open)}
                className="flex w-10 shrink-0 items-center justify-center rounded-r-xl border-l border-input bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                aria-label="Show member email suggestions"
                aria-expanded={showEmailDropdown}
                aria-controls="login-email-suggestions"
              >
                <ChevronDown aria-hidden="true" size={16} />
              </button>
              {showEmailDropdown ? (
                <div
                  id="login-email-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                >
                  {matchingUsers.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      role="option"
                      aria-selected={email === u.email}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setEmail(u.email);
                        setIsEmailDropdownOpen(false);
                      }}
                      className="block w-full rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium text-foreground">{u.name}</span>
                      <span className="ml-2 text-muted-foreground">{u.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <PasswordInput
              id="login-password"
              name="password"
              className="rounded-xl"
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="flex justify-end">
            <Link
              href={forgotPasswordHref}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button
            size="lg"
            className="w-full"
            type="submit"
            disabled={loading || !configured}
          >
            {!configured ? "Set Supabase env vars" : loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        ) : null}
        {showForgotPassword ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Need help signing in?{" "}
            <Link href={forgotPasswordHref} className="font-medium text-foreground underline-offset-2 hover:underline">
              Reset your password
            </Link>
            .
          </p>
        ) : null}
        {resetSuccess ? (
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300" aria-live="polite">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-xs text-rose-600" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}
      </GlassCard>
    </div>
  );
}

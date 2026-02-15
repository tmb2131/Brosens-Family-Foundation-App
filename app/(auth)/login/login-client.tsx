"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { UserProfile } from "@/lib/types";

const allowedRedirects = [
  "/mobile",
  "/dashboard",
  "/workspace",
  "/meeting",
  "/admin",
  "/settings",
  "/proposals/new"
] as const;

function sanitizeRedirect(target: string): Route {
  if (allowedRedirects.includes(target as (typeof allowedRedirects)[number])) {
    return target as Route;
  }
  return "/dashboard";
}

function resolvePostLoginRedirect(role: UserProfile["role"] | null | undefined, fallback: Route): Route {
  if (role === "admin") {
    return "/admin";
  }

  return fallback;
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
  const recoveryMode = params.get("mode") === "recovery";
  const resetSuccess = params.get("reset") === "success";
  const redirect = params.get("redirect") || "/dashboard";
  const safeRedirect = sanitizeRedirect(redirect);
  const { signIn, refreshProfile, user, configured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recoveryMode) {
      router.replace("/reset-password");
      return;
    }

    if (user) {
      router.replace(resolvePostLoginRedirect(user.role, safeRedirect));
    }
  }, [router, safeRedirect, user, recoveryMode]);

  const forgotPasswordHref = useMemo(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return "/forgot-password";
    }

    return `/forgot-password?email=${encodeURIComponent(trimmedEmail)}`;
  }, [email]);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setShowForgotPassword(false);
    try {
      await signIn(email.trim(), password);
      const profile = await loadSignedInProfile();
      await refreshProfile();
      router.replace(resolvePostLoginRedirect(profile?.role, safeRedirect));
    } catch (err) {
      const parsedError = parseLoginError(err);
      setError(parsedError.message);
      setShowForgotPassword(parsedError.allowRecovery);
    } finally {
      setLoading(false);
    }
  };

  if (recoveryMode) {
    return (
      <div className="page-enter mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
        <Card className="w-full rounded-3xl p-5">
          <CardTitle>Redirecting</CardTitle>
          <CardValue>Password Reset</CardValue>
          <p className="mt-1 text-sm text-zinc-500">
            Redirecting to the password reset page...
          </p>
          <Link
            href="/reset-password"
            className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            Continue manually
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <Card className="w-full rounded-3xl p-5">
        <CardTitle>Secure Access</CardTitle>
        <CardValue>Foundation Login</CardValue>
        <p className="mt-1 text-sm text-zinc-500">Sign in with your email and password.</p>

        <form className="mt-4 space-y-3" onSubmit={submitLogin} aria-busy={loading}>
          <label className="block text-sm font-medium">
            Email
            <input
              className="field-control mt-1 w-full rounded-xl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="field-control mt-1 w-full rounded-xl"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              autoComplete="current-password"
            />
          </label>
          <div className="flex justify-end">
            <Link
              href={forgotPasswordHref}
              className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Forgot password?
            </Link>
          </div>
          <button
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={loading || !configured}
          >
            {!configured ? "Set Supabase env vars" : loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        ) : null}
        {showForgotPassword ? (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Need help signing in?{" "}
            <Link href={forgotPasswordHref} className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300">
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
      </Card>
    </div>
  );
}

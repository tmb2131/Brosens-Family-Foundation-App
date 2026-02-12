"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Route } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";

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
  return "/mobile";
}

function friendlyLoginError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to sign in right now. Please try again.";
  }

  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (message.includes("too many requests")) {
    return "Too many sign-in attempts. Please wait and try again.";
  }
  if (message.includes("failed to fetch")) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  return "Unable to sign in right now. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const recoveryMode = params.get("mode") === "recovery";
  const redirect = params.get("redirect") || "/mobile";
  const safeRedirect = sanitizeRedirect(redirect);
  const { signIn, refreshProfile, updatePassword, user, configured } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !recoveryMode) {
      router.replace(safeRedirect);
    }
  }, [router, safeRedirect, user, recoveryMode]);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await signIn(email.trim(), password);
      await refreshProfile();
      router.replace(safeRedirect);
    } catch (err) {
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      await updatePassword(newPassword);
      setSuccess("Password updated. Redirecting to your mobile focus view...");
      router.replace("/mobile");
    } catch {
      setError("Unable to update password right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <Card className="w-full rounded-3xl p-5">
        <CardTitle>Secure Access</CardTitle>
        <CardValue>{recoveryMode ? "Reset Password" : "Foundation Login"}</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          {recoveryMode
            ? "Use this page from your reset email link to set a new password."
            : "Sign in with your email and password."}
        </p>

        {recoveryMode ? (
          <form className="mt-4 space-y-3" onSubmit={submitPasswordUpdate} aria-busy={loading}>
            <label className="block text-sm font-medium">
              New password
              <input
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <input
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button
              className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              type="submit"
              disabled={loading || !configured || !user}
            >
              {!configured
                ? "Set Supabase env vars"
                : !user
                  ? "Open reset email link"
                  : loading
                    ? "Updating..."
                    : "Update password"}
            </button>
          </form>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitLogin} aria-busy={loading}>
            <label className="block text-sm font-medium">
              Email
              <input
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
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
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                autoComplete="current-password"
              />
            </label>
            <button
              className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              type="submit"
              disabled={loading || !configured}
            >
              {!configured ? "Set Supabase env vars" : loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        ) : null}
        {recoveryMode && configured && !user ? (
          <p className="mt-3 text-xs text-zinc-500">
            Open this page using the link in your password reset email to complete the update.
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300" aria-live="polite">
            {success}
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

"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Route } from "next";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";

const allowedRedirects = [
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

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const recoveryMode = params.get("mode") === "recovery";
  const redirect = params.get("redirect") || "/dashboard";
  const safeRedirect = sanitizeRedirect(redirect);
  const { signIn, refreshProfile, updatePassword, user, configured } = useAuth();

  const [email, setEmail] = useState("tom@brosens.foundation");
  const [password, setPassword] = useState("password");
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
      await signIn(email, password);
      await refreshProfile();
      router.replace(safeRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
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
      setSuccess("Password updated. Redirecting to dashboard...");
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
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
            : "Sign in with Supabase Auth email/password. Profiles are loaded from `user_profiles`."}
        </p>

        {recoveryMode ? (
          <form className="mt-4 space-y-3" onSubmit={submitPasswordUpdate}>
            <label className="block text-sm font-medium">
              New password
              <input
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
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
          <form className="mt-4 space-y-3" onSubmit={submitLogin}>
            <label className="block text-sm font-medium">
              Email
              <input
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-sm dark:bg-zinc-900/40"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
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
        {success ? <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{success}</p> : null}
        {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
      </Card>
    </div>
  );
}

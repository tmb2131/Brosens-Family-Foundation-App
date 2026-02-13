"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";

function friendlyResetRequestError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to send reset email right now. Please try again.";
  }

  const message = error.message.toLowerCase();
  if (message.includes("failed to fetch")) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "Too many reset attempts. Please wait a moment and try again.";
  }

  return "Unable to send reset email right now. Please try again.";
}

export default function ForgotPasswordClient() {
  const params = useSearchParams();
  const initialEmail = useMemo(() => params.get("email")?.trim() ?? "", [params]);
  const { sendPasswordReset, configured } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialEmail) {
      return;
    }

    setEmail((currentEmail) => (currentEmail ? currentEmail : initialEmail));
  }, [initialEmail]);

  const submitResetRequest = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordReset(email.trim());
      setSuccess("If an account exists for this email, a password reset link has been sent.");
    } catch (err) {
      setError(friendlyResetRequestError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <Card className="w-full rounded-3xl p-5">
        <CardTitle>Secure Access</CardTitle>
        <CardValue>Forgot Password</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email address and we will send a secure reset link.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitResetRequest} aria-busy={loading}>
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
          <button
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
            disabled={loading || !configured}
          >
            {!configured ? "Set Supabase env vars" : loading ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300">
            Back to sign in
          </Link>
          .
        </p>

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
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

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="page-enter mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <GlassCard className="w-full rounded-3xl p-5">
        <CardLabel>Secure Access</CardLabel>
        <CardValue>Forgot Password</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email address and we will send a secure reset link.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitResetRequest} aria-busy={loading}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              className="rounded-xl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
            />
          </div>
          <Button
            size="lg"
            className="w-full"
            type="submit"
            disabled={loading || !configured}
          >
            {!configured ? "Set Supabase env vars" : loading ? "Sending reset link..." : "Send reset link"}
          </Button>
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
      </GlassCard>
    </div>
  );
}

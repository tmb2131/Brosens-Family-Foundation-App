"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";

const minimumPasswordLength = 12;

function friendlyPasswordUpdateError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to update password right now. Please try again.";
  }

  const message = error.message.toLowerCase();
  if (message.includes("same password")) {
    return "Use a different password than your current one.";
  }
  if (message.includes("password")) {
    return "Your new password does not meet requirements. Use at least 12 characters.";
  }

  return "Unable to update password right now. Please try again.";
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const { configured, loading: authLoading, user, updatePassword, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitPasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < minimumPasswordLength) {
      setError(`New password must be at least ${minimumPasswordLength} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      try {
        await signOut();
      } catch {
        // If sign-out fails we still route to login, requiring explicit sign-in with new credentials.
      }
      router.replace("/login?reset=success");
    } catch (err) {
      setError(friendlyPasswordUpdateError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-enter mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <GlassCard className="w-full rounded-3xl p-5">
        <CardLabel>Secure Access</CardLabel>
        <CardValue>Reset Password</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Set a new password for your account.
        </p>

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        ) : null}

        {authLoading ? (
          <p className="mt-3 text-sm text-zinc-500">Validating your reset link...</p>
        ) : null}

        {!authLoading && configured && !user ? (
          <>
            <p className="mt-3 text-sm text-zinc-500">
              Open this page using the secure link from your reset email.
            </p>
            <Link
              href="/forgot-password"
              className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Request a new reset email
            </Link>
          </>
        ) : null}

        {!authLoading && configured && user ? (
          <form className="mt-4 space-y-3" onSubmit={submitPasswordUpdate} aria-busy={submitting}>
            <label className="block text-sm font-medium">
              New password
              <input
                className="field-control mt-1 w-full rounded-xl"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                minLength={minimumPasswordLength}
                autoComplete="new-password"
              />
            </label>
            <label className="block text-sm font-medium">
              Confirm new password
              <input
                className="field-control mt-1 w-full rounded-xl"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                minLength={minimumPasswordLength}
                autoComplete="new-password"
              />
            </label>
            <p className="text-xs text-zinc-500">Use at least {minimumPasswordLength} characters.</p>
            <Button
              size="lg"
              className="w-full"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Updating password..." : "Update password"}
            </Button>
          </form>
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

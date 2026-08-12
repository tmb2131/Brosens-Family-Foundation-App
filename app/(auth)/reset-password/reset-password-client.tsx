"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const minimumPasswordLength = 12;

function friendlyPasswordUpdateError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to update password right now. Please try again.";
  }

  const message = error.message.toLowerCase();
  // Supabase phrases reuse as "New password should be different from the old
  // password." — match on that before the broader password check below, which
  // would otherwise blame the password's length.
  if (message.includes("same password") || message.includes("different from the old")) {
    return "Use a different password than your current one.";
  }
  if (
    message.includes("auth session missing") ||
    message.includes("session_not_found") ||
    message.includes("jwt expired")
  ) {
    return "Your reset link has expired. Request a new reset email and try again.";
  }
  if (message.includes("failed to fetch")) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  if (message.includes("password")) {
    return `Your new password does not meet requirements. Use at least ${minimumPasswordLength} characters.`;
  }

  return "Unable to update password right now. Please try again.";
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackError = params.get("error");
  const hasInvalidOrExpiredLink = callbackError === "expired_or_invalid";
  const wasOpenedInAnotherBrowser = callbackError === "other_browser";
  const { configured, loading: authLoading, session, updatePassword, signOut } = useAuth();
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
        <p className="mt-1 text-sm text-muted-foreground">
          Set a new password for your account.
        </p>

        {!configured ? (
          <p className="mt-3 text-xs text-rose-600">
            Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </p>
        ) : null}

        {authLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Validating your reset link...</p>
        ) : null}

        {!authLoading && configured && !session ? (
          <>
            {wasOpenedInAnotherBrowser ? (
              <p className="mt-3 text-sm text-rose-600">
                This reset link has to be opened in the same browser you requested it from. Request a
                new reset email here and open it on this device.
              </p>
            ) : hasInvalidOrExpiredLink ? (
              <p className="mt-3 text-sm text-rose-600">
                This reset link is invalid or expired. Request a new reset email to continue.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Open this page using the secure link from your reset email.
              </p>
            )}
            <Link
              href="/forgot-password"
              className="mt-3 inline-flex text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              Request a new reset email
            </Link>
          </>
        ) : null}

        {!authLoading && configured && session ? (
          <form className="mt-4 space-y-3" onSubmit={submitPasswordUpdate} aria-busy={submitting}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                className="rounded-xl"
                value={newPassword}
                onChange={setNewPassword}
                required
                minLength={minimumPasswordLength}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                className="rounded-xl"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                minLength={minimumPasswordLength}
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">Use at least {minimumPasswordLength} characters.</p>
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

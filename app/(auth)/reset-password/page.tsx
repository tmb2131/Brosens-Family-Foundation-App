import { Suspense } from "react";
import ResetPasswordClient from "@/app/(auth)/reset-password/reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
          Loading reset password...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}

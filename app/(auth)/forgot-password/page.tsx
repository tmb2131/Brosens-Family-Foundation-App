import { Suspense } from "react";
import ForgotPasswordClient from "@/app/(auth)/forgot-password/forgot-password-client";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-zinc-500">Loading forgot password...</div>}>
      <ForgotPasswordClient />
    </Suspense>
  );
}

import { Suspense } from "react";
import LoginClient from "@/app/(auth)/login/login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-zinc-500">Loading login...</div>}>
      <LoginClient />
    </Suspense>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth-server";
import { shouldUseMobileHome } from "@/lib/device-detection";
import type { AppRole } from "@/lib/types";

export default async function HomePage() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");

  const isMobile = shouldUseMobileHome({
    userAgent,
    clientHintMobile
  });

  // `redirect()` works by throwing, so it must not be called inside the try:
  // the catch would swallow it and send admins and managers to the default page.
  let role: AppRole | null = null;
  try {
    const { profile } = await requireAuthContext();
    role = profile.role;
  } catch {
    // Not authenticated — continue to default redirect
  }

  if (role === "admin") {
    redirect("/admin");
  }
  if (role === "manager") {
    redirect("/frank-deenie");
  }

  if (!isMobile) {
    redirect("/dashboard");
  }

  redirect("/mobile");
}

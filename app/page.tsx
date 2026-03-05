import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth-server";
import { shouldUseMobileHome } from "@/lib/device-detection";

export default async function HomePage() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");

  const isMobile = shouldUseMobileHome({
    userAgent,
    clientHintMobile
  });

  try {
    const { profile } = await requireAuthContext();
    if (profile.role === "admin") {
      redirect("/admin");
    }
    if (profile.role === "manager") {
      redirect("/frank-deenie");
    }
  } catch {
    // Not authenticated — continue to default redirect
  }

  if (!isMobile) {
    redirect("/dashboard");
  }

  redirect("/mobile");
}

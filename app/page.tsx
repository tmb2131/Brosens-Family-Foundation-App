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

  if (!isMobile) {
    redirect("/dashboard");
  }

  try {
    const { profile } = await requireAuthContext();
    if (profile.role === "admin") {
      redirect("/admin");
    }
  } catch {
    // Not authenticated or error — send to mobile; Guard will redirect to login if needed.
  }

  redirect("/mobile");
}

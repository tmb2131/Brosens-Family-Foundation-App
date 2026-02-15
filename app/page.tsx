import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shouldUseMobileHome } from "@/lib/device-detection";

export default async function HomePage() {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");

  redirect(
    shouldUseMobileHome({
      userAgent,
      clientHintMobile
    })
      ? "/mobile"
      : "/dashboard"
  );
}

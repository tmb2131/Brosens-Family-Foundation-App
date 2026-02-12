import { headers } from "next/headers";
import { redirect } from "next/navigation";

function isMobileUserAgent(userAgent: string) {
  return /Android|iPhone|iPad|iPod|Mobile|BlackBerry|Opera Mini|IEMobile/i.test(userAgent);
}

export default async function HomePage() {
  const userAgent = (await headers()).get("user-agent") ?? "";
  redirect(isMobileUserAgent(userAgent) ? "/mobile" : "/dashboard");
}

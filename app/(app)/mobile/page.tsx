import { Suspense } from "react";
import { redirect } from "next/navigation";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requireAuthContext } from "@/lib/auth-server";

export default async function MobilePage() {
  try {
    const { profile } = await requireAuthContext();
    if (profile.role === "admin") {
      redirect("/admin");
    }
  } catch {
    // Not authenticated — Guard will redirect to login.
  }

  return (
    <Suspense
      fallback={
        <div className="page-stack pb-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <MobileFocusClient />
    </Suspense>
  );
}

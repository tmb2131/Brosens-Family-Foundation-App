import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth, assertRole } from "@/lib/auth-server";
import { getAdminQueue } from "@/lib/foundation-data";
import AdminClient from "./admin-client";

function AdminPageFallback() {
  return (
    <div className="page-stack pb-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default async function AdminPage() {
  const { profile, admin } = await requirePageAuth();
  assertRole(profile, ["admin"]);

  const { proposals } = await getAdminQueue(admin, profile.id);

  return (
    <Suspense fallback={<AdminPageFallback />}>
      <AdminClient profile={profile} initialQueue={{ proposals }} />
    </Suspense>
  );
}

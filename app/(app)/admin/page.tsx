import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth, assertRole } from "@/lib/auth-server";
import { getAdminQueue } from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
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
  const perf = startPagePerf("/admin");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  assertRole(profile, ["admin"]);

  const { proposals } = await getAdminQueue(admin, profile.id);
  perf.step("getAdminQueue");
  perf.done();

  return (
    <Suspense fallback={<AdminPageFallback />}>
      <AdminClient profile={profile} initialQueue={{ proposals }} />
    </Suspense>
  );
}

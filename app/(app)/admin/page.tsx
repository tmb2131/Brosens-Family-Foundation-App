import { requirePageAuth, assertRole } from "@/lib/auth-server";
import { getAdminQueue } from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const perf = startPagePerf("/admin");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  assertRole(profile, ["admin"]);

  const { proposals } = await getAdminQueue(admin, profile.id);
  perf.step("getAdminQueue");
  perf.done();

  return <AdminClient profile={profile} initialQueue={{ proposals }} />;
}

import { requirePageAuth } from "@/lib/auth-server";
import { getFrankDeenieSnapshot } from "@/lib/frank-deenie-data";
import { startPagePerf } from "@/lib/perf-logger";
import FrankDeenieClient from "./frank-deenie-client";

export default async function FrankDeeniePage() {
  const perf = startPagePerf("/frank-deenie");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const snapshot = await getFrankDeenieSnapshot(admin);
  perf.step("getFrankDeenieSnapshot");
  perf.done();

  return (
    <FrankDeenieClient
      profile={profile}
      initialSnapshot={snapshot}
    />
  );
}

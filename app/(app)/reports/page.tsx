import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData
} from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const perf = startPagePerf("/reports");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  perf.step("buildSnapshot");
  perf.done();

  return <ReportsClient initialFoundation={foundation} />;
}

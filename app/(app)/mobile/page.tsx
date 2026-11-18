import type { Route } from "next";
import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildFoundationSnapshotFromData,
  buildWorkspaceSnapshotFromData
} from "@/lib/foundation-data";
import { startPagePerf } from "@/lib/perf-logger";
import MobileFocusClient from "@/app/(app)/mobile/mobile-client";

interface MobilePageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function MobilePage({ searchParams }: MobilePageProps) {
  const perf = startPagePerf("/mobile");

  const [{ profile, admin }, params] = await Promise.all([requirePageAuth(), searchParams]);
  perf.step("auth");

  // Email links on a phone arrive as /mobile?next=<target>. The admin has no
  // mobile home, so send them straight to the target (or their queue).
  if (profile.role === "admin") {
    const next = typeof params.next === "string" ? params.next.trim() : "";
    const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
    redirect((safeNext ?? "/admin") as Route);
  }

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const foundation = buildFoundationSnapshotFromData(pageData, profile.id);
  const workspace = buildWorkspaceSnapshotFromData(pageData, profile, foundation);
  perf.step("buildSnapshots");
  perf.done();

  return <MobileFocusClient initialWorkspace={workspace} />;
}

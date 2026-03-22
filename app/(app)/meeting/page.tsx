import { Suspense } from "react";
import { GlassCard } from "@/components/ui/card";
import { requirePageAuth, assertRole } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildMeetingProposalsFromData
} from "@/lib/foundation-data";
import { FoundationSnapshot } from "@/lib/types";
import { startPagePerf } from "@/lib/perf-logger";
import MeetingClient from "./meeting-client";
import { PageWithSidebar } from "@/components/ui/page-with-sidebar";

function MeetingFallback() {
  return (
    <div className="page-stack pb-4">
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <div className="h-5 w-20 bg-muted rounded animate-pulse" />
            <div className="mt-1 h-7 w-32 bg-muted rounded animate-pulse" />
            <div className="mt-2 h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-11 w-24 bg-muted rounded-lg animate-pulse" />
        </div>
      </GlassCard>
      <PageWithSidebar
        sticky
        sidebar={
          <div className="grid gap-3">
            <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
            <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
          </div>
        }
      >
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </PageWithSidebar>
    </div>
  );
}

export default async function MeetingPage() {
  const perf = startPagePerf("/meeting");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  assertRole(profile, ["oversight", "manager"]);

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const proposals = buildMeetingProposalsFromData(pageData, profile.id);
  perf.step("buildMeetingProposals");
  perf.done();

  return (
    <Suspense fallback={<MeetingFallback />}>
      <MeetingClient profile={profile} initialMeeting={{ proposals: proposals as FoundationSnapshot["proposals"] }} />
    </Suspense>
  );
}

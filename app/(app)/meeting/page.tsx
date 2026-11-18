import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth-server";
import {
  fetchFoundationPageData,
  buildMeetingProposalsFromData
} from "@/lib/foundation-data";
import { FoundationSnapshot } from "@/lib/types";
import { startPagePerf } from "@/lib/perf-logger";
import MeetingClient from "./meeting-client";

export default async function MeetingPage() {
  const perf = startPagePerf("/meeting");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  // Someone following a link meant for another role lands on the dashboard
  // instead of an error page.
  if (!["oversight", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const pageData = await fetchFoundationPageData(admin, { userId: profile.id });
  perf.step("fetchFoundationPageData");

  const proposals = buildMeetingProposalsFromData(pageData, profile.id);
  perf.step("buildMeetingProposals");
  perf.done();

  return (
    <MeetingClient profile={profile} initialMeeting={{ proposals: proposals as FoundationSnapshot["proposals"] }} />
  );
}

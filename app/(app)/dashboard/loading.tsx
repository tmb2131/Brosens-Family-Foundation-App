import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="page-stack pb-4">
      <GlassCard className="rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardLabel>Annual Cycle</CardLabel>
            <CardValue>Loading dashboard...</CardValue>
            <p className="mt-1 text-sm text-zinc-500">
              Fetching current-year totals and proposal statuses.
            </p>
          </div>
          <Button variant="proposal" asChild className="sm:min-h-11 sm:px-4 sm:text-sm">
            <Link href="/proposals/new">
              <Plus className="h-4 w-4" /> New Proposal
            </Link>
          </Button>
        </div>
      </GlassCard>
      <p className="text-sm text-zinc-500">Loading foundation dashboard...</p>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";

export default function ProposalNotFound() {
  return (
    <div className="page-stack pb-4">
      <GlassCard className="rounded-3xl p-6">
        <h1 className="text-xl font-bold">Proposal not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link points to a proposal that doesn’t exist, or that has since been removed. Check
          with whoever shared it, or find it from your workspace.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/workspace">Go to My Workspace</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

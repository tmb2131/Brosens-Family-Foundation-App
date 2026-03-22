import { GlassCard } from "@/components/ui/card";

export default function MeetingLoading() {
  return (
    <div className="page-stack pb-4">
      {/* Header skeleton */}
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

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-6">
          {/* Mobile stats skeleton */}
          <GlassCard className="p-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
            </div>
          </GlassCard>

          {/* Proposals section skeleton */}
          <GlassCard className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted rounded-lg animate-pulse" />
                <div>
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="mt-1 h-3 w-40 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
            </div>

            {/* Tabs skeleton */}
            <div className="h-10 bg-muted/50 rounded-lg p-1 mb-3">
              <div className="flex gap-1">
                <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-8 flex-1 bg-muted rounded animate-pulse" />
              </div>
            </div>

            {/* Proposal card skeletons */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-t-2 border-t-muted bg-background p-4">
                  <div className="flex justify-between gap-3 mb-3">
                    <div className="h-5 flex-1 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                  </div>
                  <div className="flex justify-between gap-3 mb-3">
                    <div className="flex gap-2">
                      <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
                      <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                    <div className="text-right">
                      <div className="h-6 w-20 bg-muted rounded animate-pulse ml-auto" />
                      <div className="h-3 w-16 bg-muted rounded animate-pulse ml-auto mt-1" />
                    </div>
                  </div>
                  <div className="h-9 w-full bg-muted rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Desktop metrics skeleton */}
        <div className="hidden lg:block">
          <div className="lg:sticky lg:top-6">
            <div className="grid gap-3">
              <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
              <div className="h-20 bg-muted rounded-xl border-l-[3px] border-l-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

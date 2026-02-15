import { Suspense } from "react";
import DashboardClient from "@/app/(app)/dashboard/dashboard-client";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading foundation dashboard...</p>}
    >
      <DashboardClient />
    </Suspense>
  );
}

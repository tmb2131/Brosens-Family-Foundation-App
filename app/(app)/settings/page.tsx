import { Suspense } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { requirePageAuth } from "@/lib/auth-server";
import { getBudgetSnapshot } from "@/lib/foundation-data";
import { listOrganizationsWithDirectionalCategory } from "@/lib/organization-categorization";
import SettingsClient from "./settings-client";

function SettingsFallback() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export default async function SettingsPage() {
  const { profile, admin } = await requirePageAuth();

  const canManageBudget = ["oversight", "manager"].includes(profile.role);
  const canManageOrgCategories = profile.role === "oversight";

  const [budget, orgCategories] = await Promise.all([
    canManageBudget ? getBudgetSnapshot(admin).then((b) => ({ budget: b })) : Promise.resolve(null),
    canManageOrgCategories
      ? listOrganizationsWithDirectionalCategory(admin).then((o) => ({ organizations: o }))
      : Promise.resolve(null)
  ]);

  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsClient
        profile={profile}
        initialBudget={budget}
        initialOrgCategories={orgCategories}
      />
    </Suspense>
  );
}

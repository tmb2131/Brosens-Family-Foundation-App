import { requirePageAuth } from "@/lib/auth-server";
import { getBudgetSnapshot } from "@/lib/foundation-data";
import { listOrganizationsWithDirectionalCategory } from "@/lib/organization-categorization";
import { startPagePerf } from "@/lib/perf-logger";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const perf = startPagePerf("/settings");

  const { profile, admin } = await requirePageAuth();
  perf.step("auth");

  const canManageBudget = ["oversight", "manager"].includes(profile.role);
  const canManageOrgCategories = profile.role === "oversight";

  const [budget, orgCategories] = await Promise.all([
    canManageBudget ? getBudgetSnapshot(admin).then((b) => ({ budget: b })) : Promise.resolve(null),
    canManageOrgCategories
      ? listOrganizationsWithDirectionalCategory(admin).then((o) => ({ organizations: o }))
      : Promise.resolve(null)
  ]);
  perf.step("fetchSettingsData");
  perf.done();

  return (
    <SettingsClient
      profile={profile}
      initialBudget={budget}
      initialOrgCategories={orgCategories}
    />
  );
}

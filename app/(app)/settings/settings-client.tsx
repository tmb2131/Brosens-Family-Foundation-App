"use client";

import { FormEvent, useState, useEffect, useMemo, useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { DollarSign, Users, Wallet, KeyRound, Bell, FileUp, Cog, Mail, Star, Tags, PieChart } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PushSettingsCard } from "@/components/notifications/push-settings-card";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { AmountInput } from "@/components/ui/amount-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { Progress } from "@/components/ui/progress";
import {
  AppRole,
  DirectionalCategory,
  DIRECTIONAL_CATEGORIES,
  DIRECTIONAL_CATEGORY_LABELS,
  UserProfile
} from "@/lib/types";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { cn, currency, formatNumber, parseNumberInput } from "@/lib/utils";

interface BudgetResponse {
  budget: {
    year: number;
    total: number;
    jointPool: number;
    discretionaryPool: number;
    jointAllocated: number;
    discretionaryAllocated: number;
    jointRemaining: number;
    discretionaryRemaining: number;
    rolloverFromPreviousYear: number;
  };
}

interface OrganizationCategoryRow {
  id: string;
  name: string;
  directionalCategory: DirectionalCategory;
  directionalCategorySource: string;
  directionalCategoryConfidence: number | null;
  directionalCategoryLocked: boolean;
  directionalCategoryUpdatedAt: string | null;
}

interface OrganizationCategoriesResponse {
  organizations: OrganizationCategoryRow[];
}

interface OrganizationCategoryProcessResponse {
  processed: number;
  categorized: number;
  skippedLocked: number;
  failed: number;
  pendingRetries: number;
}

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[] | "all";
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "password", label: "Password", icon: KeyRound, roles: "all" },
  { id: "notifications", label: "Notifications", icon: Bell, roles: "all" },
  { id: "csv-import", label: "CSV Import", icon: FileUp, roles: ["oversight"] },
  { id: "category-worker", label: "Category Worker", icon: Cog, roles: ["oversight"] },
  { id: "email-worker", label: "Email Worker", icon: Mail, roles: ["oversight"] },
  { id: "charity-nav", label: "Charity Navigator", icon: Star, roles: ["oversight"] },
  { id: "category-overrides", label: "Category Overrides", icon: Tags, roles: ["oversight"] },
  { id: "budget", label: "Budget", icon: DollarSign, roles: ["oversight", "manager"] },
  { id: "budget-snapshot", label: "Budget Snapshot", icon: PieChart, roles: ["oversight", "manager"] },
  { id: "budget-info", label: "Budget", icon: DollarSign, roles: ["member", "admin"] },
];

interface SettingsClientProps {
  profile: UserProfile;
  initialBudget: BudgetResponse | null;
  initialOrgCategories: OrganizationCategoriesResponse | null;
}

export default function SettingsClient({ profile, initialBudget, initialOrgCategories }: SettingsClientProps) {
  const { changePassword } = useAuth();
  const canManageBudget = ["oversight", "manager"].includes(profile.role);
  const canManageOrganizationCategories = profile.role === "oversight";
  const { data, mutate, isLoading, error } = useSWR<BudgetResponse>(canManageBudget ? "/api/budgets" : null, {
    fallbackData: initialBudget ?? undefined
  });
  const organizationCategoriesQuery = useSWR<OrganizationCategoriesResponse>(
    canManageOrganizationCategories ? "/api/organizations/categories" : null,
    { fallbackData: initialOrgCategories ?? undefined }
  );

  const [year, setYear] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [rollover, setRollover] = useState("");
  const [jointRatio, setJointRatio] = useState("0.75");
  const [discretionaryRatio, setDiscretionaryRatio] = useState("0.25");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [historicalCsvFile, setHistoricalCsvFile] = useState<File | null>(null);
  const [historicalImporting, setHistoricalImporting] = useState(false);
  const [historicalImportInputKey, setHistoricalImportInputKey] = useState(0);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DirectionalCategory>("other");
  const [selectedCategoryLocked, setSelectedCategoryLocked] = useState(false);
  const [savingCategoryOverride, setSavingCategoryOverride] = useState(false);
  const [runningCategoryWorker, setRunningCategoryWorker] = useState(false);
  const [runningEmailWorker, setRunningEmailWorker] = useState(false);
  const [runningCharityNavigatorScores, setRunningCharityNavigatorScores] = useState(false);
  const parsedTotalAmount = parseNumberInput(totalAmount);
  const parsedRollover = parseNumberInput(rollover);
  const parsedJointRatio = parseNumberInput(jointRatio);
  const parsedDiscretionaryRatio = parseNumberInput(discretionaryRatio);
  const projectedTotalBudget =
    parsedTotalAmount !== null && parsedRollover !== null ? parsedTotalAmount + parsedRollover : null;
  const totalAllocated = data
    ? data.budget.jointAllocated + data.budget.discretionaryAllocated
    : 0;
  const jointUtilization = data && data.budget.jointPool > 0
    ? (data.budget.jointAllocated / data.budget.jointPool) * 100
    : 0;
  const discretionaryUtilization = data && data.budget.discretionaryPool > 0
    ? (data.budget.discretionaryAllocated / data.budget.discretionaryPool) * 100
    : 0;
  const totalUtilization = data && data.budget.total > 0
    ? (totalAllocated / data.budget.total) * 100
    : 0;

  useEffect(() => {
    if (!data?.budget) {
      return;
    }

    setYear(String(data.budget.year));
    setTotalAmount(String(data.budget.total - data.budget.rolloverFromPreviousYear));
    setRollover(String(data.budget.rolloverFromPreviousYear));
  }, [data]);

  useEffect(() => {
    const organizations = organizationCategoriesQuery.data?.organizations ?? [];
    if (!organizations.length) {
      setSelectedOrganizationId("");
      setSelectedCategory("other");
      setSelectedCategoryLocked(false);
      return;
    }

    const selectedOrganization =
      organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0];

    if (selectedOrganizationId !== selectedOrganization.id) {
      setSelectedOrganizationId(selectedOrganization.id);
    }

    setSelectedCategory(selectedOrganization.directionalCategory);
    setSelectedCategoryLocked(selectedOrganization.directionalCategoryLocked);
  }, [organizationCategoriesQuery.data?.organizations, selectedOrganizationId]);

  const visibleSections = useMemo(
    () =>
      SETTINGS_SECTIONS.filter(
        (s) => s.roles === "all" || s.roles.includes(profile.role)
      ),
    [profile.role]
  );

  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    if (!activeSection && visibleSections.length) {
      setActiveSection(visibleSections[0].id);
    }
  }, [activeSection, visibleSections]);

  const hasBudgetData = Boolean(data);
  const desktopHidden = (sectionId: string) =>
    activeSection && activeSection !== sectionId ? "lg:hidden" : "";

  useEffect(() => {
    const sectionIds = visibleSections.map((s) => s.id);
    const elements = sectionIds
      .map((id) => document.getElementById(`settings-${id}`))
      .filter((el): el is HTMLElement => el !== null);

    if (!elements.length) return;

    const visibleSet = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = entry.target.id.replace("settings-", "");
          if (entry.isIntersecting) {
            visibleSet.add(sectionId);
          } else {
            visibleSet.delete(sectionId);
          }
        }
        const first = sectionIds.find((id) => visibleSet.has(id));
        if (first) {
          setActiveSection(first);
        }
      },
      { rootMargin: "-5% 0px -65% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleSections, hasBudgetData]);

  useEffect(() => {
    if (!activeSection) return;
    const pill = document.querySelector<HTMLElement>(
      `[data-settings-pill="${activeSection}"]`
    );
    pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeSection]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(`settings-${sectionId}`);
    if (!el) return;

    const collapsed = el.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    if (collapsed) collapsed.click();

    setTimeout(
      () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
      collapsed ? 50 : 0
    );
    setActiveSection(sectionId);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          year: Number(year),
          totalAmount: Number(totalAmount),
          rolloverFromPreviousYear: Number(rollover),
          jointRatio: Number(jointRatio),
          discretionaryRatio: Number(discretionaryRatio)
        })
      });

      if (response.ok) {
        void mutate();
        toast.success("Budget saved.");
      } else {
        const payload = await response.json().catch(() => ({ error: "Failed to save budget" }));
        toast.error(payload.error || "Failed to save budget");
      }
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 12) {
      toast.error("New password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      const friendly =
        msg.toLowerCase().includes("invalid login") || msg.toLowerCase().includes("invalid credentials")
          ? "Current password is incorrect."
          : msg.toLowerCase().includes("same password")
            ? "Use a different password than your current one."
            : msg.toLowerCase().includes("password")
              ? "Your new password does not meet requirements. Use at least 12 characters."
              : msg;
      toast.error(friendly);
    } finally {
      setChangingPassword(false);
    }
  };

  const importHistoricalCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!historicalCsvFile) {
      toast.error("Select a CSV file before importing.");
      return;
    }

    setHistoricalImporting(true);

    try {
      const csvText = await historicalCsvFile.text();
      const response = await fetch("/api/settings/historical-proposals/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to import historical proposals."));
      }

      const importedCount = Number(payload.importedCount ?? 0);
      const skippedCount = Number(payload.skippedCount ?? 0);

      toast.success(
        `Imported ${formatNumber(importedCount)} historical proposals${
          skippedCount > 0 ? `, skipped ${formatNumber(skippedCount)} duplicates` : ""
        }.`
      );
      setHistoricalCsvFile(null);
      setHistoricalImportInputKey((current) => current + 1);
      void globalMutate("/api/foundation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import historical proposals.");
    } finally {
      setHistoricalImporting(false);
    }
  };

  const saveCategoryOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedOrganizationId) {
      toast.error("Select an organization before saving.");
      return;
    }

    setSavingCategoryOverride(true);

    try {
      const response = await fetch(`/api/organizations/${selectedOrganizationId}/category`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          lock: selectedCategoryLocked
        })
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to save category override."));
      }

      await organizationCategoriesQuery.mutate();
      toast.success("Organization category override saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category override.");
    } finally {
      setSavingCategoryOverride(false);
    }
  };

  const runCategoryWorker = async () => {
    setRunningCategoryWorker(true);

    try {
      const response = await fetch("/api/organizations/categories/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 100 })
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<
        OrganizationCategoryProcessResponse & { error: string }
      >;

      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to run organization categorization worker."));
      }

      const processed = Number(payload.processed ?? 0);
      const categorized = Number(payload.categorized ?? 0);
      const skippedLocked = Number(payload.skippedLocked ?? 0);
      const failed = Number(payload.failed ?? 0);
      const pendingRetries = Number(payload.pendingRetries ?? 0);

      toast.success(
        `Worker completed: processed ${formatNumber(processed)}, categorized ${formatNumber(
          categorized
        )}, skipped locked ${formatNumber(skippedLocked)}, failed ${formatNumber(
          failed
        )}, pending retries ${formatNumber(pendingRetries)}.`
      );

      await organizationCategoriesQuery.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run organization categorization worker.");
    } finally {
      setRunningCategoryWorker(false);
    }
  };

  const runEmailWorker = async () => {
    setRunningEmailWorker(true);

    try {
      const response = await fetch("/api/notifications/email/reminders", {
        method: "POST"
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to run email worker."));
      }

      if (payload.disabled === true && typeof payload.message === "string") {
        toast.success(payload.message);
        return;
      }

      const weekly = payload.weeklyUpdate as Record<string, number> | undefined;
      const digest = payload.dailySentDigest as Record<string, number> | undefined;
      const parts: string[] = [];

      if (weekly) {
        parts.push(`Weekly: ${weekly.remindersQueued ?? 0} queued`);
      }
      if (digest) {
        const dq = digest.digestQueued ?? 0;
        if (dq > 0) {
          parts.push(`Digest: ${dq} queued`);
        } else {
          const reason =
            digest.skippedWrongLocalTime ? "before 10am ET" :
            digest.skippedNoEvents ? "no proposals marked sent today" :
            digest.skippedAlreadySent ? "already sent today" :
            "no digest sent";
          parts.push(`Digest: 0 (${reason})`);
        }
      }

      const delivery = payload.deliveryResult as Record<string, number | boolean> | undefined;
      if (delivery?.configMissing === true) {
        parts.push(
          "No emails sent: Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM in your env (e.g. .env.test.local)."
        );
      } else if (delivery && typeof delivery.sent === "number" && delivery.sent > 0) {
        parts.push(`${delivery.sent} email(s) sent`);
        if (typeof delivery.failed === "number" && delivery.failed > 0) {
          parts.push(`${delivery.failed} failed`);
        }
      } else if (delivery && typeof delivery.failed === "number" && delivery.failed > 0) {
        parts.push(`${delivery.failed} delivery failed`);
      }

      toast.success(parts.length ? parts.join(". ") + "." : "Email worker completed — nothing to send.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run email worker.");
    } finally {
      setRunningEmailWorker(false);
    }
  };

  const runCharityNavigatorScores = async () => {
    setRunningCharityNavigatorScores(true);

    try {
      const response = await fetch("/api/settings/charity-navigator-scores", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        updated?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(String(payload.error ?? "Failed to fetch Charity Navigator scores."));
      }

      const updated = Number(payload.updated ?? 0);
      const skipped = Number(payload.skipped ?? 0);
      const failed = Number(payload.failed ?? 0);
      toast.success(
        `Done. Updated ${formatNumber(updated)}, skipped ${formatNumber(skipped)}, failed ${formatNumber(failed)}.`
      );
      void globalMutate("/api/foundation");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch Charity Navigator scores.");
    } finally {
      setRunningCharityNavigatorScores(false);
    }
  };

  const selectedOrganization = (organizationCategoriesQuery.data?.organizations ?? []).find(
    (organization) => organization.id === selectedOrganizationId
  );

  const scrollMargin = "scroll-mt-14 lg:scroll-mt-4";

  return (
    <div className="pb-4">
      <GlassCard className="rounded-3xl">
        <CardLabel>{canManageBudget ? "Process Oversight Controls" : "Account Settings"}</CardLabel>
        <CardValue>{canManageBudget ? "Budget & Annual Cycle" : "Password & Security"}</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {canManageBudget
            ? "February 1 reset is enforced by setting the yearly budget record; unused funds roll back after Dec 31."
            : "Change your password below."}
        </p>
      </GlassCard>

      <nav className="sticky top-0 z-10 mt-4 rounded-xl bg-card/90 p-1.5 shadow-sm ring-1 ring-border/50 backdrop-blur-md lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                data-settings-pill={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  activeSection === section.id
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-6">
        <nav className="hidden lg:block lg:self-stretch" aria-label="Settings sections">
          <div className="sticky top-4 space-y-0.5">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    activeSection === section.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="page-stack">
      <CollapsibleSection id="settings-password" title="Change Password" defaultOpen={false} className={cn(scrollMargin, desktopHidden("password"))}>
        <p className="text-sm text-muted-foreground">Update your sign-in password. You must enter your current password to confirm.</p>
        <form className="mt-3 space-y-3" onSubmit={handleChangePassword} aria-busy={changingPassword}>
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              className="rounded-xl"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              className="rounded-xl"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              className="rounded-xl"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            disabled={changingPassword}
          >
            {changingPassword ? "Updating…" : "Change password"}
          </Button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection id="settings-notifications" title="Mobile Push Notifications" defaultOpen={false} className={cn(scrollMargin, desktopHidden("notifications"))}>
        <PushSettingsCard />
      </CollapsibleSection>

      {profile.role === "oversight" ? (
        <CollapsibleSection id="settings-csv-import" title="Historical Proposals CSV Import" defaultOpen={false} className={cn(scrollMargin, desktopHidden("csv-import"))}>
          <p className="text-sm text-muted-foreground">
            Upload historical proposal records. Required headers:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              organization, budget_year, final_amount
            </code>
            .
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional headers: title, description, status, proposal_type, allocation_mode, notes, sent_at, created_at, website,
            cause_area, charity_navigator_score.
          </p>
          <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={importHistoricalCsv}>
            <input
              key={historicalImportInputKey}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setHistoricalCsvFile(event.target.files?.[0] ?? null);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
            />
            <Button
              size="lg"
              type="submit"
              disabled={historicalImporting}
              className="w-full sm:w-auto"
            >
              {historicalImporting ? "Importing..." : "Import CSV"}
            </Button>
          </form>
        </CollapsibleSection>
      ) : null}

      {canManageOrganizationCategories ? (
        <CollapsibleSection id="settings-category-worker" title="Organization Category Worker" defaultOpen={false} className={cn(scrollMargin, desktopHidden("category-worker"))}>
          <p className="text-sm text-muted-foreground">
            Trigger organization categorization now without waiting for scheduled worker runs.
          </p>
          <Button
            size="lg"
            className="mt-3 w-full sm:w-auto"
            onClick={() => void runCategoryWorker()}
            disabled={runningCategoryWorker}
          >
            {runningCategoryWorker ? "Running..." : "Run Categorization Worker"}
          </Button>
        </CollapsibleSection>
      ) : null}

      {canManageOrganizationCategories ? (
        <CollapsibleSection id="settings-email-worker" title="Email Notification Worker" defaultOpen={false} className={cn(scrollMargin, desktopHidden("email-worker"))}>
          <p className="text-sm text-muted-foreground">
            Manually trigger the email worker to process weekly reminders and daily sent digests now.
          </p>
          <Button
            size="lg"
            className="mt-3 w-full sm:w-auto"
            onClick={() => void runEmailWorker()}
            disabled={runningEmailWorker}
          >
            {runningEmailWorker ? "Running..." : "Run Email Worker"}
          </Button>
        </CollapsibleSection>
      ) : null}

      {profile.role === "oversight" ? (
        <CollapsibleSection id="settings-charity-nav" title="Charity Navigator Scores" defaultOpen={false} className={cn(scrollMargin, desktopHidden("charity-nav"))}>
          <p className="text-sm text-muted-foreground">
            Fetch Charity Navigator encompass scores for all organizations that have a Charity Navigator
            URL (from proposals or organization record) and update organization scores. Requires{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">CHARITY_NAVIGATOR_API_KEY</code> in
            environment.
          </p>
          <Button
            size="lg"
            className="mt-3 w-full sm:w-auto"
            onClick={() => void runCharityNavigatorScores()}
            disabled={runningCharityNavigatorScores}
          >
            {runningCharityNavigatorScores ? "Fetching…" : "Fetch Charity Navigator Scores"}
          </Button>
        </CollapsibleSection>
      ) : null}

      {canManageOrganizationCategories ? (
        <CollapsibleSection id="settings-category-overrides" title="Organization Category Overrides" defaultOpen={false} className={cn(scrollMargin, desktopHidden("category-overrides"))}>
          {organizationCategoriesQuery.isLoading ? (
            <div className="mt-2 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : organizationCategoriesQuery.error ? (
            <p className="mt-2 text-sm text-rose-600">
              Could not load organizations: {organizationCategoriesQuery.error.message}
            </p>
          ) : !organizationCategoriesQuery.data?.organizations.length ? (
            <p className="mt-2 text-sm text-muted-foreground">No organizations available yet.</p>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={saveCategoryOverride}>
              <div className="space-y-1.5">
                <Label htmlFor="cat-organization">Organization</Label>
                <select
                  id="cat-organization"
                  className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-xl border px-3 py-1 text-base outline-none disabled:opacity-50 md:text-sm"
                  value={selectedOrganizationId}
                  onChange={(event) => {
                    const organizationId = event.target.value;
                    setSelectedOrganizationId(organizationId);
                    const nextOrganization = (organizationCategoriesQuery.data?.organizations ?? []).find(
                      (organization) => organization.id === organizationId
                    );
                    if (nextOrganization) {
                      setSelectedCategory(nextOrganization.directionalCategory);
                      setSelectedCategoryLocked(nextOrganization.directionalCategoryLocked);
                    }
                  }}
                >
                  {(organizationCategoriesQuery.data?.organizations ?? []).map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-category">Directional category</Label>
                <select
                  id="cat-category"
                  className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 w-full rounded-xl border px-3 py-1 text-base outline-none disabled:opacity-50 md:text-sm"
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value as DirectionalCategory);
                  }}
                >
                  {DIRECTIONAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {DIRECTIONAL_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategoryLocked}
                  onChange={(event) => {
                    setSelectedCategoryLocked(event.target.checked);
                  }}
                  className="h-4 w-4 accent-[hsl(var(--accent))]"
                />
                Lock category (worker will not overwrite)
              </label>

              {selectedOrganization ? (
                <p className="text-xs text-muted-foreground">
                  Current source: {selectedOrganization.directionalCategorySource}. Confidence:{" "}
                  {selectedOrganization.directionalCategoryConfidence === null
                    ? "—"
                    : `${Math.round(selectedOrganization.directionalCategoryConfidence * 100)}%`}
                  . Last updated:{" "}
                  {selectedOrganization.directionalCategoryUpdatedAt
                    ? selectedOrganization.directionalCategoryUpdatedAt.slice(0, 10)
                    : "—"}
                  .
                </p>
              ) : null}

              <Button
                size="lg"
                type="submit"
                disabled={savingCategoryOverride}
                className="w-full sm:w-auto"
              >
                {savingCategoryOverride ? "Saving..." : "Save Category Override"}
              </Button>

            </form>
          )}
        </CollapsibleSection>
      ) : null}

      {canManageBudget ? (
        <>
          <CollapsibleSection id="settings-budget" title="Budget Management" defaultOpen={true} className={cn(scrollMargin, desktopHidden("budget"))}>
            {error ? (
              <>
                <CardLabel>Settings Error</CardLabel>
                <p className="mt-2 text-sm text-rose-600">{error.message}</p>
              </>
            ) : isLoading || !data ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : (
              <form className="space-y-3" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="budget-year">Budget year</Label>
                    <AmountInput
                      id="budget-year"
                      className="rounded-xl"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fund-size">Annual fund size</Label>
                    <AmountInput
                      id="fund-size"
                      className="rounded-xl"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Amount preview: {parsedTotalAmount !== null ? currency(parsedTotalAmount) : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rollover">Roll-over amount</Label>
                    <AmountInput
                      id="rollover"
                      className="rounded-xl"
                      value={rollover}
                      onChange={(event) => setRollover(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Amount preview: {parsedRollover !== null ? currency(parsedRollover) : "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="joint-ratio">Joint ratio</Label>
                    <AmountInput
                      id="joint-ratio"
                      step="0.01"
                      className="rounded-xl"
                      value={jointRatio}
                      onChange={(event) => setJointRatio(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Split preview:{" "}
                      {parsedJointRatio !== null
                        ? `${formatNumber(parsedJointRatio * 100, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="disc-ratio">Discretionary ratio</Label>
                    <AmountInput
                      id="disc-ratio"
                      step="0.01"
                      className="rounded-xl"
                      value={discretionaryRatio}
                      onChange={(event) => setDiscretionaryRatio(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Split preview:{" "}
                      {parsedDiscretionaryRatio !== null
                        ? `${formatNumber(parsedDiscretionaryRatio * 100, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Planned total budget preview (fund + roll-over):{" "}
                  {projectedTotalBudget !== null ? currency(projectedTotalBudget) : "—"}
                </p>

                <Button
                  size="lg"
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  {saving ? "Saving..." : "Save Budget"}
                </Button>

              </form>
            )}
          </CollapsibleSection>

          {data ? (
            <CollapsibleSection id="settings-budget-snapshot" title="Current Budget Snapshot" defaultOpen={true} className={cn(scrollMargin, desktopHidden("budget-snapshot"))}>
              <section className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  title="FOUNDATION TOTAL BUDGET"
                  value={currency(data.budget.total)}
                  subtitle={`Allocated: ${currency(totalAllocated)}`}
                  icon={DollarSign}
                  tone="emerald"
                  className="p-3 sm:col-span-2"
                >
                  <Progress
                    value={Math.min(totalUtilization, 100)}
                    className="mt-2 h-1.5 bg-muted"
                    indicatorClassName={totalUtilization > 100 ? "bg-rose-500" : "bg-emerald-500 dark:bg-emerald-400"}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {Math.round(totalUtilization)}% utilized
                  </p>
                </MetricCard>
                <MetricCard
                  title="JOINT POOL REMAINING"
                  value={currency(data.budget.jointRemaining)}
                  subtitle={`Allocated: ${currency(data.budget.jointAllocated)}`}
                  icon={Users}
                  tone="indigo"
                  className="p-3"
                >
                  <Progress
                    value={Math.min(jointUtilization, 100)}
                    className="mt-2 h-1.5 bg-muted"
                    indicatorClassName={jointUtilization > 100 ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {Math.round(jointUtilization)}% utilized
                  </p>
                </MetricCard>
                <MetricCard
                  title="DISCRETIONARY REMAINING"
                  value={currency(data.budget.discretionaryRemaining)}
                  subtitle={`Allocated: ${currency(data.budget.discretionaryAllocated)}`}
                  icon={Wallet}
                  tone="amber"
                  className="p-3"
                >
                  <Progress
                    value={Math.min(discretionaryUtilization, 100)}
                    className="mt-2 h-1.5 bg-muted"
                    indicatorClassName={discretionaryUtilization > 100 ? "bg-rose-500" : "bg-amber-500 dark:bg-amber-400"}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {Math.round(discretionaryUtilization)}% utilized
                  </p>
                </MetricCard>
              </section>
            </CollapsibleSection>
          ) : null}
        </>
      ) : (
        <CollapsibleSection id="settings-budget-info" title="Budget Controls" defaultOpen={false} className={cn(scrollMargin, desktopHidden("budget-info"))}>
          <p className="text-sm text-muted-foreground">
            Budget management is available only for Tom (oversight) and Dad (manager).
          </p>
        </CollapsibleSection>
      )}
        </div>
      </div>
    </div>
  );
}

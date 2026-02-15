"use client";

import { FormEvent, useState, useEffect } from "react";
import useSWR from "swr";
import { DollarSign, PieChart, Users, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PushSettingsCard } from "@/components/notifications/push-settings-card";
import { Button } from "@/components/ui/button";
import { GlassCard, CardLabel, CardValue } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  DirectionalCategory,
  DIRECTIONAL_CATEGORIES,
  DIRECTIONAL_CATEGORY_LABELS
} from "@/lib/types";
import { currency, formatNumber, parseNumberInput } from "@/lib/utils";

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

export default function SettingsPage() {
  const { user, sendPasswordReset } = useAuth();
  const canManageBudget = Boolean(user && ["oversight", "manager"].includes(user.role));
  const canManageOrganizationCategories = user?.role === "oversight";
  const { data, mutate, isLoading, error } = useSWR<BudgetResponse>(canManageBudget ? "/api/budgets" : null);
  const organizationCategoriesQuery = useSWR<OrganizationCategoriesResponse>(
    canManageOrganizationCategories ? "/api/organizations/categories" : null
  );

  const [year, setYear] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [rollover, setRollover] = useState("");
  const [jointRatio, setJointRatio] = useState("0.75");
  const [discretionaryRatio, setDiscretionaryRatio] = useState("0.25");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [historicalCsvFile, setHistoricalCsvFile] = useState<File | null>(null);
  const [historicalImporting, setHistoricalImporting] = useState(false);
  const [historicalImportInputKey, setHistoricalImportInputKey] = useState(0);
  const [historicalImportMessage, setHistoricalImportMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DirectionalCategory>("other");
  const [selectedCategoryLocked, setSelectedCategoryLocked] = useState(false);
  const [savingCategoryOverride, setSavingCategoryOverride] = useState(false);
  const [categoryOverrideMessage, setCategoryOverrideMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [runningCategoryWorker, setRunningCategoryWorker] = useState(false);
  const [categoryWorkerMessage, setCategoryWorkerMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
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

  if (!user) {
    return <p className="text-sm text-zinc-500">Loading settings...</p>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

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
      await mutate();
      setMessage("Budget saved.");
    } else {
      const payload = await response.json().catch(() => ({ error: "Failed to save budget" }));
      setMessage(payload.error || "Failed to save budget");
    }

    setSaving(false);
  };

  const sendResetEmail = async () => {
    if (!user) {
      return;
    }

    setSendingReset(true);
    setResetMessage(null);

    try {
      await sendPasswordReset(user.email);
      setResetMessage({
        tone: "success",
        text: `Password reset email sent to ${user.email}.`
      });
    } catch (err) {
      setResetMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to send password reset email."
      });
    } finally {
      setSendingReset(false);
    }
  };

  const importHistoricalCsv = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!historicalCsvFile) {
      setHistoricalImportMessage({
        tone: "error",
        text: "Select a CSV file before importing."
      });
      return;
    }

    setHistoricalImporting(true);
    setHistoricalImportMessage(null);

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

      setHistoricalImportMessage({
        tone: "success",
        text: `Imported ${formatNumber(importedCount)} historical proposals${
          skippedCount > 0 ? `, skipped ${formatNumber(skippedCount)} duplicates` : ""
        }.`
      });
      setHistoricalCsvFile(null);
      setHistoricalImportInputKey((current) => current + 1);
    } catch (err) {
      setHistoricalImportMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to import historical proposals."
      });
    } finally {
      setHistoricalImporting(false);
    }
  };

  const saveCategoryOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedOrganizationId) {
      setCategoryOverrideMessage({
        tone: "error",
        text: "Select an organization before saving."
      });
      return;
    }

    setSavingCategoryOverride(true);
    setCategoryOverrideMessage(null);

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
      setCategoryOverrideMessage({
        tone: "success",
        text: "Organization category override saved."
      });
    } catch (error) {
      setCategoryOverrideMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to save category override."
      });
    } finally {
      setSavingCategoryOverride(false);
    }
  };

  const runCategoryWorker = async () => {
    setRunningCategoryWorker(true);
    setCategoryWorkerMessage(null);

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

      setCategoryWorkerMessage({
        tone: "success",
        text: `Worker completed: processed ${formatNumber(processed)}, categorized ${formatNumber(
          categorized
        )}, skipped locked ${formatNumber(skippedLocked)}, failed ${formatNumber(
          failed
        )}, pending retries ${formatNumber(pendingRetries)}.`
      });

      await organizationCategoriesQuery.mutate();
    } catch (error) {
      setCategoryWorkerMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to run organization categorization worker."
      });
    } finally {
      setRunningCategoryWorker(false);
    }
  };

  const selectedOrganization = (organizationCategoriesQuery.data?.organizations ?? []).find(
    (organization) => organization.id === selectedOrganizationId
  );

  return (
    <div className="page-stack pb-4">
      <GlassCard className="rounded-3xl">
        <CardLabel>{canManageBudget ? "Process Oversight Controls" : "Account Settings"}</CardLabel>
        <CardValue>{canManageBudget ? "Budget & Annual Cycle" : "Password & Security"}</CardValue>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <span className="status-dot bg-emerald-500" />
          {canManageBudget
            ? "February 1 reset is enforced by setting the yearly budget record; unused funds roll back after Dec 31."
            : "Use password reset to securely change your sign-in credentials."}
        </p>
      </GlassCard>

      <GlassCard>
        <CardLabel>Password Reset</CardLabel>
        <p className="mt-1 text-sm text-zinc-500">Send a secure password reset link to {user.email}.</p>
        <Button
          variant="outline"
          size="lg"
          className="mt-3 w-full sm:w-auto"
          onClick={() => void sendResetEmail()}
          disabled={sendingReset}
        >
          {sendingReset ? "Sending..." : "Send Password Reset Email"}
        </Button>
        {resetMessage ? (
          <p className={`mt-2 text-xs ${resetMessage.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}>
            {resetMessage.text}
          </p>
        ) : null}
      </GlassCard>

      <PushSettingsCard />

      {user.role === "oversight" ? (
        <GlassCard>
          <CardLabel>Historical Proposals CSV Import</CardLabel>
          <p className="mt-1 text-sm text-zinc-500">
            Upload historical proposal records. Required headers:{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              organization, budget_year, final_amount
            </code>
            .
          </p>
          <p className="mt-1 text-xs text-zinc-500">
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
                setHistoricalImportMessage(null);
              }}
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-zinc-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-100 dark:text-zinc-300 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-200 dark:hover:file:bg-zinc-800"
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
          {historicalImportMessage ? (
            <p
              className={`mt-2 text-xs ${
                historicalImportMessage.tone === "error"
                  ? "text-rose-600"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {historicalImportMessage.text}
            </p>
          ) : null}
        </GlassCard>
      ) : null}

      {canManageOrganizationCategories ? (
        <GlassCard>
          <CardLabel>Organization Category Worker</CardLabel>
          <p className="mt-1 text-sm text-zinc-500">
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
          {categoryWorkerMessage ? (
            <p
              className={`mt-2 text-xs ${
                categoryWorkerMessage.tone === "error"
                  ? "text-rose-600"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {categoryWorkerMessage.text}
            </p>
          ) : null}
        </GlassCard>
      ) : null}

      {canManageOrganizationCategories ? (
        <GlassCard>
          <CardLabel>Organization Category Overrides</CardLabel>
          {organizationCategoriesQuery.isLoading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading organizations...</p>
          ) : organizationCategoriesQuery.error ? (
            <p className="mt-2 text-sm text-rose-600">
              Could not load organizations: {organizationCategoriesQuery.error.message}
            </p>
          ) : !organizationCategoriesQuery.data?.organizations.length ? (
            <p className="mt-2 text-sm text-zinc-500">No organizations available yet.</p>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={saveCategoryOverride}>
              <label className="block text-sm font-medium">
                Organization
                <select
                  className="field-control mt-1 w-full rounded-xl"
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
                    setCategoryOverrideMessage(null);
                  }}
                >
                  {(organizationCategoriesQuery.data?.organizations ?? []).map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Directional category
                <select
                  className="field-control mt-1 w-full rounded-xl"
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value as DirectionalCategory);
                    setCategoryOverrideMessage(null);
                  }}
                >
                  {DIRECTIONAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {DIRECTIONAL_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategoryLocked}
                  onChange={(event) => {
                    setSelectedCategoryLocked(event.target.checked);
                    setCategoryOverrideMessage(null);
                  }}
                  className="h-4 w-4 accent-[hsl(var(--accent))]"
                />
                Lock category (worker will not overwrite)
              </label>

              {selectedOrganization ? (
                <p className="text-xs text-zinc-500">
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

              {categoryOverrideMessage ? (
                <p
                  className={`text-xs ${
                    categoryOverrideMessage.tone === "error"
                      ? "text-rose-600"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {categoryOverrideMessage.text}
                </p>
              ) : null}
            </form>
          )}
        </GlassCard>
      ) : null}

      {canManageBudget ? (
        <>
          <GlassCard>
            {error ? (
              <>
                <CardLabel>Settings Error</CardLabel>
                <p className="mt-2 text-sm text-rose-600">{error.message}</p>
              </>
            ) : isLoading || !data ? (
              <p className="text-sm text-zinc-500">Loading settings...</p>
            ) : (
              <form className="space-y-3" onSubmit={submit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Budget year
                    <input
                      type="number"
                      className="field-control mt-1 w-full rounded-xl"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Annual fund size
                    <input
                      type="number"
                      className="field-control mt-1 w-full rounded-xl"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Amount preview: {parsedTotalAmount !== null ? currency(parsedTotalAmount) : "—"}
                    </p>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-medium">
                    Roll-over amount
                    <input
                      type="number"
                      className="field-control mt-1 w-full rounded-xl"
                      value={rollover}
                      onChange={(event) => setRollover(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Amount preview: {parsedRollover !== null ? currency(parsedRollover) : "—"}
                    </p>
                  </label>
                  <label className="text-sm font-medium">
                    Joint ratio
                    <input
                      type="number"
                      step="0.01"
                      className="field-control mt-1 w-full rounded-xl"
                      value={jointRatio}
                      onChange={(event) => setJointRatio(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Split preview:{" "}
                      {parsedJointRatio !== null
                        ? `${formatNumber(parsedJointRatio * 100, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}%`
                        : "—"}
                    </p>
                  </label>
                  <label className="text-sm font-medium">
                    Discretionary ratio
                    <input
                      type="number"
                      step="0.01"
                      className="field-control mt-1 w-full rounded-xl"
                      value={discretionaryRatio}
                      onChange={(event) => setDiscretionaryRatio(event.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Split preview:{" "}
                      {parsedDiscretionaryRatio !== null
                        ? `${formatNumber(parsedDiscretionaryRatio * 100, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}%`
                        : "—"}
                    </p>
                  </label>
                </div>

                <p className="text-xs text-zinc-500">
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

                {message ? <p className="text-xs text-zinc-600">{message}</p> : null}
              </form>
            )}
          </GlassCard>

          {data ? (
            <GlassCard>
              <CardLabel>Current Budget Snapshot</CardLabel>
              <section className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard
                  title="TOTAL BUDGET"
                  value={currency(data.budget.total)}
                  icon={DollarSign}
                  tone="emerald"
                  className="p-3"
                />
                <MetricCard
                  title="TOTAL ALLOCATED"
                  value={currency(totalAllocated)}
                  icon={PieChart}
                  tone="sky"
                  className="p-3"
                />
                <MetricCard
                  title="JOINT POOL REMAINING"
                  value={currency(data.budget.jointRemaining)}
                  subtitle={`Allocated: ${currency(data.budget.jointAllocated)}`}
                  icon={Users}
                  tone="indigo"
                  className="p-3"
                >
                  <div className="budget-progress-track mt-2">
                    <div
                      className={`budget-progress-fill ${
                        jointUtilization > 100 ? "bg-rose-500" : "bg-indigo-500 dark:bg-indigo-400"
                      }`}
                      style={{ width: `${Math.min(jointUtilization, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
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
                  <div className="budget-progress-track mt-2">
                    <div
                      className={`budget-progress-fill ${
                        discretionaryUtilization > 100
                          ? "bg-rose-500"
                          : "bg-amber-500 dark:bg-amber-400"
                      }`}
                      style={{ width: `${Math.min(discretionaryUtilization, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {Math.round(discretionaryUtilization)}% utilized
                  </p>
                </MetricCard>
              </section>
            </GlassCard>
          ) : null}
        </>
      ) : (
        <GlassCard>
          <CardLabel>Budget Controls</CardLabel>
          <p className="mt-2 text-sm text-zinc-500">
            Budget management is available only for Tom (oversight) and Dad (manager).
          </p>
        </GlassCard>
      )}
    </div>
  );
}

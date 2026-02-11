"use client";

import { FormEvent, useState, useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { currency } from "@/lib/utils";

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

export default function SettingsPage() {
  const { user, sendPasswordReset } = useAuth();
  const canManageBudget = Boolean(user && ["oversight", "manager"].includes(user.role));
  const { data, mutate, isLoading, error } = useSWR<BudgetResponse>(canManageBudget ? "/api/budgets" : null);

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

  useEffect(() => {
    if (!data?.budget) {
      return;
    }

    setYear(String(data.budget.year));
    setTotalAmount(String(data.budget.total - data.budget.rolloverFromPreviousYear));
    setRollover(String(data.budget.rolloverFromPreviousYear));
  }, [data]);

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
        text: `Imported ${importedCount} historical proposals${skippedCount > 0 ? `, skipped ${skippedCount} duplicates` : ""}.`
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

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>{canManageBudget ? "Process Oversight Controls" : "Account Settings"}</CardTitle>
        <CardValue>{canManageBudget ? "Budget & Annual Cycle" : "Password & Security"}</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          {canManageBudget
            ? "February 1 reset is enforced by setting the yearly budget record; unused funds roll back after Dec 31."
            : "Use password reset to securely change your sign-in credentials."}
        </p>
      </Card>

      <Card>
        <CardTitle>Password Reset</CardTitle>
        <p className="mt-1 text-sm text-zinc-500">Send a secure password reset link to {user.email}.</p>
        <button
          type="button"
          onClick={() => void sendResetEmail()}
          disabled={sendingReset}
          className="mt-3 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {sendingReset ? "Sending..." : "Send Password Reset Email"}
        </button>
        {resetMessage ? (
          <p className={`mt-2 text-xs ${resetMessage.tone === "error" ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}>
            {resetMessage.text}
          </p>
        ) : null}
      </Card>

      {user.role === "oversight" ? (
        <Card>
          <CardTitle>Historical Proposals CSV Import</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Upload historical proposal records. Required headers:{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
              title, organization, budget_year, final_amount
            </code>
            .
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Optional headers: description, status, proposal_type, allocation_mode, notes, sent_at, created_at, website,
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
            <button
              type="submit"
              disabled={historicalImporting}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {historicalImporting ? "Importing..." : "Import CSV"}
            </button>
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
        </Card>
      ) : null}

      {canManageBudget ? (
        <>
          <Card>
            {error ? (
              <>
                <CardTitle>Settings Error</CardTitle>
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
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Annual fund size
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm font-medium">
                    Roll-over amount
                    <input
                      type="number"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={rollover}
                      onChange={(event) => setRollover(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Joint ratio
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={jointRatio}
                      onChange={(event) => setJointRatio(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Discretionary ratio
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={discretionaryRatio}
                      onChange={(event) => setDiscretionaryRatio(event.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Budget"}
                </button>

                {message ? <p className="text-xs text-zinc-600">{message}</p> : null}
              </form>
            )}
          </Card>

          {data ? (
            <Card>
              <CardTitle>Current Budget Snapshot</CardTitle>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p>Joint Pool: {currency(data.budget.jointPool)}</p>
                <p>Discretionary Pool: {currency(data.budget.discretionaryPool)}</p>
                <p>Joint Remaining: {currency(data.budget.jointRemaining)}</p>
                <p>Discretionary Remaining: {currency(data.budget.discretionaryRemaining)}</p>
              </div>
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <CardTitle>Budget Controls</CardTitle>
          <p className="mt-2 text-sm text-zinc-500">
            Budget management is available only for Tom (oversight) and Dad (manager).
          </p>
        </Card>
      )}
    </div>
  );
}

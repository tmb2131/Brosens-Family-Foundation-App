"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { FoundationSnapshot, Organization } from "@/lib/types";

interface ProposalMetaResponse {
  proposals: FoundationSnapshot["proposals"];
  organizations: Organization[];
}

export default function NewProposalPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data } = useSWR<ProposalMetaResponse>(
    user ? "/api/proposals" : null
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [proposalType, setProposalType] = useState<"joint" | "discretionary">("joint");
  const allocationMode: "sum" = "sum";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          organizationId,
          proposalType,
          allocationMode
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Failed to submit" }));
        throw new Error(payload.error || "Failed to submit");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>Submission Flow</CardTitle>
        <CardValue>New Giving Idea</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Proposals are added to the full grant list and move to blind voting. For discretionary grants,
          proposer is an automatic "Yes." 
        </p>
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Proposal title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            Organization
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            >
              <option value="">Select organization</option>
              {data?.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} (Charity Navigator {org.charityNavigatorScore})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Proposal type
              <select
                value={proposalType}
                onChange={(event) => setProposalType(event.target.value as "joint" | "discretionary")}
                className="mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-zinc-900/40"
              >
                <option value="joint">Joint (75% pool)</option>
                <option value="discretionary">Discretionary (25% pool)</option>
              </select>
            </label>

            <div className="block text-sm font-medium">
              Final amount rule
              <p className="mt-1 w-full rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300">
                Sum of blind allocations
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit Proposal"}
          </button>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </form>
      </Card>
    </div>
  );
}

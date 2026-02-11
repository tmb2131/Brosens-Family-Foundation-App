"use client";

import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { currency } from "@/lib/utils";
import { FoundationSnapshot } from "@/lib/types";

interface AdminQueueResponse {
  proposals: FoundationSnapshot["proposals"];
}

export default function AdminPage() {
  const { user } = useAuth();
  const { data, mutate, isLoading, error } = useSWR<AdminQueueResponse>("/api/admin", {
    refreshInterval: 8_000
  });

  if (!user || user.role !== "admin") {
    return (
      <Card>
        <CardTitle>Execution Queue Access</CardTitle>
        <p className="mt-2 text-sm text-zinc-500">Only Brynn (Admin role) can execute approved grants.</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardTitle>Execution Queue Error</CardTitle>
        <p className="mt-2 text-sm text-rose-600">{error.message}</p>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-zinc-500">Loading execution queue...</p>;
  }

  const markSent = async (proposalId: string) => {
    await fetch("/api/meeting", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "decision", proposalId, status: "sent" })
    });
    await mutate();
  };

  return (
    <div className="space-y-4 pb-4">
      <Card className="rounded-3xl">
        <CardTitle>Administrator Workspace</CardTitle>
        <CardValue>Donation Execution Cues</CardValue>
        <p className="mt-1 text-sm text-zinc-500">
          Approved grants appear here. Mark as Sent once external donation execution is complete.
        </p>
      </Card>

      <div className="space-y-3">
        {data.proposals.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500">No approved proposals awaiting execution.</p>
          </Card>
        ) : (
          data.proposals.map((proposal) => (
            <Card key={proposal.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{proposal.title}</h3>
                  <p className="text-xs text-zinc-500">{proposal.organizationName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Final amount: {currency(proposal.progress.computedFinalAmount)}
                  </p>
                </div>
                <StatusPill status={proposal.status} />
              </div>
              <button
                type="button"
                className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => void markSent(proposal.id)}
              >
                Mark as Sent
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

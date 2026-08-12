import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProposalShareTitle } from "@/lib/foundation-data";
import { withAppBase } from "@/lib/app-url";

/** `/proposals/<uuid>` — a shared link to a single proposal. */
const PROPOSAL_DETAIL_PATH =
  /^\/proposals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const SITE_NAME = "Brosens Family Foundation";
const SHARE_DESCRIPTION = "Grant proposal · Sign in to review and vote.";

/** Extracts the proposal id from a `/proposals/<uuid>` path, or null. */
export function proposalIdFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  return PROPOSAL_DETAIL_PATH.exec(path.trim())?.[1] ?? null;
}

/**
 * Link-preview metadata for a shared proposal URL.
 *
 * Deliberately carries the proposal title and nothing else: this is rendered
 * for unauthenticated crawlers, so amounts, proposer and vote data must not
 * appear here. Returns null when the proposal cannot be resolved, letting the
 * caller fall back to the site-wide defaults.
 */
export async function buildProposalShareMetadata(
  proposalId: string
): Promise<Metadata | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  let title: string | null = null;
  try {
    title = await getProposalShareTitle(admin, proposalId);
  } catch {
    // Never let a preview lookup break the page it is attached to.
    return null;
  }

  if (!title) return null;

  const canonicalUrl = withAppBase(`/proposals/${proposalId}`);

  return {
    title,
    description: SHARE_DESCRIPTION,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description: SHARE_DESCRIPTION,
      url: canonicalUrl
    },
    twitter: {
      card: "summary",
      title,
      description: SHARE_DESCRIPTION
    }
  };
}

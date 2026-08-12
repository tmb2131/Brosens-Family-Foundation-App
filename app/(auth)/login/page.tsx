import { Suspense } from "react";
import type { Metadata } from "next";
import LoginClient from "@/app/(auth)/login/login-client";
import { buildProposalShareMetadata, proposalIdFromPath } from "@/lib/proposal-share-metadata";

/**
 * A link-unfurling bot has no session, so a shared `/proposals/<id>` URL
 * redirects it here — and the preview card it renders comes from *this* page's
 * metadata, not the proposal page's. When the redirect target is a proposal, we
 * surface that proposal's title so the shared link is identifiable; otherwise
 * the root layout's site-wide defaults apply.
 */
export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const redirectParam = params.redirect;
  const redirectPath = Array.isArray(redirectParam) ? redirectParam[0] : redirectParam;

  const proposalId = proposalIdFromPath(redirectPath);
  if (!proposalId) {
    return {};
  }

  return (await buildProposalShareMetadata(proposalId)) ?? {};
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading login...</div>}>
      <LoginClient />
    </Suspense>
  );
}

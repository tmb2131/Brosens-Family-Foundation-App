import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  fetchPreviewByEin,
  parseEinFromCharityNavigatorUrl
} from "@/lib/charity-navigator";
import { normalizeOptionalHttpUrl } from "@/lib/url-validation";

type PreviewState =
  | "preview_available"
  | "missing_ein"
  | "no_score"
  | "config_missing"
  | "upstream_error";

interface PreviewResponse {
  state: PreviewState;
  normalizedUrl: string | null;
  ein: string | null;
  score: number | null;
  organizationName: string | null;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuthContext();
    assertRole(context.profile, ["member", "oversight", "manager", "admin"]);

    const body = await request.json();
    const normalizedUrl = normalizeOptionalHttpUrl(
      body.charityNavigatorUrl ?? body.url,
      "charity navigator link"
    );
    if (!normalizedUrl) {
      throw new HttpError(400, "Charity Navigator link is required.");
    }

    const ein = parseEinFromCharityNavigatorUrl(normalizedUrl);
    if (!ein) {
      const payload: PreviewResponse = {
        state: "missing_ein",
        normalizedUrl,
        ein: null,
        score: null,
        organizationName: null,
        message: "Use a Charity Navigator EIN profile URL (for example: charitynavigator.org/ein/#########)."
      };
      return NextResponse.json(payload);
    }

    const preview = await fetchPreviewByEin(ein);
    if (preview.configMissing) {
      const payload: PreviewResponse = {
        state: "config_missing",
        normalizedUrl,
        ein,
        score: null,
        organizationName: null,
        message: "Charity Navigator preview is not configured on the server."
      };
      return NextResponse.json(payload);
    }

    if (preview.upstreamError) {
      const payload: PreviewResponse = {
        state: "upstream_error",
        normalizedUrl,
        ein,
        score: null,
        organizationName: null,
        message: "Charity Navigator is temporarily unavailable. You can still submit your proposal."
      };
      return NextResponse.json(payload);
    }

    if (preview.score === null) {
      const payload: PreviewResponse = {
        state: "no_score",
        normalizedUrl,
        ein,
        score: null,
        organizationName: preview.organizationName,
        message: "No Charity Navigator score was found for this EIN yet."
      };
      return NextResponse.json(payload);
    }

    const payload: PreviewResponse = {
      state: "preview_available",
      normalizedUrl,
      ein,
      score: preview.score,
      organizationName: preview.organizationName
    };
    return NextResponse.json(payload);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

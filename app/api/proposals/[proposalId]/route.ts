import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getProposalDetail } from "@/lib/foundation-data";
import { DYNAMIC_CACHE_HEADERS, HttpError, toErrorResponse } from "@/lib/http-error";

/** Single-proposal detail for the shareable proposal page. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await context.params;
    const { admin, profile } = await requireAuthContext();

    const trimmedId = proposalId.trim();
    if (!trimmedId) {
      throw new HttpError(400, "Missing proposal id.");
    }

    const detail = await getProposalDetail(admin, trimmedId, profile);

    return NextResponse.json(detail, { headers: DYNAMIC_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

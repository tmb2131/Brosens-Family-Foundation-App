import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { listProposalTitleSuggestions } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin } = await requireAuthContext();
    const titles = await listProposalTitleSuggestions(admin);

    return NextResponse.json({ titles });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

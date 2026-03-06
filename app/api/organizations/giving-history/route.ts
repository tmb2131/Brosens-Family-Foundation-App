import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { getOrganizationGivingHistory } from "@/lib/organization-giving-history";
import { PRIVATE_CACHE_HEADERS, toErrorResponse } from "@/lib/http-error";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAuthContext();
    const name = request.nextUrl.searchParams.get("name");
    const organizationId = request.nextUrl.searchParams.get("organizationId") || null;
    const fuzzy = request.nextUrl.searchParams.get("fuzzy") === "1";
    const namesParam = request.nextUrl.searchParams.get("names");

    if (!name?.trim()) {
      return NextResponse.json({ error: "name query parameter is required." }, { status: 400 });
    }

    let names: string[] | undefined;
    if (namesParam) {
      try {
        const parsed: unknown = JSON.parse(namesParam);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
          names = parsed as string[];
        }
      } catch {
        /* ignore malformed names param, fall through to name/fuzzy */
      }
    }

    const history = await getOrganizationGivingHistory(admin, {
      organizationId,
      name: name.trim(),
      fuzzy,
      names
    });

    return NextResponse.json(history, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

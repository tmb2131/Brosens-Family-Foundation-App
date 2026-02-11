import { NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { getAdminQueue } from "@/lib/foundation-data";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["admin"]);

    const proposals = await getAdminQueue(admin, profile.id);
    return NextResponse.json({ proposals });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

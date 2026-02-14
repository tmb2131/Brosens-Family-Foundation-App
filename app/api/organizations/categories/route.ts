import { NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { listOrganizationsWithDirectionalCategory } from "@/lib/organization-categorization";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight"]);

    const organizations = await listOrganizationsWithDirectionalCategory(admin);
    return NextResponse.json({ organizations });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

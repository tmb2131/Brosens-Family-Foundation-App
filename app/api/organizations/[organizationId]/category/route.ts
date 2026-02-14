import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import {
  updateOrganizationDirectionalCategory
} from "@/lib/organization-categorization";
import { DirectionalCategory, DIRECTIONAL_CATEGORIES } from "@/lib/types";

function isDirectionalCategory(value: string): value is DirectionalCategory {
  return (DIRECTIONAL_CATEGORIES as readonly string[]).includes(value);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight"]);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const rawCategory = String(body.category ?? "").trim();
    const category = rawCategory ? rawCategory.toLowerCase() : "";
    const lock =
      body.lock === undefined
        ? undefined
        : typeof body.lock === "boolean"
        ? body.lock
        : (() => {
            throw new HttpError(400, "lock must be a boolean.");
          })();

    if (!category && lock === undefined) {
      throw new HttpError(400, "Provide at least one of category or lock.");
    }

    if (category && !isDirectionalCategory(category)) {
      throw new HttpError(
        400,
        `category must be one of: ${DIRECTIONAL_CATEGORIES.join(", ")}.`
      );
    }

    const nextCategory: DirectionalCategory | undefined = category
      ? (category as DirectionalCategory)
      : undefined;

    const organization = await updateOrganizationDirectionalCategory(admin, {
      organizationId,
      ...(nextCategory ? { category: nextCategory } : {}),
      ...(lock !== undefined ? { lock } : {})
    });

    return NextResponse.json({ organization });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

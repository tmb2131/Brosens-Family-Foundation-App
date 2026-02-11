import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { getBudgetSnapshot, updateBudget } from "@/lib/foundation-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { admin } = await requireAuthContext();
    return NextResponse.json({ budget: await getBudgetSnapshot(admin) });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, ["oversight", "manager"]);

    const body = await request.json();
    const year = Number(body.year);
    const totalAmount = Number(body.totalAmount);
    const rolloverFromPreviousYear = Number(body.rolloverFromPreviousYear ?? 0);
    const jointRatio = Number(body.jointRatio ?? 0.75);
    const discretionaryRatio = Number(body.discretionaryRatio ?? 0.25);

    if (
      Number.isNaN(year) ||
      Number.isNaN(totalAmount) ||
      Number.isNaN(rolloverFromPreviousYear) ||
      Number.isNaN(jointRatio) ||
      Number.isNaN(discretionaryRatio)
    ) {
      throw new HttpError(400, "Invalid numeric fields");
    }

    if (Math.abs(jointRatio + discretionaryRatio - 1) > 0.001) {
      throw new HttpError(400, "Joint and discretionary ratios must total 1.");
    }

    const budget = await updateBudget(admin, {
      year,
      totalAmount,
      rolloverFromPreviousYear,
      jointRatio,
      discretionaryRatio,
      updatedByUserId: profile.id
    });

    return NextResponse.json({ budget });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertRole, requireAuthContext } from "@/lib/auth-server";
import { createFrankDeenieDonation, getFrankDeenieSnapshot } from "@/lib/frank-deenie-data";
import { HttpError, toErrorResponse } from "@/lib/http-error";

const FRANK_DEENIE_ALLOWED_ROLES = ["oversight", "admin", "manager"] as const;

function parseIncludeChildren(value: string | null) {
  if (value === null) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return !["0", "false", "no", "off"].includes(normalized);
}

function parseYear(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return null;
  }

  const year = Number(normalized);
  if (!Number.isInteger(year)) {
    throw new HttpError(400, "year must be a valid integer.");
  }

  return year;
}

export async function GET(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    const year = parseYear(request.nextUrl.searchParams.get("year"));
    const includeChildren = parseIncludeChildren(request.nextUrl.searchParams.get("includeChildren"));
    const snapshot = await getFrankDeenieSnapshot(admin, { year, includeChildren });

    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    assertRole(profile, [...FRANK_DEENIE_ALLOWED_ROLES]);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Request body must be a JSON object.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "date")) {
      throw new HttpError(400, "date is required.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "name")) {
      throw new HttpError(400, "name is required.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "amount")) {
      throw new HttpError(400, "amount is required.");
    }

    const donation = await createFrankDeenieDonation(admin, {
      date: String(body.date ?? ""),
      type: body.type === undefined ? undefined : String(body.type ?? ""),
      name: String(body.name ?? ""),
      memo: body.memo === undefined || body.memo === null ? body.memo : String(body.memo),
      split: body.split === undefined || body.split === null ? body.split : String(body.split),
      amount: Number(body.amount),
      status: body.status === undefined ? undefined : String(body.status ?? ""),
      requesterId: profile.id
    });

    return NextResponse.json({ donation }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

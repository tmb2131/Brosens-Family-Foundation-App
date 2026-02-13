import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { HttpError, toErrorResponse } from "@/lib/http-error";

function parseTimezone(body: Record<string, unknown>) {
  const timezone = String(body.timezone ?? "").trim();
  if (!timezone) {
    throw new HttpError(400, "timezone is required.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new HttpError(400, "timezone must be a valid IANA timezone.");
  }

  return timezone;
}

export async function POST(request: NextRequest) {
  try {
    const { admin, profile } = await requireAuthContext();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const timezone = parseTimezone(body);

    const { error } = await admin
      .from("user_profiles")
      .update({ timezone })
      .eq("id", profile.id);

    if (error) {
      throw new HttpError(500, `Could not update timezone: ${error.message}`);
    }

    return NextResponse.json({ timezone });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

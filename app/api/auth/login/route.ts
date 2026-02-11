import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth-server";
import { toErrorResponse } from "@/lib/http-error";

export async function GET() {
  try {
    const { profile } = await requireAuthContext();
    return NextResponse.json({ user: profile });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

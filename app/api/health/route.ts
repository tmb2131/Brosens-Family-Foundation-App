import { NextResponse } from "next/server";
import { DYNAMIC_CACHE_HEADERS } from "@/lib/http-error";

export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { headers: DYNAMIC_CACHE_HEADERS }
  );
}

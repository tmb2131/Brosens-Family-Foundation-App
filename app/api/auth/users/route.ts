import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toErrorResponse, STALE_CACHE_HEADERS } from "@/lib/http-error";

export interface AuthUsersResponse {
  users: Array<{ email: string; name: string }>;
}

export async function GET() {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ users: [] });
    }

    const { data, error } = await admin
      .from("user_profiles")
      .select("email, full_name")
      .order("full_name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const users: AuthUsersResponse["users"] = (data ?? []).map((row) => ({
      email: row.email as string,
      name: row.full_name as string
    }));

    return NextResponse.json({ users }, { headers: STALE_CACHE_HEADERS });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http-error";
import { AppRole, UserProfile } from "@/lib/types";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
};

export interface AuthContext {
  profile: UserProfile;
  authUserId: string;
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role
  };
}

function deriveName(email: string) {
  const localPart = email.split("@")[0] ?? "Member";
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getOrCreateProfile(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
): Promise<UserProfile> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, full_name, email, role")
    .eq("id", authUser.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new HttpError(500, `Could not load user profile: ${error.message}`);
  }

  if (data) {
    return mapProfile(data);
  }

  const email = authUser.email ?? `${authUser.id}@unknown.local`;
  const metadataFullName =
    typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name.trim()
      : "";

  const fullName = metadataFullName || deriveName(email);

  const { data: inserted, error: insertError } = await admin
    .from("user_profiles")
    .insert({
      id: authUser.id,
      full_name: fullName,
      email,
      role: "member"
    })
    .select("id, full_name, email, role")
    .single<ProfileRow>();

  if (insertError || !inserted) {
    throw new HttpError(
      500,
      `Could not initialize user profile: ${insertError?.message ?? "missing row"}`
    );
  }

  return mapProfile(inserted);
}

export async function requireAuthContext(): Promise<AuthContext> {
  const serverSupabase = await createServerClient();
  const admin = createAdminClient();

  if (!serverSupabase || !admin) {
    throw new HttpError(
      500,
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const {
    data: { user },
    error
  } = await serverSupabase.auth.getUser();

  if (error) {
    throw new HttpError(401, `Auth session error: ${error.message}`);
  }

  if (!user) {
    throw new HttpError(401, "Not authenticated.");
  }

  const profile = await getOrCreateProfile(admin, user);

  return {
    profile,
    authUserId: user.id,
    admin
  };
}

export function assertRole(profile: UserProfile, roles: AppRole[]) {
  if (!roles.includes(profile.role)) {
    throw new HttpError(403, "Insufficient permissions.");
  }
}

export function isVotingRole(role: AppRole) {
  return role === "member" || role === "oversight";
}

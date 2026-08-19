import { createServerSupabaseClient } from "@/lib/supabase/server";

export class NotAuthorizedError extends Error {
  constructor(message = "Not authorized.") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

/**
 * Server Actions execute independently of page/layout rendering — the
 * /admin layout's role-guard does NOT protect them. Every Server Action
 * that performs an admin-only mutation must call this first.
 */
export async function requireAdmin(): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new NotAuthorizedError("You must be signed in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new NotAuthorizedError("Admin access required.");
  }

  return { id: user.id };
}

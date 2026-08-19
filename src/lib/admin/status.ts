import { SupabaseClient } from "@supabase/supabase-js";

export async function updateProfileStatus(
  supabase: SupabaseClient,
  profileId: string,
  status: "active" | "inactive"
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .select("id");

  if (error) throw new Error(error.message);
  // With RLS, a denied update returns success with zero affected rows rather
  // than a permission error — treat that as a failure so callers can trust
  // "no throw" means the status genuinely changed.
  if (!data || data.length === 0) {
    throw new Error("Update denied or profile not found.");
  }
}

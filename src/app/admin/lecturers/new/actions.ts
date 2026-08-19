"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/auth/invite";

export async function createLecturer(_prevState: { error: string | null }, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!fullName || !email || !department || !designation) {
    return { error: "Please fill in all required fields." };
  }

  let profileId: string;
  try {
    const invited = await inviteUser(email, fullName, "lecturer");
    profileId = invited.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send invite." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("lecturers").insert({
    profile_id: profileId,
    department,
    designation,
  });

  if (error) {
    return { error: `Invite sent, but saving lecturer details failed: ${error.message}` };
  }

  redirect("/admin/lecturers");
}

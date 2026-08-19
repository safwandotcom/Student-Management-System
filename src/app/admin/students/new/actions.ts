"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/auth/invite";

export async function createStudent(_prevState: { error: string | null }, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const program = String(formData.get("program") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim() || null;
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim() || null;

  if (!fullName || !email || !studentId || !program || !batch) {
    return { error: "Please fill in all required fields." };
  }

  let profileId: string;
  try {
    const invited = await inviteUser(email, fullName, "student");
    profileId = invited.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send invite." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("students").insert({
    profile_id: profileId,
    student_id: studentId,
    program,
    batch,
    guardian_name: guardianName,
    guardian_phone: guardianPhone,
  });

  if (error) {
    return { error: `Invite sent, but saving student details failed: ${error.message}` };
  }

  redirect("/admin/students");
}

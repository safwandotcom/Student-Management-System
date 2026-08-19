"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function updateLecturer(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const id = String(formData.get("id") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!id || !department || !designation) {
    return { error: "Department and designation are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecturers")
    .update({ department, designation })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or lecturer not found." };

  revalidatePath(`/admin/lecturers/${id}`);
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function updateCourse(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  const credits = Number(creditsRaw);
  if (!id || !title || !creditsRaw || !Number.isFinite(credits) || credits <= 0 || !semester || !department) {
    return { error: "Please fill in all fields with valid values." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ title, credits, semester, department })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or course not found." };

  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}

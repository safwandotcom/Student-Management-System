"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateStudent(_prevState: { error: string | null }, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const program = String(formData.get("program") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim() || null;
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim() || null;

  if (!id || !program || !batch) {
    return { error: "Program and batch are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .update({ program, batch, guardian_name: guardianName, guardian_phone: guardianPhone })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or student not found." };

  revalidatePath(`/admin/students/${id}`);
  return { error: null };
}

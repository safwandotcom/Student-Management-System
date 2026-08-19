"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function createCourse(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  const credits = Number(creditsRaw);
  if (!code || !title || !creditsRaw || !Number.isFinite(credits) || credits <= 0 || !semester || !department) {
    return { error: "Please fill in all fields with valid values." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("courses").insert({ code, title, credits, semester, department });

  if (error) {
    return { error: error.message.includes("duplicate") ? "A course with this code already exists." : error.message };
  }

  redirect("/admin/courses");
}

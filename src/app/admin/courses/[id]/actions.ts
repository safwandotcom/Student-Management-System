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

export async function createOffering(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const lecturerId = String(formData.get("lecturer_id") ?? "");
  const term = String(formData.get("term") ?? "").trim();

  if (!courseId || !lecturerId || !term) {
    return { error: "Please select a lecturer and enter a term." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("course_offerings")
    .insert({ course_id: courseId, lecturer_id: lecturerId, term });

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "This lecturer is already assigned to this course for this term."
        : error.message,
    };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

export async function enrollStudent(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const offeringId = String(formData.get("offering_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");

  if (!courseId || !offeringId || !studentId) {
    return { error: "Please select a student." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("enrollments")
    .insert({ student_id: studentId, offering_id: offeringId });

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "This student is already enrolled in this offering."
        : error.message,
    };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}

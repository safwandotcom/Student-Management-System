// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("case-insensitive uniqueness", () => {
  let lecturerProfileId: string, lecturerRowId: string, courseId: string;
  let existingCode: string;

  beforeAll(async () => {
    const stamp = Date.now();
    const lecturerEmail = `ci-uniqueness-lecturer-${stamp}@example.com`;

    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail,
      password: "TestPassword123!",
      email_confirm: true,
      app_metadata: { role: "lecturer" },
      user_metadata: { full_name: "CI Uniqueness Lecturer" },
    });
    lecturerProfileId = lec.data.user!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id")
      .single();
    lecturerRowId = lecturerRow!.id;

    existingCode = `CI-${stamp}`;
    const { data: course } = await admin
      .from("courses")
      .insert({ code: existingCode, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    courseId = course!.id;

    // Seed one offering so we have an existing (course_id, lecturer_id, term)
    // triple to attempt a case-variant duplicate against.
    const { error: seedOfferingError } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" });
    expect(seedOfferingError).toBeNull();
  });

  it("rejects a course code that differs only in casing from an existing one", async () => {
    const { error } = await admin
      .from("courses")
      .insert({ code: existingCode.toLowerCase(), title: "Case Variant", credits: 3, semester: "Fall", department: "CS" });

    expect(error).not.toBeNull();
    // The duplicate-detection in createCourse/createOffering relies on
    // error.message.includes("duplicate") — assert the case-insensitive
    // unique index violation still produces that same error shape.
    expect(error!.message.toLowerCase()).toContain("duplicate");
  });

  it("rejects an offering term that differs only in casing from an existing (course_id, lecturer_id, term) triple", async () => {
    const { error } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "fall 2026" });

    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("duplicate");
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});

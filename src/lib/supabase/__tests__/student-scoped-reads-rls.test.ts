// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("student-scoped reads RLS (courses, course_offerings, profiles)", () => {
  const password = "TestPassword123!";
  let enrolledStudentProfileId: string, otherStudentProfileId: string, lecturerProfileId: string;
  let enrolledStudentEmail: string, otherStudentEmail: string, lecturerEmail: string;
  let courseId: string, offeringId: string, lecturerRowId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    enrolledStudentEmail = `scoped-reads-enrolled-${stamp}@example.com`;
    otherStudentEmail = `scoped-reads-other-${stamp}@example.com`;
    lecturerEmail = `scoped-reads-lecturer-${stamp}@example.com`;

    const enrolled = await admin.auth.admin.createUser({
      email: enrolledStudentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Enrolled Student" },
    });
    const other = await admin.auth.admin.createUser({
      email: otherStudentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Other Student" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Scoped Reads Lecturer" },
    });
    enrolledStudentProfileId = enrolled.data.user!.id;
    otherStudentProfileId = other.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: enrolledStudentRow } = await admin
      .from("students")
      .insert({ profile_id: enrolledStudentProfileId, student_id: `SCOPED-A-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();

    await admin
      .from("students")
      .insert({ profile_id: otherStudentProfileId, student_id: `SCOPED-B-${stamp}`, program: "CS", batch: "2026" });

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id").single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `SCOPED-${stamp}`, title: "Scoped Reads Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id").single();
    courseId = course!.id;

    const { data: offering } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id").single();
    offeringId = offering!.id;

    await admin.from("enrollments").insert({ student_id: enrolledStudentRow!.id, offering_id: offeringId });
  });

  it("lets the enrolled student read the offering, its course, and the lecturer's profile", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: enrolledStudentEmail, password });

    const { data: offering, error: offeringError } = await client
      .from("course_offerings").select("*").eq("id", offeringId);
    expect(offeringError).toBeNull();
    expect(offering).toHaveLength(1);

    const { data: course, error: courseError } = await client
      .from("courses").select("*").eq("id", courseId);
    expect(courseError).toBeNull();
    expect(course).toHaveLength(1);

    const { data: lecturerProfile, error: profileError } = await client
      .from("profiles").select("*").eq("id", lecturerProfileId);
    expect(profileError).toBeNull();
    expect(lecturerProfile).toHaveLength(1);
  });

  it("returns empty results (not an error) to an unrelated student", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: otherStudentEmail, password });

    const { data: offering } = await client.from("course_offerings").select("*").eq("id", offeringId);
    expect(offering).toEqual([]);

    const { data: course } = await client.from("courses").select("*").eq("id", courseId);
    expect(course).toEqual([]);

    const { data: lecturerProfile } = await client.from("profiles").select("*").eq("id", lecturerProfileId);
    expect(lecturerProfile).toEqual([]);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(enrolledStudentProfileId);
    await admin.auth.admin.deleteUser(otherStudentProfileId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});

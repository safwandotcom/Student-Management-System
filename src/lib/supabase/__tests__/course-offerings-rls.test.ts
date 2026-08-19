// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("course_offerings RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string, lecturerProfileId: string, lecturerRowId: string, courseId: string;
  let adminEmail: string, studentEmail: string, lecturerEmail: string;
  let offeringId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `offerings-rls-admin-${stamp}@example.com`;
    studentEmail = `offerings-rls-student-${stamp}@example.com`;
    lecturerEmail = `offerings-rls-lecturer-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stu = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student One" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer One" },
    });
    adminId = adm.data.user!.id;
    studentId = stu.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id")
      .single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `OFF-RLS-${stamp}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    courseId = course!.id;
  });

  it("lets an admin insert and select an offering", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    offeringId = inserted!.id;

    const { data: selected } = await client.from("course_offerings").select("*").eq("id", offeringId).maybeSingle();
    expect(selected?.id).toBe(offeringId);
  });

  it("returns empty results (not an error) to a non-admin authenticated user", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentEmail, password });

    const { data, error } = await client.from("course_offerings").select("*").eq("id", offeringId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("course_offerings").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});

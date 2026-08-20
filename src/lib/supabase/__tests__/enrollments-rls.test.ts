// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("enrollments RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentAProfileId: string, studentARowId: string, studentBProfileId: string, studentBRowId: string;
  let lecturerProfileId: string, lecturerRowId: string, courseId: string, offeringId: string;
  let adminEmail: string, studentAEmail: string, studentBEmail: string, lecturerEmail: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `enroll-rls-admin-${stamp}@example.com`;
    studentAEmail = `enroll-rls-student-a-${stamp}@example.com`;
    studentBEmail = `enroll-rls-student-b-${stamp}@example.com`;
    lecturerEmail = `enroll-rls-lecturer-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stuA = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student A" },
    });
    const stuB = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student B" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer One" },
    });
    adminId = adm.data.user!.id;
    studentAProfileId = stuA.data.user!.id;
    studentBProfileId = stuB.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: studentARow } = await admin
      .from("students")
      .insert({ profile_id: studentAProfileId, student_id: `ENR-A-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();
    studentARowId = studentARow!.id;

    const { data: studentBRow } = await admin
      .from("students")
      .insert({ profile_id: studentBProfileId, student_id: `ENR-B-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();
    studentBRowId = studentBRow!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id").single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `ENR-${stamp}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id").single();
    courseId = course!.id;

    const { data: offering } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id").single();
    offeringId = offering!.id;
  });

  it("lets an admin insert and select an enrollment", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("enrollments")
      .insert({ student_id: studentARowId, offering_id: offeringId })
      .select("id").single();
    expect(insertError).toBeNull();
    enrollmentId = inserted!.id;

    const { data: selected } = await client.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle();
    expect(selected?.id).toBe(enrollmentId);
  });

  it("lets the enrolled student select their own enrollment", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const { data, error } = await client.from("enrollments").select("*").eq("id", enrollmentId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("returns empty results (not an error) to a different student", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentBEmail, password });

    const { data, error } = await client.from("enrollments").select("*").eq("id", enrollmentId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies a student's insert attempt", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const insertAttempt = await client
      .from("enrollments")
      .insert({ student_id: studentBRowId, offering_id: offeringId });
    expect(insertAttempt.error).not.toBeNull();
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("enrollments").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentAProfileId);
    await admin.auth.admin.deleteUser(studentBProfileId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});

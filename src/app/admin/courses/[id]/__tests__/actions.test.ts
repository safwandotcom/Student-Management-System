// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { updateCourse, createOffering, enrollStudent } from "../actions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// See src/lib/auth/__tests__/require-admin.test.ts for the rationale behind
// this in-memory cookie-jar mock of next/headers.
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  }),
}));

async function signInAs(email: string, password: string) {
  cookieJar.clear();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value));
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

describe("updateCourse and createOffering authorization", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string, lecturerProfileId: string, lecturerRowId: string;
  let adminEmail: string, studentEmail: string, lecturerEmail: string;
  let courseId: string;
  let offeringId: string, studentRowId: string;
  const originalTitle = "Original Title";

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `course-detail-actions-admin-${stamp}@example.com`;
    studentEmail = `course-detail-actions-student-${stamp}@example.com`;
    lecturerEmail = `course-detail-actions-lecturer-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { full_name: "Course Detail Actions - Admin" },
    });
    const s = await admin.auth.admin.createUser({
      email: studentEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "student" },
      user_metadata: { full_name: "Course Detail Actions - Student" },
    });
    const l = await admin.auth.admin.createUser({
      email: lecturerEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "lecturer" },
      user_metadata: { full_name: "Course Detail Actions - Lecturer" },
    });
    adminId = a.data.user!.id;
    studentId = s.data.user!.id;
    lecturerProfileId = l.data.user!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id")
      .single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `ACT-${stamp}`, title: originalTitle, credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    courseId = course!.id;

    const { data: offering } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: `ENROLL-TERM-${stamp}` })
      .select("id")
      .single();
    offeringId = offering!.id;

    const { data: studentRow } = await admin
      .from("students")
      .insert({ profile_id: studentId, student_id: `S-${stamp}`, program: "CS", batch: "2026" })
      .select("id")
      .single();
    studentRowId = studentRow!.id;
  });

  it("updateCourse rejects a non-admin caller and changes nothing", async () => {
    await signInAs(studentEmail, password);
    const formData = new FormData();
    formData.set("id", courseId);
    formData.set("title", "Hijacked Title");
    formData.set("credits", "5");
    formData.set("semester", "Spring");
    formData.set("department", "Math");

    const result = await updateCourse({ error: null }, formData);
    expect(result.error).toBe("Admin access required.");

    const { data } = await admin.from("courses").select("title").eq("id", courseId).single();
    expect(data!.title).toBe(originalTitle);
  });

  it("createOffering rejects a non-admin caller and writes nothing", async () => {
    await signInAs(studentEmail, password);
    const term = `AUTH-TEST-TERM-${Date.now()}`;
    const formData = new FormData();
    formData.set("course_id", courseId);
    formData.set("lecturer_id", lecturerRowId);
    formData.set("term", term);

    const result = await createOffering({ error: null }, formData);
    expect(result.error).toBe("Admin access required.");

    const { data } = await admin
      .from("course_offerings")
      .select("id")
      .eq("course_id", courseId)
      .eq("term", term);
    expect(data).toEqual([]);
  });

  it("enrollStudent rejects a non-admin caller and writes nothing", async () => {
    await signInAs(studentEmail, password);
    const formData = new FormData();
    formData.set("course_id", courseId);
    formData.set("offering_id", offeringId);
    formData.set("student_id", studentRowId);

    const result = await enrollStudent({ error: null }, formData);
    expect(result.error).toBe("Admin access required.");

    const { data } = await admin
      .from("enrollments")
      .select("id")
      .eq("offering_id", offeringId);
    expect(data).toEqual([]);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});

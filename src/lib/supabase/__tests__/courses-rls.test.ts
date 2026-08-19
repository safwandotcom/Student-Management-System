// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("courses RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string;
  let adminEmail: string, studentEmail: string;
  let courseId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `courses-rls-admin-${stamp}@example.com`;
    studentEmail = `courses-rls-student-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stu = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student One" },
    });
    adminId = adm.data.user!.id;
    studentId = stu.data.user!.id;
  });

  it("lets an admin insert, select, and update a course", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("courses")
      .insert({ code: `RLS-${Date.now()}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    courseId = inserted!.id;

    const { data: selected } = await client.from("courses").select("*").eq("id", courseId).maybeSingle();
    expect(selected?.id).toBe(courseId);

    const { data: updated } = await client
      .from("courses")
      .update({ credits: 4 })
      .eq("id", courseId)
      .select("credits");
    expect(updated?.[0]?.credits).toBe(4);
  });

  it("returns empty results (not an error) to a non-admin authenticated user", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentEmail, password });

    const { data, error } = await client.from("courses").select("*").eq("id", courseId);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const insertAttempt = await client
      .from("courses")
      .insert({ code: `RLS-STUDENT-${Date.now()}`, title: "X", credits: 1, semester: "Fall", department: "X" });
    expect(insertAttempt.error).not.toBeNull();
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("courses").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("students RLS", () => {
  const password = "TestPassword123!";
  let studentAId: string, studentBId: string, adminId: string;
  let studentARowId: string;
  let studentAEmail: string, studentBEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    studentAEmail = `students-rls-a-${stamp}@example.com`;
    studentBEmail = `students-rls-b-${stamp}@example.com`;
    adminEmail = `students-rls-admin-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student A" },
    });
    const b = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student B" },
    });
    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    studentAId = a.data.user!.id;
    studentBId = b.data.user!.id;
    adminId = adm.data.user!.id;

    const { data: studentRow } = await admin
      .from("students")
      .insert({ profile_id: studentAId, student_id: `RLS-A-${stamp}`, program: "BBA", batch: "9th" })
      .select("id")
      .single();
    studentARowId = studentRow!.id;

    await admin
      .from("students")
      .insert({ profile_id: studentBId, student_id: `RLS-B-${stamp}`, program: "BBA", batch: "9th" });
  });

  it("lets a student read their own row but not another student's", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const own = await client.from("students").select("*").eq("profile_id", studentAId).maybeSingle();
    expect(own.data?.profile_id).toBe(studentAId);

    const other = await client.from("students").select("*").eq("profile_id", studentBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("does not let a student insert or update a students row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const insertAttempt = await client
      .from("students")
      .insert({ profile_id: studentAId, student_id: "SELF-INSERT", program: "X", batch: "Y" });
    expect(insertAttempt.error).not.toBeNull();

    const updateAttempt = await client
      .from("students")
      .update({ program: "Hacked" })
      .eq("id", studentARowId)
      .select("id");
    expect(updateAttempt.data ?? []).toHaveLength(0);
  });

  it("lets an admin read and insert/update any row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: all } = await client.from("students").select("*").in("profile_id", [studentAId, studentBId]);
    expect(all).toHaveLength(2);

    const { data: updated } = await client
      .from("students")
      .update({ batch: "10th" })
      .eq("id", studentARowId)
      .select("batch");
    expect(updated?.[0]?.batch).toBe("10th");
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    // There is no legitimate use case for anonymous access to students, so
    // (unlike authenticated/service_role) anon gets no table-level GRANT at
    // all. Postgres rejects the query before RLS is even evaluated — a
    // flat permission error, not an empty-but-successful result. This is a
    // stricter guarantee than "RLS filters to zero rows" and is deliberate.
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("students").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(studentAId);
    await admin.auth.admin.deleteUser(studentBId);
    await admin.auth.admin.deleteUser(adminId);
  });
});

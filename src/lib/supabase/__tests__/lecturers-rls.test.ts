// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("lecturers RLS", () => {
  const password = "TestPassword123!";
  let lecturerAId: string, lecturerBId: string, adminId: string;
  let lecturerARowId: string;
  let lecturerAEmail: string, lecturerBEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    lecturerAEmail = `lecturers-rls-a-${stamp}@example.com`;
    lecturerBEmail = `lecturers-rls-b-${stamp}@example.com`;
    adminEmail = `lecturers-rls-admin-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: lecturerAEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer A" },
    });
    const b = await admin.auth.admin.createUser({
      email: lecturerBEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer B" },
    });
    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin Two" },
    });
    lecturerAId = a.data.user!.id;
    lecturerBId = b.data.user!.id;
    adminId = adm.data.user!.id;

    const { data: row } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerAId, department: "Marketing", designation: "Assistant Professor" })
      .select("id")
      .single();
    lecturerARowId = row!.id;

    await admin
      .from("lecturers")
      .insert({ profile_id: lecturerBId, department: "Finance", designation: "Lecturer" });
  });

  it("lets a lecturer read their own row but not another lecturer's", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: lecturerAEmail, password });

    const own = await client.from("lecturers").select("*").eq("profile_id", lecturerAId).maybeSingle();
    expect(own.data?.profile_id).toBe(lecturerAId);

    const other = await client.from("lecturers").select("*").eq("profile_id", lecturerBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("does not let a lecturer insert or update a lecturers row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: lecturerAEmail, password });

    const insertAttempt = await client
      .from("lecturers")
      .insert({ profile_id: lecturerAId, department: "X", designation: "Y" });
    expect(insertAttempt.error).not.toBeNull();

    const updateAttempt = await client
      .from("lecturers")
      .update({ department: "Hacked" })
      .eq("id", lecturerARowId)
      .select("id");
    expect(updateAttempt.data ?? []).toHaveLength(0);
  });

  it("lets an admin read and insert/update any row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: all } = await client.from("lecturers").select("*").in("profile_id", [lecturerAId, lecturerBId]);
    expect(all).toHaveLength(2);

    const { data: updated } = await client
      .from("lecturers")
      .update({ designation: "Associate Professor" })
      .eq("id", lecturerARowId)
      .select("designation");
    expect(updated?.[0]?.designation).toBe("Associate Professor");
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    // There is no legitimate use case for anonymous access to lecturers, so
    // (unlike authenticated/service_role) anon gets no table-level GRANT at
    // all. Postgres rejects the query before RLS is even evaluated — a
    // flat permission error, not an empty-but-successful result. This is a
    // stricter guarantee than "RLS filters to zero rows" and is deliberate.
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("lecturers").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(lecturerAId);
    await admin.auth.admin.deleteUser(lecturerBId);
    await admin.auth.admin.deleteUser(adminId);
  });
});

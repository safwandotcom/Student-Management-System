// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("profiles RLS", () => {
  let studentAId: string, studentBId: string, adminId: string;
  const password = "TestPassword123!";
  let studentAEmail: string, studentBEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    studentAEmail = `rls-a-${stamp}@example.com`;
    studentBEmail = `rls-b-${stamp}@example.com`;
    adminEmail = `rls-admin-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      user_metadata: { full_name: "Student A", role: "student" },
    });
    const b = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      user_metadata: { full_name: "Student B", role: "student" },
    });
    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      user_metadata: { full_name: "Admin One" },
      app_metadata: { role: "admin" },
    });
    studentAId = a.data.user!.id;
    studentBId = b.data.user!.id;
    adminId = adm.data.user!.id;
  });

  it("lets a student read their own profile but not another student's", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const own = await client.from("profiles").select("*").eq("id", studentAId).single();
    expect(own.error).toBeNull();
    expect(own.data?.id).toBe(studentAId);

    const other = await client.from("profiles").select("*").eq("id", studentBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("lets an admin read every profile", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data, error } = await client
      .from("profiles")
      .select("*")
      .in("id", [studentAId, studentBId, adminId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("blocks public self-signup entirely now that enable_signup is disabled", async () => {
    // Primary fix: the anon-key signup endpoint is disabled project-wide, so
    // nobody can create ANY account (let alone an admin one) without going
    // through the admin-provisioned flow.
    const client = createClient(url, anonKey);
    const email = `signup-probe-${Date.now()}@example.com`;
    const { data, error } = await client.auth.signUp({
      email,
      password: "TestPassword123!",
      options: { data: { full_name: "Signup Probe", role: "admin" } },
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("ignores a client-supplied role in user_metadata, even via privileged creation", async () => {
    // Defense-in-depth: the handle_new_user() trigger must source `role`
    // only from raw_app_meta_data (service-role/admin-API-writable), never
    // from raw_user_meta_data (client-writable). This holds independently of
    // enable_signup, so it still protects an invite-flow re-enabling signup
    // later (phase 2).
    const email = `trigger-probe-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { full_name: "Trigger Probe", role: "admin" }, // no app_metadata.role set
    });
    expect(error).toBeNull();
    const userId = data.user!.id;

    const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
    expect(profile?.role).toBe("student"); // NOT "admin" — trigger must not trust user_metadata

    await admin.auth.admin.deleteUser(userId);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(studentAId);
    await admin.auth.admin.deleteUser(studentBId);
    await admin.auth.admin.deleteUser(adminId);
  });
});

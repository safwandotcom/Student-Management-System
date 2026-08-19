// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { updateProfileStatus } from "../status";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("updateProfileStatus", () => {
  const password = "TestPassword123!";
  let studentId: string, adminId: string;
  let studentEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    studentEmail = `status-student-${stamp}@example.com`;
    adminEmail = `status-admin-${stamp}@example.com`;

    const s = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Status Student" },
    });
    const a = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Status Admin" },
    });
    studentId = s.data.user!.id;
    adminId = a.data.user!.id;
  });

  it("lets an admin deactivate a student", async () => {
    const adminClient = createClient(url, anonKey);
    await adminClient.auth.signInWithPassword({ email: adminEmail, password });

    await updateProfileStatus(adminClient, studentId, "inactive");

    const { data } = await admin.from("profiles").select("status").eq("id", studentId).single();
    expect(data?.status).toBe("inactive");
  });

  it("throws and does not change status when a student tries to change their own status", async () => {
    const studentClient = createClient(url, anonKey);
    await studentClient.auth.signInWithPassword({ email: studentEmail, password });

    await expect(updateProfileStatus(studentClient, studentId, "active")).rejects.toThrow();

    const { data } = await admin.from("profiles").select("status").eq("id", studentId).single();
    expect(data?.status).toBe("inactive"); // unchanged by the rejected attempt
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(studentId);
    await admin.auth.admin.deleteUser(adminId);
  });
});

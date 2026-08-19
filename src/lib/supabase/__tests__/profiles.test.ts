// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe("profiles auto-create trigger", () => {
  let createdUserId: string;

  it("creates a matching profile row when a new auth user is created", async () => {
    const email = `trigger-test-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { full_name: "Trigger Test", role: "student" },
    });
    expect(error).toBeNull();
    createdUserId = data.user!.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", createdUserId)
      .single();

    expect(profileError).toBeNull();
    expect(profile).toMatchObject({
      id: createdUserId,
      full_name: "Trigger Test",
      role: "student",
      status: "active",
    });
  });

  afterAll(async () => {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
  });
});

// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { seedAdmin } from "../seed-admin";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe("seedAdmin", () => {
  const email = `seed-admin-test-${Date.now()}@example.com`;
  let userId: string;

  it("creates a user with an admin profile", async () => {
    const result = await seedAdmin(email, "TestPassword123!", "Seed Admin");
    userId = result.id;

    const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();
    expect(profile).toMatchObject({ full_name: "Seed Admin", role: "admin" });
  });

  it("is idempotent: calling it again with the same email does not error", async () => {
    await expect(seedAdmin(email, "TestPassword123!", "Seed Admin")).resolves.toBeDefined();
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });
});

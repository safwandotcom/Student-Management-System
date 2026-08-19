// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { inviteUser } from "../invite";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe("inviteUser", () => {
  let userId: string;

  it("creates an invited user whose profile role comes from app_metadata", async () => {
    const email = `invite-test-${Date.now()}@example.com`;
    const result = await inviteUser(email, "Invite Test", "lecturer");
    userId = result.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, role, status")
      .eq("id", userId)
      .single();

    expect(profile).toMatchObject({
      full_name: "Invite Test",
      role: "lecturer",
      status: "active",
    });
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });
});

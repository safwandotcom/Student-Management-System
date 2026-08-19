// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { requireAdmin, NotAuthorizedError } from "../require-admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// `createServerSupabaseClient()` reads the session via next/headers `cookies()`,
// which throws "called outside a request scope" when invoked from a plain
// script/test with no active Next.js request. We mock next/headers with an
// in-memory cookie jar so requireAdmin() can be exercised directly, and reuse
// the real @supabase/ssr cookie serialization (via a second server client
// pointed at the same jar) to populate it — this covers the "no session" case
// too, since the jar simply starts empty.
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

function clearSession() {
  cookieJar.clear();
}

describe("requireAdmin", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string;
  let adminEmail: string, studentEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `require-admin-admin-${stamp}@example.com`;
    studentEmail = `require-admin-student-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { full_name: "Require Admin - Admin" },
    });
    const s = await admin.auth.admin.createUser({
      email: studentEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "student" },
      user_metadata: { full_name: "Require Admin - Student" },
    });
    adminId = a.data.user!.id;
    studentId = s.data.user!.id;
  });

  it("resolves with the caller's id for an active admin session", async () => {
    await signInAs(adminEmail, password);
    const result = await requireAdmin();
    expect(result.id).toBe(adminId);
  });

  it("throws NotAuthorizedError for an active student session", async () => {
    await signInAs(studentEmail, password);
    await expect(requireAdmin()).rejects.toThrow(NotAuthorizedError);
  });

  it("throws NotAuthorizedError when there is no session", async () => {
    clearSession();
    await expect(requireAdmin()).rejects.toThrow(NotAuthorizedError);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
  });
});

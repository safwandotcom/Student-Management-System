// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createCourse } from "../actions";

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

function clearSession() {
  cookieJar.clear();
}

describe("createCourse authorization", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string;
  let adminEmail: string, studentEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `create-course-admin-${stamp}@example.com`;
    studentEmail = `create-course-student-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { full_name: "Create Course - Admin" },
    });
    const s = await admin.auth.admin.createUser({
      email: studentEmail,
      password,
      email_confirm: true,
      app_metadata: { role: "student" },
      user_metadata: { full_name: "Create Course - Student" },
    });
    adminId = a.data.user!.id;
    studentId = s.data.user!.id;
  });

  it("rejects a non-admin caller and writes nothing", async () => {
    await signInAs(studentEmail, password);
    const formData = new FormData();
    formData.set("code", `AUTH-TEST-${Date.now()}`);
    formData.set("title", "Should Not Be Created");
    formData.set("credits", "3");
    formData.set("semester", "Fall");
    formData.set("department", "CS");

    const result = await createCourse({ error: null }, formData);
    expect(result.error).toBe("Admin access required.");

    const { data } = await admin.from("courses").select("id").eq("code", formData.get("code"));
    expect(data).toEqual([]);
  });

  it("rejects an unauthenticated caller and writes nothing", async () => {
    clearSession();
    const formData = new FormData();
    formData.set("code", `AUTH-TEST-NOSESSION-${Date.now()}`);
    formData.set("title", "Should Not Be Created");
    formData.set("credits", "3");
    formData.set("semester", "Fall");
    formData.set("department", "CS");

    const result = await createCourse({ error: null }, formData);
    expect(result.error).toBe("Admin access required.");

    const { data } = await admin.from("courses").select("id").eq("code", formData.get("code"));
    expect(data).toEqual([]);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
  });
});

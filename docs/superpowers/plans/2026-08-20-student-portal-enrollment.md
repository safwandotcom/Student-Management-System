# Enrollment + Student Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing Enrollment piece (admin enrolls a student into a course offering) and the Student portal shell (dashboard, courses, profile — real data; attendance/results/fees/tickets — "coming soon" placeholders).

**Architecture:** New `enrollments` table linking `students` to `course_offerings`. Three new scoped RLS `select` policies (on `course_offerings`, `courses`, `profiles`) let a student read exactly the courses/offerings/lecturer-names their own enrollments reference — nothing else. Admin enrolls from the existing course detail page (nested under each offering, mirroring how offerings themselves are added under a course). The Student portal (`/student/*`) is a structural copy of the Admin portal's layout/guard pattern, unused since Foundation.

**Tech Stack:** Next.js 16.3.1 (App Router, TypeScript, Tailwind CSS v4), Supabase (Postgres + Auth), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-student-portal-design.md` (and its parent, `docs/superpowers/specs/2026-08-19-student-management-system-design.md`)

## Global Constraints

- `requireAdmin()` (`src/lib/auth/require-admin.ts`) must be the literal first statement in every mutating Server Action. No exceptions — this is the single most important rule in this codebase, enforced by two prior CRITICAL findings.
- RLS recipe for every new/changed table: `enable row level security` → explicit per-command `create policy` (never bare `for all`) → grants scoped to exactly the verbs with policies, to `authenticated` and `service_role` only, never `anon`. This local (non-hosted) Supabase stack does NOT auto-grant table privileges to `authenticated` or `service_role` — every new table needs explicit `GRANT` statements to both.
- `revalidatePath` imports from `"next/cache"`, never `"next/navigation"`.
- Enrollment is admin-only, create-only (no edit/delete), no capacity limit — see the spec's Enrollment section for the reasoning. Do not add any of these; they were explicitly deferred.
- Student Profile page is read-only in this phase. Do not add an edit form.
- Attendance/Results/Fees & Payments/Support Tickets get placeholder "coming soon" pages only — no tables, no queries, no real functionality for any of the four.
- Migration file numbering continues from `00000000000008` (the last migration on `main`, from the Courses & Offerings phase's fix wave). This plan's migrations are `00000000000009` and `00000000000010`.
- Use the PowerShell tool for `npm`/`npx`/`supabase` commands — the Bash tool's `npx`/`npm` frequently fails on this Windows environment with a `'"node"' is not recognized` error.

---

### Task 1: `enrollments` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000009_enrollments.sql`
- Test: `src/lib/supabase/__tests__/enrollments-rls.test.ts`

**Interfaces:**
- Consumes: `public.students(id)`, `public.course_offerings(id)` (both exist on `main`).
- Produces: `public.enrollments(id, student_id, offering_id, created_at)` — Task 3 (enroll action) inserts into this table; Task 6/7 (Dashboard/Courses pages) select from it.

- [ ] **Step 1: Write the migration**

```sql
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, offering_id)
);

alter table public.enrollments enable row level security;

create policy "enrollments: admin select all"
  on public.enrollments for select
  using (public.current_user_role() = 'admin');

create policy "enrollments: admin insert"
  on public.enrollments for insert
  with check (public.current_user_role() = 'admin');

create policy "enrollments: student select own"
  on public.enrollments for select
  using (
    student_id in (select id from public.students where profile_id = auth.uid())
  );

-- No update/delete policy or grant: enrollments are created, not edited, in
-- this plan (mirrors course_offerings' own create-only decision).
grant select, insert on public.enrollments to authenticated;
grant select, insert, update, delete on public.enrollments to service_role;
```

Apply it: `npx supabase migration up` (use the PowerShell tool). Confirm local Supabase is running first with `npx supabase status`; if not, `npx supabase start`.

- [ ] **Step 2: Write the RLS test**

Follow the exact structure of `src/lib/supabase/__tests__/course-offerings-rls.test.ts` (read it first — this is your template for fixture setup, `beforeAll`/`afterAll`, and the anon/non-owner-denial assertions). Your fixtures need: one admin user, one student user (with a `students` row), a second student user (with a `students` row, to prove students can't read each other's enrollments), a lecturer (with a `lecturers` row), a course, and a course offering.

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("enrollments RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentAProfileId: string, studentARowId: string, studentBProfileId: string, studentBRowId: string;
  let lecturerProfileId: string, lecturerRowId: string, courseId: string, offeringId: string;
  let adminEmail: string, studentAEmail: string, studentBEmail: string, lecturerEmail: string;
  let enrollmentId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `enroll-rls-admin-${stamp}@example.com`;
    studentAEmail = `enroll-rls-student-a-${stamp}@example.com`;
    studentBEmail = `enroll-rls-student-b-${stamp}@example.com`;
    lecturerEmail = `enroll-rls-lecturer-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stuA = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student A" },
    });
    const stuB = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student B" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer One" },
    });
    adminId = adm.data.user!.id;
    studentAProfileId = stuA.data.user!.id;
    studentBProfileId = stuB.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: studentARow } = await admin
      .from("students")
      .insert({ profile_id: studentAProfileId, student_id: `ENR-A-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();
    studentARowId = studentARow!.id;

    const { data: studentBRow } = await admin
      .from("students")
      .insert({ profile_id: studentBProfileId, student_id: `ENR-B-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();
    studentBRowId = studentBRow!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id").single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `ENR-${stamp}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id").single();
    courseId = course!.id;

    const { data: offering } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id").single();
    offeringId = offering!.id;
  });

  it("lets an admin insert and select an enrollment", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("enrollments")
      .insert({ student_id: studentARowId, offering_id: offeringId })
      .select("id").single();
    expect(insertError).toBeNull();
    enrollmentId = inserted!.id;

    const { data: selected } = await client.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle();
    expect(selected?.id).toBe(enrollmentId);
  });

  it("lets the enrolled student select their own enrollment", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const { data, error } = await client.from("enrollments").select("*").eq("id", enrollmentId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("returns empty results (not an error) to a different student", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentBEmail, password });

    const { data, error } = await client.from("enrollments").select("*").eq("id", enrollmentId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies a student's insert attempt", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const insertAttempt = await client
      .from("enrollments")
      .insert({ student_id: studentBRowId, offering_id: offeringId });
    expect(insertAttempt.error).not.toBeNull();
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("enrollments").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentAProfileId);
    await admin.auth.admin.deleteUser(studentBProfileId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});
```

- [ ] **Step 3: Run the test**

`npm test -- enrollments-rls` (via PowerShell). Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000009_enrollments.sql src/lib/supabase/__tests__/enrollments-rls.test.ts
git commit -m "feat: add enrollments table with row level security"
```

---

### Task 2: Student-scoped read policies on `course_offerings`, `courses`, `profiles`

**Files:**
- Create: `supabase/migrations/00000000000010_student_scoped_reads.sql`
- Test: `src/lib/supabase/__tests__/student-scoped-reads-rls.test.ts`

**Interfaces:**
- Consumes: `public.enrollments` (Task 1). This task's migration references `enrollments` in its policy subqueries, so it must run after Task 1's migration.
- Produces: student-readable `course_offerings`/`courses`/`profiles` rows, scoped to the student's own enrollments. Task 7 (Student Courses page) depends on these policies existing.

- [ ] **Step 1: Write the migration**

These are additive policies — do not modify or remove any existing policy on these three tables. Each table already has its own `enable row level security` and existing `admin select all` policy from prior migrations; you're adding one more `select` policy per table, plus (only where the current grant doesn't already cover it) no new grant is needed — `authenticated` already has `select` granted on all three tables from their original migrations, so this migration adds policies only, no `grant` statements.

```sql
-- A student can see a course_offering if one of their own enrollment rows
-- references it.
create policy "course_offerings: student select enrolled"
  on public.course_offerings for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.offering_id = course_offerings.id
        and s.profile_id = auth.uid()
    )
  );

-- A student can see a course if one of their enrolled offerings references it.
create policy "courses: student select enrolled"
  on public.courses for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      join public.course_offerings co on co.id = e.offering_id
      where co.course_id = courses.id
        and s.profile_id = auth.uid()
    )
  );

-- A student can see a lecturer's profile row (for full_name) if that
-- lecturer teaches one of their enrolled offerings. This is the only new
-- policy on profiles itself — its existing "read own row" and "admin reads
-- all" policies are untouched.
create policy "profiles: student select enrolled lecturer"
  on public.profiles for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      join public.course_offerings co on co.id = e.offering_id
      join public.lecturers l on l.id = co.lecturer_id
      where l.profile_id = profiles.id
        and s.profile_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply it**

`npx supabase migration up` (PowerShell). Confirm local Supabase is running first.

- [ ] **Step 3: Write the test**

Follow the same fixture pattern as Task 1's test (read `src/lib/supabase/__tests__/enrollments-rls.test.ts` after Task 1 completes — reuse its exact fixture setup style). Build fixtures for: an admin, a student enrolled in one offering, a second unrelated student (to prove they can't see the first student's offering/course/lecturer), a lecturer teaching the offering, a course, an offering, and an enrollment row linking the first student to that offering.

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("student-scoped reads RLS (courses, course_offerings, profiles)", () => {
  const password = "TestPassword123!";
  let enrolledStudentProfileId: string, otherStudentProfileId: string, lecturerProfileId: string;
  let enrolledStudentEmail: string, otherStudentEmail: string, lecturerEmail: string;
  let courseId: string, offeringId: string, lecturerRowId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    enrolledStudentEmail = `scoped-reads-enrolled-${stamp}@example.com`;
    otherStudentEmail = `scoped-reads-other-${stamp}@example.com`;
    lecturerEmail = `scoped-reads-lecturer-${stamp}@example.com`;

    const enrolled = await admin.auth.admin.createUser({
      email: enrolledStudentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Enrolled Student" },
    });
    const other = await admin.auth.admin.createUser({
      email: otherStudentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Other Student" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Scoped Reads Lecturer" },
    });
    enrolledStudentProfileId = enrolled.data.user!.id;
    otherStudentProfileId = other.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: enrolledStudentRow } = await admin
      .from("students")
      .insert({ profile_id: enrolledStudentProfileId, student_id: `SCOPED-A-${stamp}`, program: "CS", batch: "2026" })
      .select("id").single();

    await admin
      .from("students")
      .insert({ profile_id: otherStudentProfileId, student_id: `SCOPED-B-${stamp}`, program: "CS", batch: "2026" });

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id").single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `SCOPED-${stamp}`, title: "Scoped Reads Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id").single();
    courseId = course!.id;

    const { data: offering } = await admin
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id").single();
    offeringId = offering!.id;

    await admin.from("enrollments").insert({ student_id: enrolledStudentRow!.id, offering_id: offeringId });
  });

  it("lets the enrolled student read the offering, its course, and the lecturer's profile", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: enrolledStudentEmail, password });

    const { data: offering, error: offeringError } = await client
      .from("course_offerings").select("*").eq("id", offeringId);
    expect(offeringError).toBeNull();
    expect(offering).toHaveLength(1);

    const { data: course, error: courseError } = await client
      .from("courses").select("*").eq("id", courseId);
    expect(courseError).toBeNull();
    expect(course).toHaveLength(1);

    const { data: lecturerProfile, error: profileError } = await client
      .from("profiles").select("*").eq("id", lecturerProfileId);
    expect(profileError).toBeNull();
    expect(lecturerProfile).toHaveLength(1);
  });

  it("returns empty results (not an error) to an unrelated student", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: otherStudentEmail, password });

    const { data: offering } = await client.from("course_offerings").select("*").eq("id", offeringId);
    expect(offering).toEqual([]);

    const { data: course } = await client.from("courses").select("*").eq("id", courseId);
    expect(course).toEqual([]);

    const { data: lecturerProfile } = await client.from("profiles").select("*").eq("id", lecturerProfileId);
    expect(lecturerProfile).toEqual([]);
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(enrolledStudentProfileId);
    await admin.auth.admin.deleteUser(otherStudentProfileId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});
```

- [ ] **Step 4: Run the test**

`npm test -- student-scoped-reads-rls` (PowerShell). Expected: both tests pass. Also re-run the full suite (`npm test`) to confirm these additive policies didn't change behavior for any existing test (they shouldn't — new policies only grant additional visibility, they never restrict existing paths).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000010_student_scoped_reads.sql src/lib/supabase/__tests__/student-scoped-reads-rls.test.ts
git commit -m "feat: add student-scoped read policies for enrolled courses/offerings/lecturers"
```

---

### Task 3: `enrollStudent` Server Action

**Files:**
- Modify: `src/app/admin/courses/[id]/actions.ts` — add `enrollStudent` alongside the existing `updateCourse` and `createOffering`. Do not modify either existing function; this is a pure addition.
- Test: `src/app/admin/courses/[id]/__tests__/actions.test.ts` — this file already exists (from the Courses & Offerings phase's fix wave) and tests `updateCourse`/`createOffering` authorization. Add a new `describe` block for `enrollStudent` to it, reusing its existing fixtures/helpers where they fit, adding what's new (a second student to enroll, since the existing fixtures may not include one — check the current file first).

**Interfaces:**
- Consumes: `requireAdmin()` from `src/lib/auth/require-admin.ts` (unchanged signature). `public.enrollments` table from Task 1.
- Produces: `enrollStudent(_prevState: { error: string | null }, formData: FormData)` — a Server Action with the same shape as `createOffering`. Task 4 (the UI form) calls this via `useActionState`.

- [ ] **Step 1: Read the existing file**

Read `src/app/admin/courses/[id]/actions.ts` in full before editing — it currently contains `updateCourse` and `createOffering`. Your addition goes at the end of the file, following the exact same shape as `createOffering` (which is your closest template: `requireAdmin()` first, extract+validate `FormData` fields, insert, map a duplicate-constraint error to a friendly message, `revalidatePath`, return `{ error: null }` on success).

- [ ] **Step 2: Add `enrollStudent`**

```ts
export async function enrollStudent(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const offeringId = String(formData.get("offering_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");

  if (!courseId || !offeringId || !studentId) {
    return { error: "Please select a student." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("enrollments")
    .insert({ student_id: studentId, offering_id: offeringId });

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "This student is already enrolled in this offering."
        : error.message,
    };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}
```

Note: `courseId` here is only used for `revalidatePath` — it is NOT a column on `enrollments` (only `student_id` and `offering_id` are), so do not add it to the `.insert({...})` call. This differs from `createOffering`, which does insert `course_id` because `course_id` IS a column on `course_offerings`. Don't let that precedent mislead you into inserting it here — `enrollments` has no `course_id` column at all.

- [ ] **Step 3: Write the authorization test**

Read the existing `src/app/admin/courses/[id]/__tests__/actions.test.ts` in full first — reuse its `cookieJar`/`signInAs`/`admin` client setup and its existing `beforeAll` fixtures (course, lecturer, offering aren't created yet in that file for `enrollStudent`'s purposes — check what's already there and add exactly what's missing: you'll likely need a `course_offerings` row and a `students` row, since the existing fixtures were built for `updateCourse`/`createOffering`, not enrollment). Add:

```ts
it("enrollStudent rejects a non-admin caller and writes nothing", async () => {
  await signInAs(studentEmail, password);
  const formData = new FormData();
  formData.set("course_id", courseId);
  formData.set("offering_id", offeringId); // create this fixture if it doesn't already exist in beforeAll
  formData.set("student_id", /* a students.id fixture — create if missing */ "");

  const result = await enrollStudent({ error: null }, formData);
  expect(result.error).toBe("Admin access required.");

  const { data } = await admin
    .from("enrollments")
    .select("id")
    .eq("offering_id", offeringId);
  expect(data).toEqual([]);
});
```

Adapt the exact fixture wiring to what the file already has after reading it — the shape above is the pattern to match (sign in as non-admin, call the action, assert the generic rejection message, positively confirm via the service-role client that no row was written), not verbatim code to paste blind.

- [ ] **Step 4: Run the tests**

`npm test -- actions.test.ts` scoped to this directory, or the full suite `npm test` (PowerShell). Expected: all pass, including the two existing `describe` blocks in this file (`updateCourse`, `createOffering`) still passing unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/courses/[id]/actions.ts src/app/admin/courses/[id]/__tests__/actions.test.ts
git commit -m "feat: add enrollStudent server action"
```

---

### Task 4: Admin UI — enroll a student from the course detail page

**Files:**
- Create: `src/app/admin/courses/[id]/EnrollStudentForm.tsx`
- Modify: `src/app/admin/courses/[id]/page.tsx` — add an enrolled-students list and the enroll form per offering, plus the query to populate the student picker.

**Interfaces:**
- Consumes: `enrollStudent` from `./actions.ts` (Task 3).
- Produces: nothing new consumed by later tasks — this is UI-only, the end of the admin-side chain.

- [ ] **Step 1: Read the existing files**

Read `src/app/admin/courses/[id]/page.tsx` and `src/app/admin/courses/[id]/AddOfferingForm.tsx` in full — `AddOfferingForm.tsx` is your exact template for `EnrollStudentForm.tsx` (same `useActionState` shape, same `<select>`-plus-hidden-fields pattern), and `page.tsx`'s existing offerings-list `<ul>` and lecturer-query block are your templates for the new enrolled-students list and student-picker query.

- [ ] **Step 2: Write `EnrollStudentForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { enrollStudent } from "./actions";
import { Button } from "@/components/ui/Button";

interface StudentOption {
  id: string;
  full_name: string;
  student_id: string;
}

export function EnrollStudentForm({
  courseId,
  offeringId,
  students,
}: {
  courseId: string;
  offeringId: string;
  students: StudentOption[];
}) {
  const [state, formAction, pending] = useActionState(enrollStudent, { error: null });

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="offering_id" value={offeringId} />
      <div className="flex-1">
        <select
          name="student_id" required aria-label="Select a student to enroll"
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        >
          <option value="">Select a student…</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.student_id} — {student.full_name}
            </option>
          ))}
        </select>
        {state.error && <p className="mt-1 text-sm text-danger-700">{state.error}</p>}
      </div>
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Enroll
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Update `page.tsx`**

Three changes to `src/app/admin/courses/[id]/page.tsx`:

**(a)** Add a students query (mirroring the existing lecturers query — active students only, sorted by name, same `profiles!inner` pattern already used for the lecturer picker after the Courses & Offerings phase's fix wave):

```ts
interface StudentOption {
  id: string;
  student_id: string;
  profiles: { full_name: string; status: string } | null;
}

// ...alongside the existing lecturers query:
const { data: studentsData } = await supabase
  .from("students")
  .select("id, student_id, profiles!inner(full_name, status)")
  .eq("profiles.status", "active")
  .order("profiles(full_name)", { ascending: true });
const studentOptions = ((studentsData ?? []) as unknown as StudentOption[]).map((student) => ({
  id: student.id,
  student_id: student.student_id,
  full_name: student.profiles?.full_name ?? "Unknown",
}));
```

**(b)** Extend the offerings query to also fetch each offering's enrolled students:

```ts
interface OfferingRow {
  id: string;
  term: string;
  lecturers: { profiles: { full_name: string } | null } | null;
  enrollments: { id: string; students: { student_id: string; profiles: { full_name: string } | null } | null }[];
}

// change the existing offerings select to:
const { data: offeringsData } = await supabase
  .from("course_offerings")
  .select("id, term, lecturers(profiles(full_name)), enrollments(id, students(student_id, profiles(full_name)))")
  .eq("course_id", id)
  .order("term", { ascending: false });
```

**(c)** In the offerings `<ul>`, under each offering's existing lecturer/term row, add the enrolled-students list and the `EnrollStudentForm`:

```tsx
{offerings.map((offering) => (
  <li key={offering.id} className="space-y-2 py-3">
    <div className="flex items-center justify-between">
      <span className="text-ink-900">{offering.lecturers?.profiles?.full_name ?? "Unknown lecturer"}</span>
      <span className="text-ink-500">{offering.term}</span>
    </div>
    {offering.enrollments.length > 0 && (
      <ul className="ml-4 space-y-1 text-xs text-ink-500">
        {offering.enrollments.map((enrollment) => (
          <li key={enrollment.id}>
            {enrollment.students?.student_id} — {enrollment.students?.profiles?.full_name ?? "Unknown student"}
          </li>
        ))}
      </ul>
    )}
    <EnrollStudentForm courseId={course.id} offeringId={offering.id} students={studentOptions} />
  </li>
))}
```

Adjust the surrounding `<ul>`'s `divide-y` styling if needed once you see the rendered result — the existing `flex items-center justify-between py-2` per-`<li>` layout needs to become a `space-y-2 py-3` column layout to fit the added rows, as shown above. Import `EnrollStudentForm` alongside the existing `AddOfferingForm` import at the top of the file.

- [ ] **Step 4: Verify manually**

Run the dev server (`npm run dev`, PowerShell), sign in as admin, open a course with at least one offering, confirm: the student picker lists only active students, enrolling shows the student under that offering immediately (via `revalidatePath`), and attempting to enroll the same student in the same offering twice shows the friendly duplicate message from Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/courses/[id]/EnrollStudentForm.tsx src/app/admin/courses/[id]/page.tsx
git commit -m "feat: add student enrollment UI to course detail page"
```

---

### Task 5: Student portal shell — placeholder pages (layout already exists)

**Plan correction (discovered during Task 3, ruled before this task's dispatch):** `src/app/student/layout.tsx` and `src/app/student/page.tsx` already exist — Foundation built placeholder role-guard layouts and dashboard stubs for all three portals (commits `2bff19f`, `79f5e47`, `e14e07a` on `main`, predating this plan). This was missed when the plan was written. Read `src/app/student/layout.tsx` now: it already does everything this task's Step 1 originally specified — `resolveGuardRedirect(profile, "student")`, the sign-out-on-orphaned-session handling, `PortalShell` with all 7 `NAV_ITEMS` (`Dashboard`, `My Courses`, `Attendance`, `Results`, `Fees & Payments`, `Profile`, `Support Tickets` — note Foundation's version says "My Courses" where this plan originally said "Courses"; that wording difference is cosmetic and not worth changing). **Do not recreate or overwrite this file.** If you read it and find it does NOT already match this description, stop and report NEEDS_CONTEXT rather than guessing — that would mean this correction itself is stale.

`src/app/student/page.tsx` also already exists as a placeholder (a static "Welcome to your Student Dashboard" card) — Task 6 (a later task, not this one) replaces it with real data. Leave it alone in this task.

**Files:**
- Create: `src/components/ui/ComingSoon.tsx`
- Create: `src/app/student/attendance/page.tsx`
- Create: `src/app/student/results/page.tsx`
- Create: `src/app/student/payments/page.tsx`
- Create: `src/app/student/tickets/page.tsx`

**Interfaces:**
- Consumes: nothing new — `src/app/student/layout.tsx` (pre-existing) already provides the guard/nav for every page this task creates.
- Produces: the 4 placeholder pages. Tasks 6/7/8 add real pages (`/student`, `/student/courses`, `/student/profile`) in the same route group — independent files, no dependency on this task's new files.

- [ ] **Step 1: Write the shared `ComingSoon` component**

```tsx
import { Card } from "@/components/ui/Card";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <Card className="space-y-2">
      <h1 className="text-lg font-semibold text-ink-900">{title}</h1>
      <p className="text-sm text-ink-500">{description}</p>
    </Card>
  );
}
```

Save as `src/components/ui/ComingSoon.tsx`.

- [ ] **Step 2: Write the four placeholder pages**

`src/app/student/attendance/page.tsx`:
```tsx
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function AttendancePage() {
  return <ComingSoon title="Attendance" description="Attendance tracking is coming soon." />;
}
```

`src/app/student/results/page.tsx`:
```tsx
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function ResultsPage() {
  return <ComingSoon title="Results" description="Results and grades are coming soon." />;
}
```

`src/app/student/payments/page.tsx`:
```tsx
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function PaymentsPage() {
  return <ComingSoon title="Fees & Payments" description="Fees and payment history are coming soon." />;
}
```

`src/app/student/tickets/page.tsx`:
```tsx
import { ComingSoon } from "@/components/ui/ComingSoon";

export default function TicketsPage() {
  return <ComingSoon title="Support Tickets" description="Support ticket submission is coming soon." />;
}
```

- [ ] **Step 3: Verify manually**

Run the dev server (PowerShell). Sign in as a student (create one via the admin UI if none exists in your local seed data, or check existing seed/fixture data from prior phases). Confirm the sidebar (from the pre-existing layout) shows all 7 items, and each of the 4 new placeholder routes renders its card without error. Confirm signing in as a non-student (e.g. admin) and visiting `/student` redirects away (per `resolveGuardRedirect`), and that an unauthenticated visit to `/student` redirects to `/login` — this behavior is pre-existing (from Foundation's layout), not new, but confirm it still works since it's this task's guard for the 4 new pages too.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ComingSoon.tsx src/app/student/attendance/page.tsx src/app/student/results/page.tsx src/app/student/payments/page.tsx src/app/student/tickets/page.tsx
git commit -m "feat: add student portal placeholder pages for attendance/results/payments/tickets"
```

---

### Task 6: Student Dashboard page

**Plan correction (see Task 5's note):** `src/app/student/page.tsx` already exists as a Foundation-era static placeholder (a "Welcome to your Student Dashboard" card with no queries). This task replaces its content entirely with the real implementation below — read the existing file first, then overwrite it (this is a Modify, not a Create, even though the plan originally listed it as Create).

**Files:**
- Modify: `src/app/student/page.tsx` (replaces the existing placeholder content entirely)

**Interfaces:**
- Consumes: `public.students` (own row, via existing "read own row" policy), `public.enrollments` (own rows, via Task 1's "student select own" policy).
- Produces: nothing consumed by later tasks — leaf page.

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user!.id)
    .single();

  const { count: enrollmentCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentRow?.id ?? "");

  const quickLinks = [
    { label: "Courses", href: "/student/courses", description: `${enrollmentCount ?? 0} enrolled this term` },
    { label: "Attendance", href: "/student/attendance", description: "Coming soon" },
    { label: "Results", href: "/student/results", description: "Coming soon" },
    { label: "Fees & Payments", href: "/student/payments", description: "Coming soon" },
    { label: "Profile", href: "/student/profile", description: "View your details" },
    { label: "Support Tickets", href: "/student/tickets", description: "Coming soon" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-lg font-semibold text-ink-900">Welcome, {profile?.full_name ?? "Student"}</h1>
        <p className="text-sm text-ink-500">
          You are enrolled in {enrollmentCount ?? 0} course{enrollmentCount === 1 ? "" : "s"} this term.
        </p>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition hover:border-brand-300">
              <h2 className="text-sm font-semibold text-ink-900">{link.label}</h2>
              <p className="mt-1 text-sm text-ink-500">{link.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Note: `enrollments`'s `select(..., { count: "exact", head: true })` with `.eq("student_id", ...)` relies on the "student select own" RLS policy from Task 1 — a signed-in student's session can only ever count their own rows regardless of what `student_id` value were passed, since RLS filters the underlying table before the count runs. The `.eq()` here is belt-and-suspenders (also correct), not the actual security boundary.

- [ ] **Step 2: Verify manually**

Sign in as a student with at least one enrollment (from Task 4's manual verification) — confirm the welcome card shows their name and correct enrollment count, and each quick-link card navigates correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/page.tsx
git commit -m "feat: add student dashboard page"
```

---

### Task 7: Student Courses page

**Files:**
- Create: `src/app/student/courses/page.tsx`

**Interfaces:**
- Consumes: `public.enrollments`, `public.course_offerings`, `public.courses`, `public.profiles` — all readable for the student's own enrollments per Tasks 1 and 2's RLS policies.
- Produces: nothing consumed by later tasks — leaf page.

- [ ] **Step 1: Write the page**

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

interface EnrollmentRow {
  id: string;
  course_offerings: {
    term: string;
    courses: { code: string; title: string; credits: number } | null;
    lecturers: { profiles: { full_name: string } | null } | null;
  } | null;
}

export default async function StudentCoursesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user!.id)
    .single();

  const { data } = await supabase
    .from("enrollments")
    .select("id, course_offerings(term, courses(code, title, credits), lecturers(profiles(full_name)))")
    .eq("student_id", studentRow?.id ?? "")
    .order("id", { ascending: true });
  const enrollments = (data ?? []) as unknown as EnrollmentRow[];

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">My Courses</h1>
        <p className="text-sm text-ink-500">Courses you are enrolled in this term.</p>
      </div>
      {enrollments.length === 0 ? (
        <p className="text-sm text-ink-500">You are not enrolled in any courses yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Lecturer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.code ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.title ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.courses?.credits ?? "—"}</td>
                  <td className="px-4 py-3">{enrollment.course_offerings?.term ?? "—"}</td>
                  <td className="px-4 py-3">
                    {enrollment.course_offerings?.lecturers?.profiles?.full_name ?? "Unknown lecturer"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Verify manually**

Sign in as the enrolled student from Task 4's verification — confirm the table shows exactly the course(s) they were enrolled in, with correct code/title/credits/term/lecturer name. Sign in as a different student with no enrollments — confirm the empty-state message.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/courses/page.tsx
git commit -m "feat: add student courses page"
```

---

### Task 8: Student Profile page

**Files:**
- Create: `src/app/student/profile/page.tsx`

**Interfaces:**
- Consumes: `public.profiles` (own row), `public.students` (own row), `supabase.auth.getUser()` (for email — not a `profiles` column, see the spec's note on this).
- Produces: nothing consumed by later tasks — leaf page.

- [ ] **Step 1: Write the page**

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

interface StudentDetail {
  student_id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
}

export default async function StudentProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user!.id)
    .single();

  const { data } = await supabase
    .from("students")
    .select("student_id, program, batch, guardian_name, guardian_phone")
    .eq("profile_id", user!.id)
    .single();
  const student = data as StudentDetail | null;

  const fields: { label: string; value: string }[] = [
    { label: "Full name", value: profile?.full_name ?? "—" },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Phone", value: profile?.phone ?? "—" },
    { label: "Student ID", value: student?.student_id ?? "—" },
    { label: "Program", value: student?.program ?? "—" },
    { label: "Batch", value: student?.batch ?? "—" },
    { label: "Guardian name", value: student?.guardian_name ?? "—" },
    { label: "Guardian phone", value: student?.guardian_phone ?? "—" },
  ];

  return (
    <Card className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">My Profile</h1>
        <p className="text-sm text-ink-500">Your account details.</p>
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{field.label}</dt>
            <dd className="mt-1 text-sm text-ink-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
```

- [ ] **Step 2: Verify manually**

Sign in as a student — confirm all fields render correctly, including email (from the session, not a table query) and guardian fields showing "—" if null.

- [ ] **Step 3: Commit**

```bash
git add src/app/student/profile/page.tsx
git commit -m "feat: add student profile page"
```

---

### Task 9: Final wiring — verification (controller-driven, no code changes)

This task has no implementer — it is performed directly by whoever is running this plan (matches the pattern used at the end of the Admin Courses & Offerings plan).

- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the full `npm test` suite. All must be clean.
- [ ] Live E2E verification with a real browser:
  1. Sign in as admin. Open a course with an offering. Confirm the offerings list shows any previously-enrolled students (from Task 4's manual check) and the student picker only lists active students.
  2. Enroll a fresh student (not previously enrolled) into an offering. Confirm they appear in the offering's enrolled-students list immediately.
  3. Attempt to enroll the same student in the same offering again — confirm the friendly duplicate-rejection message, and confirm the enrolled-students list still shows exactly one row for them (no duplicate).
  4. Sign out, sign in as that newly-enrolled student. Confirm redirect to `/student`.
  5. Dashboard: confirm the welcome card shows their name and "1 course" (or the correct count if they have prior enrollments too), and every quick-link card navigates correctly.
  6. Courses: confirm the table shows exactly their enrolled course(s) with correct code/title/credits/term/lecturer name.
  7. Profile: confirm all fields are correct, including email.
  8. Visit each of the 4 placeholder routes (`/student/attendance`, `/student/results`, `/student/payments`, `/student/tickets`) — confirm each renders its "coming soon" card without error.
  9. Sign out, sign in as a different, unrelated student with no enrollments. Confirm the Dashboard shows "0 courses" and the Courses page shows the empty-state message — proving the RLS scoping from Task 2 actually isolates one student's data from another's, not just that the happy path renders.
- [ ] No code changes in this task — nothing to commit.

---

## Self-review notes

- Spec coverage: Enrollment (Tasks 1, 3, 4), RLS gap-closing (Task 2), Student shell/guard/nav (Task 5), Dashboard/Courses/Profile real data (Tasks 6-8), placeholders (Task 5), live verification (Task 9) — every section of `docs/superpowers/specs/2026-08-20-student-portal-design.md` has a task.
- Type consistency checked: `enrollStudent`'s `FormData` fields (`course_id`, `offering_id`, `student_id`) match what `EnrollStudentForm.tsx` sends via hidden inputs and the `<select name="student_id">`. `StudentOption`/`EnrollmentRow`/`StudentDetail` interface shapes match their actual query selects.
- No placeholders left in task steps — every step has real, complete code.

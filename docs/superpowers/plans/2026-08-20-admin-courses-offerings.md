# Admin: Courses & Offerings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin create/edit Courses and assign Lecturers to them for specific terms (Course Offerings) — the foundation the next plan (Enrollment) builds on, since a student can only be enrolled into an *offering*, not a course directly.

**Architecture:** Two new RLS-protected tables (`courses`, `course_offerings`), admin-only for now (no student/lecturer-facing read policy yet — those get added when the Student/Lecturer portal phases actually need them, not speculatively here). Every mutating Server Action calls the existing `requireAdmin()` helper from its first line, from the start (this was a security fix bolted on after the fact in the previous plan; this plan applies it from day one). `/admin/courses` (list/add) and `/admin/courses/[id]` (edit course + manage its offerings) reuse the `DataTable`, `Card`, `Badge`, `Button` primitives and the pagination helpers already built.

**Tech Stack:** Same as prior phases — Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth) · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-student-management-system-design.md`

## Global Constraints

- Every Server Action that mutates data calls `requireAdmin()` (from `@/lib/auth/require-admin.ts`) as its first statement — Server Actions run independently of page/layout guards (learned the hard way in the previous plan; apply from the start here).
- RLS recipe for every new table: `enable row level security` → explicit per-command `create policy` (no bare `for all`) → `grant` only the verbs with policies, to both `authenticated` (needed since Admin is also just the `authenticated` Postgres role — RLS policies, not grants, are what restrict access to admin) and `service_role` (this local stack doesn't auto-grant either, per the pattern discovered twice already) → no grant to `anon` at all (no legitimate use case) → a test proving admin gets full access, a non-admin authenticated user gets empty results (not an error — RLS filters rows, it doesn't reject the query, since `authenticated` genuinely has the grant), and `anon` gets a hard permission error.
- `course_offerings.lecturer_id` references `lecturers(id)` (the domain entity), not `profiles(id)` directly — matching how `students`/`lecturers` each have their own PK distinct from `profile_id`.
- No "deactivate" concept for courses in this plan — out of scope per spec wording ("create/edit" only).
- Package manager: npm. Local dev backend: Supabase CLI + Docker (already running from prior phases).

---

### Task 1: `courses` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000006_courses.sql`
- Test: `src/lib/supabase/__tests__/courses-rls.test.ts`

**Interfaces:**
- Produces: `public.courses (id uuid pk, code text unique, title text, credits integer, semester text, department text, created_at timestamptz)`, RLS: admin-only select/insert/update.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/courses-rls.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("courses RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string;
  let adminEmail: string, studentEmail: string;
  let courseId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `courses-rls-admin-${stamp}@example.com`;
    studentEmail = `courses-rls-student-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stu = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student One" },
    });
    adminId = adm.data.user!.id;
    studentId = stu.data.user!.id;
  });

  it("lets an admin insert, select, and update a course", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("courses")
      .insert({ code: `RLS-${Date.now()}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    courseId = inserted!.id;

    const { data: selected } = await client.from("courses").select("*").eq("id", courseId).maybeSingle();
    expect(selected?.id).toBe(courseId);

    const { data: updated } = await client
      .from("courses")
      .update({ credits: 4 })
      .eq("id", courseId)
      .select("credits");
    expect(updated?.[0]?.credits).toBe(4);
  });

  it("returns empty results (not an error) to a non-admin authenticated user", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentEmail, password });

    const { data, error } = await client.from("courses").select("*").eq("id", courseId);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const insertAttempt = await client
      .from("courses")
      .insert({ code: `RLS-STUDENT-${Date.now()}`, title: "X", credits: 1, semester: "Fall", department: "X" });
    expect(insertAttempt.error).not.toBeNull();
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("courses").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- courses-rls`
Expected: FAIL — `relation "public.courses" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00000000000006_courses.sql`:

```sql
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  credits integer not null,
  semester text not null,
  department text not null,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "courses: admin select all"
  on public.courses for select
  using (public.current_user_role() = 'admin');

create policy "courses: admin insert"
  on public.courses for insert
  with check (public.current_user_role() = 'admin');

create policy "courses: admin update"
  on public.courses for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Table GRANT is checked before RLS policies. authenticated needs this grant
-- because Admin is also just the authenticated Postgres role — the admin-only
-- policies above are what actually restrict access, not this grant. A
-- non-admin authenticated user's queries succeed at the grant layer but are
-- filtered to zero rows by RLS. service_role needs its own grant too — this
-- local (non-hosted) stack doesn't auto-grant either role by default.
grant select, insert, update on public.courses to authenticated;
grant select, insert, update, delete on public.courses to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase migration up`
Expected: applies with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- courses-rls`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add courses table with row level security

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `course_offerings` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000007_course_offerings.sql`
- Test: `src/lib/supabase/__tests__/course-offerings-rls.test.ts`

**Interfaces:**
- Produces: `public.course_offerings (id uuid pk, course_id uuid fk→courses, lecturer_id uuid fk→lecturers, term text, created_at timestamptz, unique(course_id, lecturer_id, term))`, RLS: admin-only select/insert (no update — offerings aren't edited in this plan, only created).

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/course-offerings-rls.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("course_offerings RLS", () => {
  const password = "TestPassword123!";
  let adminId: string, studentId: string, lecturerProfileId: string, lecturerRowId: string, courseId: string;
  let adminEmail: string, studentEmail: string, lecturerEmail: string;
  let offeringId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    adminEmail = `offerings-rls-admin-${stamp}@example.com`;
    studentEmail = `offerings-rls-student-${stamp}@example.com`;
    lecturerEmail = `offerings-rls-lecturer-${stamp}@example.com`;

    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    const stu = await admin.auth.admin.createUser({
      email: studentEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student One" },
    });
    const lec = await admin.auth.admin.createUser({
      email: lecturerEmail, password, email_confirm: true,
      app_metadata: { role: "lecturer" }, user_metadata: { full_name: "Lecturer One" },
    });
    adminId = adm.data.user!.id;
    studentId = stu.data.user!.id;
    lecturerProfileId = lec.data.user!.id;

    const { data: lecturerRow } = await admin
      .from("lecturers")
      .insert({ profile_id: lecturerProfileId, department: "CS", designation: "Lecturer" })
      .select("id")
      .single();
    lecturerRowId = lecturerRow!.id;

    const { data: course } = await admin
      .from("courses")
      .insert({ code: `OFF-RLS-${stamp}`, title: "Test Course", credits: 3, semester: "Fall", department: "CS" })
      .select("id")
      .single();
    courseId = course!.id;
  });

  it("lets an admin insert and select an offering", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: inserted, error: insertError } = await client
      .from("course_offerings")
      .insert({ course_id: courseId, lecturer_id: lecturerRowId, term: "Fall 2026" })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    offeringId = inserted!.id;

    const { data: selected } = await client.from("course_offerings").select("*").eq("id", offeringId).maybeSingle();
    expect(selected?.id).toBe(offeringId);
  });

  it("returns empty results (not an error) to a non-admin authenticated user", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentEmail, password });

    const { data, error } = await client.from("course_offerings").select("*").eq("id", offeringId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("course_offerings").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminId);
    await admin.auth.admin.deleteUser(studentId);
    await admin.auth.admin.deleteUser(lecturerProfileId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- course-offerings-rls`
Expected: FAIL — `relation "public.course_offerings" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00000000000007_course_offerings.sql`:

```sql
create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id) on delete cascade,
  term text not null,
  created_at timestamptz not null default now(),
  unique (course_id, lecturer_id, term)
);

alter table public.course_offerings enable row level security;

create policy "course_offerings: admin select all"
  on public.course_offerings for select
  using (public.current_user_role() = 'admin');

create policy "course_offerings: admin insert"
  on public.course_offerings for insert
  with check (public.current_user_role() = 'admin');

-- No update policy/grant: offerings are created, not edited, in this plan.
grant select, insert on public.course_offerings to authenticated;
grant select, insert, update, delete on public.course_offerings to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase migration up`
Expected: applies with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- course-offerings-rls`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add course_offerings table with row level security

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Admin Courses — list page

**Files:**
- Create: `src/app/admin/courses/page.tsx`

**Interfaces:**
- Consumes: `parseListParams`, `rangeForPage`, `DEFAULT_PAGE_SIZE`, `DataTable` (all from prior phases), `createServerSupabaseClient`, `Button`, `Card`.
- Produces: nothing new — leaf page. No automated test (mirrors the students/lecturers list pages' precedent).

- [ ] **Step 1: Implement the list page**

Create `src/app/admin/courses/page.tsx`:

```tsx
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface CourseRow {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("courses")
    .select("id, code, title, credits, semester, department", { count: "exact" })
    .order("code", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("code", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as CourseRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Courses</h1>
          <p className="text-sm text-ink-500">Search by course code.</p>
        </div>
        <Link href="/admin/courses/new">
          <Button>Add Course</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/courses"
          searchValue={search}
          searchPlaceholder="Search by course code…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Code", cell: (row) => row.code },
            { header: "Title", cell: (row) => row.title },
            { header: "Credits", cell: (row) => String(row.credits) },
            { header: "Semester", cell: (row) => row.semester },
            { header: "Department", cell: (row) => row.department },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/courses/${row.id}`} className="text-brand-700 hover:underline">
                  View
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run full suite and commit**

Run: `npm test`
Expected: all passing (no new tests, confirm no regressions).

```bash
git add -A
git commit -m "feat: add admin courses list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Admin Courses — add form

**Files:**
- Create: `src/app/admin/courses/new/page.tsx`
- Create: `src/app/admin/courses/new/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin` (from `@/lib/auth/require-admin.ts`), `createServerSupabaseClient`, `Button`, `Card`.

- [ ] **Step 1: Implement the server action**

Create `src/app/admin/courses/new/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function createCourse(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  const credits = Number(creditsRaw);
  if (!code || !title || !creditsRaw || !Number.isFinite(credits) || credits <= 0 || !semester || !department) {
    return { error: "Please fill in all fields with valid values." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("courses").insert({ code, title, credits, semester, department });

  if (error) {
    return { error: error.message.includes("duplicate") ? "A course with this code already exists." : error.message };
  }

  redirect("/admin/courses");
}
```

- [ ] **Step 2: Implement the form page**

Create `src/app/admin/courses/new/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createCourse } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewCoursePage() {
  const [state, formAction, pending] = useActionState(createCourse, { error: null });

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Course</h1>
      <p className="mb-6 text-sm text-ink-500">Create a new course in the catalog.</p>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink-700">
            Course code
          </label>
          <input id="code" name="code" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-700">
            Title
          </label>
          <input id="title" name="title" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="credits" className="mb-1 block text-sm font-medium text-ink-700">
              Credits
            </label>
            <input
              id="credits" name="credits" type="number" min="1" step="1" required
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="semester" className="mb-1 block text-sm font-medium text-ink-700">
              Semester
            </label>
            <input id="semester" name="semester" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input id="department" name="department" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Create Course
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Run full suite, build, and commit**

Run: `npm test` — all passing.
Run: `npm run build` — succeeds.

```bash
git add -A
git commit -m "feat: add admin add-course form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin Courses — detail/edit page

**Files:**
- Create: `src/app/admin/courses/[id]/page.tsx`
- Create: `src/app/admin/courses/[id]/actions.ts`
- Create: `src/app/admin/courses/[id]/EditCourseForm.tsx`

**Interfaces:**
- Produces: `updateCourse(prevState, formData)` — used only by this task's own form; Task 6 adds a sibling `AddOfferingForm`/action to the same page but in its own file.

- [ ] **Step 1: Implement the edit action**

Create `src/app/admin/courses/[id]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function updateCourse(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();

  const credits = Number(creditsRaw);
  if (!id || !title || !creditsRaw || !Number.isFinite(credits) || credits <= 0 || !semester || !department) {
    return { error: "Please fill in all fields with valid values." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ title, credits, semester, department })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or course not found." };

  revalidatePath(`/admin/courses/${id}`);
  return { error: null };
}
```

- [ ] **Step 2: Implement the EditCourseForm client component**

Create `src/app/admin/courses/[id]/EditCourseForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { updateCourse } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableCourse {
  id: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

export function EditCourseForm({ course }: { course: EditableCourse }) {
  const [state, formAction, pending] = useActionState(updateCourse, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={course.id} />
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink-700">
          Title
        </label>
        <input
          id="title" name="title" required defaultValue={course.title}
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="credits" className="mb-1 block text-sm font-medium text-ink-700">
            Credits
          </label>
          <input
            id="credits" name="credits" type="number" min="1" step="1" required defaultValue={course.credits}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="semester" className="mb-1 block text-sm font-medium text-ink-700">
            Semester
          </label>
          <input
            id="semester" name="semester" required defaultValue={course.semester}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
          Department
        </label>
        <input
          id="department" name="department" required defaultValue={course.department}
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Implement the detail page**

Create `src/app/admin/courses/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EditCourseForm } from "./EditCourseForm";

interface CourseDetail {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("courses")
    .select("id, code, title, credits, semester, department")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const course = data as CourseDetail;

  return (
    <Card className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">{course.title}</h1>
        <p className="text-sm text-ink-500">{course.code}</p>
      </div>
      <EditCourseForm course={course} />
    </Card>
  );
}
```

- [ ] **Step 4: Run full suite, build, and commit**

Run: `npm test` — all passing.
Run: `npm run build` — succeeds.

```bash
git add -A
git commit -m "feat: add admin course detail/edit page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Course Offerings — add form + list, on the course detail page

**Files:**
- Modify: `src/app/admin/courses/[id]/page.tsx`
- Create: `src/app/admin/courses/[id]/actions.ts` (already exists from Task 5 — add `createOffering` alongside `updateCourse`)
- Create: `src/app/admin/courses/[id]/AddOfferingForm.tsx`

**Interfaces:**
- Produces: `createOffering(prevState, formData)` — added to the existing `src/app/admin/courses/[id]/actions.ts` file (do not create a second actions file).
- Consumes: `lecturers` table (Admin People Management phase) joined with `profiles(full_name)` for the picker.

- [ ] **Step 1: Add the `createOffering` action**

Modify `src/app/admin/courses/[id]/actions.ts` — add this export alongside the existing `updateCourse` (keep `updateCourse` unchanged):

```typescript
export async function createOffering(_prevState: { error: string | null }, formData: FormData) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Admin access required." };
  }

  const courseId = String(formData.get("course_id") ?? "");
  const lecturerId = String(formData.get("lecturer_id") ?? "");
  const term = String(formData.get("term") ?? "").trim();

  if (!courseId || !lecturerId || !term) {
    return { error: "Please select a lecturer and enter a term." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("course_offerings")
    .insert({ course_id: courseId, lecturer_id: lecturerId, term });

  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "This lecturer is already assigned to this course for this term."
        : error.message,
    };
  }

  revalidatePath(`/admin/courses/${courseId}`);
  return { error: null };
}
```

(`createServerSupabaseClient`, `requireAdmin`, and `revalidatePath` are already imported at the top of this file from Task 5 — no new imports needed beyond what's already there.)

- [ ] **Step 2: Implement the AddOfferingForm client component**

Create `src/app/admin/courses/[id]/AddOfferingForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createOffering } from "./actions";
import { Button } from "@/components/ui/Button";

interface LecturerOption {
  id: string;
  full_name: string;
}

export function AddOfferingForm({ courseId, lecturers }: { courseId: string; lecturers: LecturerOption[] }) {
  const [state, formAction, pending] = useActionState(createOffering, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lecturer_id" className="mb-1 block text-sm font-medium text-ink-700">
            Lecturer
          </label>
          <select
            id="lecturer_id" name="lecturer_id" required
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="">Select a lecturer…</option>
            {lecturers.map((lecturer) => (
              <option key={lecturer.id} value={lecturer.id}>
                {lecturer.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="term" className="mb-1 block text-sm font-medium text-ink-700">
            Term
          </label>
          <input
            id="term" name="term" required placeholder="e.g. Fall 2026"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Add Offering
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Extend the course detail page with the Offerings section**

Modify `src/app/admin/courses/[id]/page.tsx` — add imports and a new section after `<EditCourseForm course={course} />`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EditCourseForm } from "./EditCourseForm";
import { AddOfferingForm } from "./AddOfferingForm";

interface CourseDetail {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

interface OfferingRow {
  id: string;
  term: string;
  lecturers: { profiles: { full_name: string } | null } | null;
}

interface LecturerOption {
  id: string;
  profiles: { full_name: string } | null;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("courses")
    .select("id, code, title, credits, semester, department")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const course = data as CourseDetail;

  const { data: offeringsData } = await supabase
    .from("course_offerings")
    .select("id, term, lecturers(profiles(full_name))")
    .eq("course_id", id)
    .order("term", { ascending: false });
  const offerings = (offeringsData ?? []) as unknown as OfferingRow[];

  const { data: lecturersData } = await supabase
    .from("lecturers")
    .select("id, profiles(full_name)")
    .order("id", { ascending: true });
  const lecturerOptions = ((lecturersData ?? []) as unknown as LecturerOption[]).map((lecturer) => ({
    id: lecturer.id,
    full_name: lecturer.profiles?.full_name ?? "Unknown",
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{course.title}</h1>
          <p className="text-sm text-ink-500">{course.code}</p>
        </div>
        <EditCourseForm course={course} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-900">Offerings</h2>
        {offerings.length === 0 ? (
          <p className="text-sm text-ink-500">No offerings yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm">
            {offerings.map((offering) => (
              <li key={offering.id} className="flex items-center justify-between py-2">
                <span className="text-ink-900">{offering.lecturers?.profiles?.full_name ?? "Unknown lecturer"}</span>
                <span className="text-ink-500">{offering.term}</span>
              </li>
            ))}
          </ul>
        )}
        <AddOfferingForm courseId={course.id} lecturers={lecturerOptions} />
      </Card>
    </div>
  );
}
```

This is the full, final content of the file (replaces Task 5's version entirely).

- [ ] **Step 4: Run full suite, build, and commit**

Run: `npm test` — all passing.
Run: `npm run build` — succeeds.

```bash
git add -A
git commit -m "feat: add course offerings management to course detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Final wiring — verification

**Files:**
- None (verification-only task).

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all passing (every test from Tasks 1–6).

- [ ] **Step 2: Run typecheck, lint, and build**

Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — succeeds.

- [ ] **Step 3: Manually verify the end-to-end flow**

Run: `npm run dev`, sign in as Admin.

1. Visit `/admin/courses`, click "Add Course", fill the form (code, title, credits, semester, department), submit.
2. Confirm redirect to `/admin/courses` and the new course appears in the list.
3. Search by the course's code, confirm it's the only result.
4. Click "View", confirm the detail page shows the course's title/code and the editable form pre-filled correctly.
5. Edit the Title field, save, confirm it persists after reload.
6. In the Offerings section, select a lecturer (one seeded in a prior phase) and enter a term, click "Add Offering".
7. Confirm the offering now appears in the list with the correct lecturer name and term.
8. Try adding the exact same lecturer + term combination again — confirm it's rejected with the duplicate-assignment error message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify admin courses and offerings end to end

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

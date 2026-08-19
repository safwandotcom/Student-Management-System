# Admin: People Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin create, list, search, view, and deactivate/reactivate Student and Lecturer accounts via a real invite-email flow — the first Admin capability, and the only way any Student/Lecturer account gets created (accounts are admin-provisioned only).

**Architecture:** Two new RLS-protected tables (`students`, `lecturers`), each row owned by a `profiles` row. A shared `inviteUser()` helper creates the auth user via Supabase's admin API (role set through `app_metadata`, never client-writable `user_metadata`, per the Foundation phase's security fix) and sends a real invite email — captured locally by Supabase's built-in Mailpit inbox during dev. A new `/accept-invite` page is where the invited person lands to set their own password. Admin screens for Students and Lecturers share a reusable server-side-paginated `DataTable` component and a shared `setProfileStatus` deactivate/reactivate action, but keep separate list/form/detail pages since their fields differ (program/batch/guardian vs. department/designation).

**Tech Stack:** Same as Foundation — Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth) · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-student-management-system-design.md`

## Global Constraints

- Accounts are admin-provisioned only — no public self-registration exists or is added here (spec: "Accounts & Auth").
- Role (and any other authorization-relevant field) must be set via `app_metadata` only, never `user_metadata` — `user_metadata` is client-writable via the public API and must never be trusted (Foundation phase security fix; see `supabase/migrations/00000000000003_role_from_app_metadata.sql`).
- RLS recipe for every new table (per the Foundation phase's final review recommendation): `enable row level security` → explicit per-command `create policy` (no bare `for all`) → `grant` only the verbs that have a policy, to `authenticated` → a test proving `anon` and the wrong role both get zero rows/a permission failure.
- Lists use **server-side** search & pagination (Supabase `.range()` / `.ilike()`), not client-side — the pattern every later list screen (courses, payments, tickets) reuses.
- Package manager: npm. Local dev backend: Supabase CLI + Docker (already running from the Foundation phase).

---

### Task 1: Pagination helpers + DataTable component

**Files:**
- Create: `src/lib/pagination.ts`
- Test: `src/lib/__tests__/pagination.test.ts`
- Create: `src/components/ui/DataTable.tsx`

**Interfaces:**
- Produces: `DEFAULT_PAGE_SIZE: number`, `parseListParams(searchParams: {search?: string; page?: string}): {search: string; page: number}`, `rangeForPage(page: number, pageSize?: number): [number, number]`, `<DataTable<T> columns rows rowKey searchValue page pageSize totalCount basePath searchPlaceholder? />` — every Admin list screen (Tasks 5 and 8, and every future list screen) imports these.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/pagination.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "../pagination";

describe("parseListParams", () => {
  it("defaults to empty search and page 1", () => {
    expect(parseListParams({})).toEqual({ search: "", page: 1 });
  });

  it("trims whitespace from search", () => {
    expect(parseListParams({ search: "  ali  " })).toEqual({ search: "ali", page: 1 });
  });

  it("parses a valid page number", () => {
    expect(parseListParams({ page: "3" })).toEqual({ search: "", page: 3 });
  });

  it("falls back to page 1 for an invalid page value", () => {
    expect(parseListParams({ page: "not-a-number" })).toEqual({ search: "", page: 1 });
    expect(parseListParams({ page: "0" })).toEqual({ search: "", page: 1 });
    expect(parseListParams({ page: "-5" })).toEqual({ search: "", page: 1 });
  });

  it("floors a fractional page value", () => {
    expect(parseListParams({ page: "2.9" })).toEqual({ search: "", page: 2 });
  });
});

describe("rangeForPage", () => {
  it("returns [0, pageSize-1] for page 1", () => {
    expect(rangeForPage(1, 20)).toEqual([0, 19]);
  });

  it("returns the next window for page 2", () => {
    expect(rangeForPage(2, 20)).toEqual([20, 39]);
  });

  it("defaults pageSize to DEFAULT_PAGE_SIZE", () => {
    expect(rangeForPage(1)).toEqual([0, DEFAULT_PAGE_SIZE - 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- pagination`
Expected: FAIL — `../pagination` module not found.

- [ ] **Step 3: Implement pagination helpers**

Create `src/lib/pagination.ts`:

```typescript
export const DEFAULT_PAGE_SIZE = 20;

export interface ParsedListParams {
  search: string;
  page: number;
}

export function parseListParams(searchParams: { search?: string; page?: string }): ParsedListParams {
  const search = searchParams.search?.trim() ?? "";
  const pageNum = Number(searchParams.page);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
  return { search, page };
}

export function rangeForPage(page: number, pageSize: number = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return [from, to];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- pagination`
Expected: PASS (8 tests).

- [ ] **Step 5: Implement DataTable (no test — presentational, verified visually via Tasks 5 and 8)**

Create `src/components/ui/DataTable.tsx`:

```tsx
import Link from "next/link";
import { ReactNode } from "react";
import { clsx } from "clsx";

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue: string;
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder,
  searchValue,
  page,
  pageSize,
  totalCount,
  basePath,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div>
      <form method="GET" action={basePath} className="mb-4 flex gap-2">
        <input
          type="text"
          name="search"
          defaultValue={searchValue}
          placeholder={searchPlaceholder ?? "Search…"}
          className="w-full max-w-sm rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-ink-500">
                  No results.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((col) => (
                    <td key={col.header} className="px-4 py-3">
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-600">
        <span>
          Page {page} of {totalPages} ({totalCount} total)
        </span>
        <div className="flex gap-2">
          <Link
            href={`${basePath}?search=${encodeURIComponent(searchValue)}&page=${Math.max(1, page - 1)}`}
            className={clsx(
              "rounded-md border border-ink-300 px-3 py-1.5",
              page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-ink-50"
            )}
          >
            Previous
          </Link>
          <Link
            href={`${basePath}?search=${encodeURIComponent(searchValue)}&page=${Math.min(totalPages, page + 1)}`}
            className={clsx(
              "rounded-md border border-ink-300 px-3 py-1.5",
              page >= totalPages ? "pointer-events-none opacity-50" : "hover:bg-ink-50"
            )}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add pagination helpers and DataTable component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `students` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000004_students.sql`
- Test: `src/lib/supabase/__tests__/students-rls.test.ts`

**Interfaces:**
- Produces: `public.students (id uuid pk, profile_id uuid fk→profiles unique, student_id text unique, program text, batch text, guardian_name text?, guardian_phone text?, created_at timestamptz)`, RLS: own-row select (by `profile_id = auth.uid()`), admin select/insert/update all.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/students-rls.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("students RLS", () => {
  const password = "TestPassword123!";
  let studentAId: string, studentBId: string, adminId: string;
  let studentARowId: string;
  let studentAEmail: string, studentBEmail: string, adminEmail: string;

  beforeAll(async () => {
    const stamp = Date.now();
    studentAEmail = `students-rls-a-${stamp}@example.com`;
    studentBEmail = `students-rls-b-${stamp}@example.com`;
    adminEmail = `students-rls-admin-${stamp}@example.com`;

    const a = await admin.auth.admin.createUser({
      email: studentAEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student A" },
    });
    const b = await admin.auth.admin.createUser({
      email: studentBEmail, password, email_confirm: true,
      app_metadata: { role: "student" }, user_metadata: { full_name: "Student B" },
    });
    const adm = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
      app_metadata: { role: "admin" }, user_metadata: { full_name: "Admin One" },
    });
    studentAId = a.data.user!.id;
    studentBId = b.data.user!.id;
    adminId = adm.data.user!.id;

    const { data: studentRow } = await admin
      .from("students")
      .insert({ profile_id: studentAId, student_id: `RLS-A-${stamp}`, program: "BBA", batch: "9th" })
      .select("id")
      .single();
    studentARowId = studentRow!.id;

    await admin
      .from("students")
      .insert({ profile_id: studentBId, student_id: `RLS-B-${stamp}`, program: "BBA", batch: "9th" });
  });

  it("lets a student read their own row but not another student's", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const own = await client.from("students").select("*").eq("profile_id", studentAId).maybeSingle();
    expect(own.data?.profile_id).toBe(studentAId);

    const other = await client.from("students").select("*").eq("profile_id", studentBId).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("does not let a student insert or update a students row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: studentAEmail, password });

    const insertAttempt = await client
      .from("students")
      .insert({ profile_id: studentAId, student_id: "SELF-INSERT", program: "X", batch: "Y" });
    expect(insertAttempt.error).not.toBeNull();

    const updateAttempt = await client
      .from("students")
      .update({ program: "Hacked" })
      .eq("id", studentARowId)
      .select("id");
    expect(updateAttempt.data ?? []).toHaveLength(0);
  });

  it("lets an admin read and insert/update any row", async () => {
    const client = createClient(url, anonKey);
    await client.auth.signInWithPassword({ email: adminEmail, password });

    const { data: all } = await client.from("students").select("*").in("profile_id", [studentAId, studentBId]);
    expect(all).toHaveLength(2);

    const { data: updated } = await client
      .from("students")
      .update({ batch: "10th" })
      .eq("id", studentARowId)
      .select("batch");
    expect(updated?.[0]?.batch).toBe("10th");
  });

  it("denies an anonymous client outright (no table grant — fails closed before RLS)", async () => {
    // There is no legitimate use case for anonymous access to students, so
    // (unlike authenticated/service_role) anon gets no table-level GRANT at
    // all. Postgres rejects the query before RLS is even evaluated — a
    // flat permission error, not an empty-but-successful result. This is a
    // stricter guarantee than "RLS filters to zero rows" and is deliberate.
    const anon = createClient(url, anonKey);
    const { data, error } = await anon.from("students").select("*");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(studentAId);
    await admin.auth.admin.deleteUser(studentBId);
    await admin.auth.admin.deleteUser(adminId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- students-rls`
Expected: FAIL — `relation "public.students" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00000000000004_students.sql`:

```sql
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  student_id text not null unique,
  program text not null,
  batch text not null,
  guardian_name text,
  guardian_phone text,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

create policy "students: read own row"
  on public.students for select
  using (profile_id = auth.uid());

create policy "students: admin select all"
  on public.students for select
  using (public.current_user_role() = 'admin');

create policy "students: admin insert"
  on public.students for insert
  with check (public.current_user_role() = 'admin');

create policy "students: admin update"
  on public.students for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Table GRANT is checked before RLS policies (see profiles' equivalent grant and
-- its migration comment) — scoped to exactly the verbs above: select (both
-- policies), insert (admin only), update (admin only). No delete policy exists,
-- so no delete grant either — deactivation goes through profiles.status, not
-- row deletion.
grant select, insert, update on public.students to authenticated;

-- This local (non-hosted) Supabase stack does not auto-grant table privileges
-- to service_role either (unlike the hosted platform) — mirrors the exact gap
-- Foundation's profiles migration hit and fixed the same way. Test fixtures
-- and any future server-side service-role code need this.
grant select, insert, update, delete on public.students to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase migration up`
Expected: applies with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- students-rls`
Expected: PASS (4 tests).

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add students table with row level security

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `lecturers` table + RLS

**Files:**
- Create: `supabase/migrations/00000000000005_lecturers.sql`
- Test: `src/lib/supabase/__tests__/lecturers-rls.test.ts`

**Interfaces:**
- Produces: `public.lecturers (id uuid pk, profile_id uuid fk→profiles unique, department text, designation text, created_at timestamptz)`, same RLS shape as `students`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/lecturers-rls.test.ts` (identical structure to Task 2's test, table/field names swapped):

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lecturers-rls`
Expected: FAIL — `relation "public.lecturers" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/00000000000005_lecturers.sql`:

```sql
create table public.lecturers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  department text not null,
  designation text not null,
  created_at timestamptz not null default now()
);

alter table public.lecturers enable row level security;

create policy "lecturers: read own row"
  on public.lecturers for select
  using (profile_id = auth.uid());

create policy "lecturers: admin select all"
  on public.lecturers for select
  using (public.current_user_role() = 'admin');

create policy "lecturers: admin insert"
  on public.lecturers for insert
  with check (public.current_user_role() = 'admin');

create policy "lecturers: admin update"
  on public.lecturers for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

grant select, insert, update on public.lecturers to authenticated;

-- This local (non-hosted) Supabase stack does not auto-grant table privileges
-- to service_role either (unlike the hosted platform) — mirrors the exact gap
-- Foundation's profiles migration hit and fixed the same way, and the same
-- fix Task 2 needed for the students table. Test fixtures and any future
-- server-side service-role code need this.
grant select, insert, update, delete on public.lecturers to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase migration up`
Expected: applies with no errors.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lecturers-rls`
Expected: PASS (4 tests).

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add lecturers table with row level security

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Invite mechanism (`inviteUser` + `/accept-invite`)

**Files:**
- Create: `src/lib/auth/invite.ts`
- Test: `src/lib/auth/__tests__/invite.test.ts`
- Create: `src/app/accept-invite/page.tsx`
- Modify: `.env.local.example`, `.env.local` (add `NEXT_PUBLIC_SITE_URL`)

**Interfaces:**
- Consumes: nothing new (uses `@supabase/supabase-js` directly with the service-role key, like `scripts/seed-admin.ts` does).
- Produces: `inviteUser(email: string, fullName: string, role: "student" | "lecturer"): Promise<{ id: string }>` — Tasks 6 and 9's invite forms call this.

- [ ] **Step 1: Add `NEXT_PUBLIC_SITE_URL`**

Add to `.env.local.example`:

```
NEXT_PUBLIC_SITE_URL=
```

Add to `.env.local`:

```
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/auth/__tests__/invite.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- invite`
Expected: FAIL — `../invite` module not found.

- [ ] **Step 4: Implement `inviteUser`**

Create `src/lib/auth/invite.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type InviteRole = "student" | "lecturer";

export async function inviteUser(
  email: string,
  fullName: string,
  role: InviteRole
): Promise<{ id: string }> {
  const supabase = adminClient();

  // Step 1: create the invited auth user. `data` here becomes user_metadata,
  // which is client-writable and must never carry authorization-relevant
  // fields — full_name is fine, role is not.
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000"}/accept-invite`,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;

  // Step 2: set role via app_metadata (service-role-only-writable). This fires
  // the on_auth_user_app_metadata_updated trigger (Foundation phase), which
  // syncs profiles.role from raw_app_meta_data only — never from
  // raw_user_meta_data.
  const { error: metaError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (metaError) throw new Error(metaError.message);

  return { id: userId };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- invite`
Expected: PASS.

- [ ] **Step 6: Implement the accept-invite page**

Supabase's default (uncustomized) invite email link, when clicked, has GoTrue redirect the browser to `redirectTo` with the new session's tokens in the URL **hash fragment** (`#access_token=...&refresh_token=...&type=invite`) — this page reads that fragment client-side, establishes the session, then lets the person set their password.

Create `src/app/accept-invite/page.tsx`:

```tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "loading" | "ready" | "error" | "submitting" | "done";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setStatus("error");
      setErrorMessage("This invite link is invalid or has expired.");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
      } else {
        setStatus("ready");
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("done");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-ink-900">Set your password</h1>
        <p className="mb-6 text-sm text-ink-500">Finish setting up your account.</p>

        {status === "loading" && <p className="text-sm text-ink-500">Verifying your invite…</p>}
        {status === "error" && <p className="text-sm text-danger-700">{errorMessage}</p>}

        {(status === "ready" || status === "submitting") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" loading={status === "submitting"} className="w-full">
              Set password &amp; continue
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
```

This page is not unit-tested — it depends on a real browser reading `window.location.hash` and a live Supabase session exchange, the same class of thing the Foundation phase's login page left to end-to-end verification. It's covered by this plan's final live E2E check (see the end of Task 10).

- [ ] **Step 7: Run full suite and commit**

Run: `npm test`
Expected: all passing.

```bash
git add -A
git commit -m "feat: add invite mechanism and accept-invite page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin Students — list page

**Files:**
- Create: `src/app/admin/students/page.tsx`

**Interfaces:**
- Consumes: `parseListParams`, `rangeForPage`, `DEFAULT_PAGE_SIZE` (Task 1), `DataTable` (Task 1), `createServerSupabaseClient` (Foundation), `Badge`, `Button`, `Card` (Foundation).
- Produces: nothing new — this is a leaf page. No automated test (server component reading real query-string-driven Supabase queries; verified in this plan's final live E2E check).

- [ ] **Step 1: Implement the list page**

Create `src/app/admin/students/page.tsx`:

```tsx
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface StudentRow {
  id: string;
  student_id: string;
  program: string;
  batch: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("students")
    .select("id, student_id, program, batch, profiles(full_name, status)", { count: "exact" })
    .order("student_id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("student_id", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as StudentRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Students</h1>
          <p className="text-sm text-ink-500">Search by student ID.</p>
        </div>
        <Link href="/admin/students/new">
          <Button>Add Student</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/students"
          searchValue={search}
          searchPlaceholder="Search by student ID…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Student ID", cell: (row) => row.student_id },
            { header: "Name", cell: (row) => row.profiles?.full_name ?? "—" },
            { header: "Program", cell: (row) => row.program },
            { header: "Batch", cell: (row) => row.batch },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.profiles?.status === "active" ? "success" : "neutral"}>
                  {row.profiles?.status ?? "unknown"}
                </Badge>
              ),
            },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/students/${row.id}`} className="text-brand-700 hover:underline">
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
git commit -m "feat: add admin students list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin Students — add (invite) form

**Files:**
- Create: `src/app/admin/students/new/page.tsx`
- Create: `src/app/admin/students/new/actions.ts`

**Interfaces:**
- Consumes: `inviteUser` (Task 4), `createServerSupabaseClient` (Foundation), `Button`, `Card` (Foundation).

- [ ] **Step 1: Implement the server action**

Create `src/app/admin/students/new/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/auth/invite";

export async function createStudent(_prevState: { error: string | null }, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const program = String(formData.get("program") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim() || null;
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim() || null;

  if (!fullName || !email || !studentId || !program || !batch) {
    return { error: "Please fill in all required fields." };
  }

  let profileId: string;
  try {
    const invited = await inviteUser(email, fullName, "student");
    profileId = invited.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send invite." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("students").insert({
    profile_id: profileId,
    student_id: studentId,
    program,
    batch,
    guardian_name: guardianName,
    guardian_phone: guardianPhone,
  });

  if (error) {
    return { error: `Invite sent, but saving student details failed: ${error.message}` };
  }

  redirect("/admin/students");
}
```

This inserts through the Admin's own logged-in session (`createServerSupabaseClient`, cookie-based) — not the service-role client — so it exercises the "students: admin insert" RLS policy from Task 2 for real, not just in tests.

- [ ] **Step 2: Implement the form page**

Create `src/app/admin/students/new/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createStudent } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewStudentPage() {
  const [state, formAction, pending] = useActionState(createStudent, { error: null });

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Student</h1>
      <p className="mb-6 text-sm text-ink-500">
        An invite email will be sent so they can set their own password.
      </p>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-ink-700">
            Full name
          </label>
          <input id="full_name" name="full_name" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-ink-700">
            Student ID (roll)
          </label>
          <input id="student_id" name="student_id" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="program" className="mb-1 block text-sm font-medium text-ink-700">
            Program
          </label>
          <input id="program" name="program" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="batch" className="mb-1 block text-sm font-medium text-ink-700">
            Batch
          </label>
          <input id="batch" name="batch" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="guardian_name" className="mb-1 block text-sm font-medium text-ink-700">
              Guardian name
            </label>
            <input id="guardian_name" name="guardian_name" className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="guardian_phone" className="mb-1 block text-sm font-medium text-ink-700">
              Guardian phone
            </label>
            <input id="guardian_phone" name="guardian_phone" className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
          </div>
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Send Invite
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
git commit -m "feat: add admin add-student invite form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin Students — detail/edit/deactivate page + shared status action

**Files:**
- Create: `src/lib/admin/status.ts`
- Test: `src/lib/admin/__tests__/status.test.ts`
- Create: `src/lib/admin/actions.ts`
- Create: `src/app/admin/students/[id]/page.tsx`
- Create: `src/app/admin/students/[id]/actions.ts`
- Create: `src/app/admin/students/[id]/EditStudentForm.tsx`
- Create: `src/app/admin/students/[id]/DeactivateButton.tsx`

**Interfaces:**
- Produces: `updateProfileStatus(supabase: SupabaseClient, profileId: string, status: "active" | "inactive"): Promise<void>` (throws if RLS denies or 0 rows match) and `setProfileStatus(profileId, status, revalidateTo): Promise<void>` (server action wrapping it) — Task 10's Lecturer detail page reuses both directly, no new file needed there. Also produces `updateStudent(prevState, formData)` — a student-specific edit action (Task 10 writes its own `updateLecturer` mirroring the shape, since the editable fields differ).

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/__tests__/status.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- status`
Expected: FAIL — `../status` module not found.

- [ ] **Step 3: Implement `updateProfileStatus`**

Create `src/lib/admin/status.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export async function updateProfileStatus(
  supabase: SupabaseClient,
  profileId: string,
  status: "active" | "inactive"
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", profileId)
    .select("id");

  if (error) throw new Error(error.message);
  // With RLS, a denied update returns success with zero affected rows rather
  // than a permission error — treat that as a failure so callers can trust
  // "no throw" means the status genuinely changed.
  if (!data || data.length === 0) {
    throw new Error("Update denied or profile not found.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- status`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement the server action wrapper**

Create `src/lib/admin/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateProfileStatus } from "./status";

export async function setProfileStatus(
  profileId: string,
  status: "active" | "inactive",
  revalidateTo: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await updateProfileStatus(supabase, profileId, status);
  revalidatePath(revalidateTo);
}
```

- [ ] **Step 6: Implement the DeactivateButton client component**

Create `src/app/admin/students/[id]/DeactivateButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { setProfileStatus } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

export function DeactivateButton({
  profileId,
  currentStatus,
  revalidateTo,
}: {
  profileId: string;
  currentStatus: string;
  revalidateTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = currentStatus === "active";

  return (
    <Button
      variant={isActive ? "danger" : "secondary"}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await setProfileStatus(profileId, isActive ? "inactive" : "active", revalidateTo);
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
```

- [ ] **Step 7: Implement the edit action**

Create `src/app/admin/students/[id]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateStudent(_prevState: { error: string | null }, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const program = String(formData.get("program") ?? "").trim();
  const batch = String(formData.get("batch") ?? "").trim();
  const guardianName = String(formData.get("guardian_name") ?? "").trim() || null;
  const guardianPhone = String(formData.get("guardian_phone") ?? "").trim() || null;

  if (!id || !program || !batch) {
    return { error: "Program and batch are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .update({ program, batch, guardian_name: guardianName, guardian_phone: guardianPhone })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or student not found." };

  revalidatePath(`/admin/students/${id}`);
  return { error: null };
}
```

- [ ] **Step 8: Implement the detail page as an editable form**

Create `src/app/admin/students/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeactivateButton } from "./DeactivateButton";
import { EditStudentForm } from "./EditStudentForm";

interface StudentDetail {
  id: string;
  student_id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  profile_id: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("students")
    .select("id, student_id, program, batch, guardian_name, guardian_phone, profile_id, profiles(full_name, status)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const student = data as unknown as StudentDetail;
  const profile = student.profiles ?? { full_name: "Unknown", status: "unknown" };

  return (
    <Card className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{profile.full_name}</h1>
          <p className="text-sm text-ink-500">{student.student_id}</p>
        </div>
        <Badge tone={profile.status === "active" ? "success" : "neutral"}>{profile.status}</Badge>
      </div>
      <EditStudentForm student={student} />
      <DeactivateButton
        profileId={student.profile_id}
        currentStatus={profile.status}
        revalidateTo={`/admin/students/${student.id}`}
      />
    </Card>
  );
}
```

- [ ] **Step 9: Implement the EditStudentForm client component**

Create `src/app/admin/students/[id]/EditStudentForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { updateStudent } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableStudent {
  id: string;
  program: string;
  batch: string;
  guardian_name: string | null;
  guardian_phone: string | null;
}

export function EditStudentForm({ student }: { student: EditableStudent }) {
  const [state, formAction, pending] = useActionState(updateStudent, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={student.id} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="program" className="mb-1 block text-sm font-medium text-ink-700">
            Program
          </label>
          <input
            id="program" name="program" required defaultValue={student.program}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="batch" className="mb-1 block text-sm font-medium text-ink-700">
            Batch
          </label>
          <input
            id="batch" name="batch" required defaultValue={student.batch}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="guardian_name" className="mb-1 block text-sm font-medium text-ink-700">
            Guardian name
          </label>
          <input
            id="guardian_name" name="guardian_name" defaultValue={student.guardian_name ?? ""}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="guardian_phone" className="mb-1 block text-sm font-medium text-ink-700">
            Guardian phone
          </label>
          <input
            id="guardian_phone" name="guardian_phone" defaultValue={student.guardian_phone ?? ""}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
```

- [ ] **Step 10: Run full suite, build, and commit**

Run: `npm test` — all passing.
Run: `npm run build` — succeeds.

```bash
git add -A
git commit -m "feat: add admin student detail page with edit and deactivate/reactivate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Admin Lecturers — list page

**Files:**
- Create: `src/app/admin/lecturers/page.tsx`

Same shape as Task 5, table/field names swapped (`lecturers`, `department`, `designation`; search by department instead of student ID since lecturers have no roll number).

- [ ] **Step 1: Implement the list page**

Create `src/app/admin/lecturers/page.tsx`:

```tsx
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface LecturerRow {
  id: string;
  department: string;
  designation: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function LecturersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("lecturers")
    .select("id, department, designation, profiles(full_name, status)", { count: "exact" })
    .order("department", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("department", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as LecturerRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Lecturers</h1>
          <p className="text-sm text-ink-500">Search by department.</p>
        </div>
        <Link href="/admin/lecturers/new">
          <Button>Add Lecturer</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/lecturers"
          searchValue={search}
          searchPlaceholder="Search by department…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Name", cell: (row) => row.profiles?.full_name ?? "—" },
            { header: "Department", cell: (row) => row.department },
            { header: "Designation", cell: (row) => row.designation },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.profiles?.status === "active" ? "success" : "neutral"}>
                  {row.profiles?.status ?? "unknown"}
                </Badge>
              ),
            },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/lecturers/${row.id}`} className="text-brand-700 hover:underline">
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

Run: `npm test` — all passing.

```bash
git add -A
git commit -m "feat: add admin lecturers list page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Admin Lecturers — add (invite) form

**Files:**
- Create: `src/app/admin/lecturers/new/page.tsx`
- Create: `src/app/admin/lecturers/new/actions.ts`

Same shape as Task 6, swapped for lecturer fields.

- [ ] **Step 1: Implement the server action**

Create `src/app/admin/lecturers/new/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteUser } from "@/lib/auth/invite";

export async function createLecturer(_prevState: { error: string | null }, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!fullName || !email || !department || !designation) {
    return { error: "Please fill in all required fields." };
  }

  let profileId: string;
  try {
    const invited = await inviteUser(email, fullName, "lecturer");
    profileId = invited.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send invite." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("lecturers").insert({
    profile_id: profileId,
    department,
    designation,
  });

  if (error) {
    return { error: `Invite sent, but saving lecturer details failed: ${error.message}` };
  }

  redirect("/admin/lecturers");
}
```

- [ ] **Step 2: Implement the form page**

Create `src/app/admin/lecturers/new/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createLecturer } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NewLecturerPage() {
  const [state, formAction, pending] = useActionState(createLecturer, { error: null });

  return (
    <Card className="max-w-xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Add Lecturer</h1>
      <p className="mb-6 text-sm text-ink-500">
        An invite email will be sent so they can set their own password.
      </p>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-ink-700">
            Full name
          </label>
          <input id="full_name" name="full_name" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input id="department" name="department" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="designation" className="mb-1 block text-sm font-medium text-ink-700">
            Designation
          </label>
          <input id="designation" name="designation" required className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm" />
        </div>
        {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
        <Button type="submit" loading={pending} className="w-full">
          Send Invite
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
git commit -m "feat: add admin add-lecturer invite form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Admin Lecturers — detail/edit/deactivate page (final wiring)

**Files:**
- Create: `src/app/admin/lecturers/[id]/page.tsx`
- Create: `src/app/admin/lecturers/[id]/actions.ts`
- Create: `src/app/admin/lecturers/[id]/EditLecturerForm.tsx`
- Create: `src/app/admin/lecturers/[id]/DeactivateButton.tsx`

**Interfaces:**
- Consumes: `setProfileStatus` from `@/lib/admin/actions` (Task 7) directly — no new status-handling code, just a lecturer-flavored `DeactivateButton` wrapper (same shape as Task 7's, importing the same shared action) and detail page. Produces `updateLecturer(prevState, formData)`, mirroring Task 7's `updateStudent` shape for `department`/`designation` instead of `program`/`batch`/guardian fields.

- [ ] **Step 1: Implement the DeactivateButton (identical to Task 7's, own file per Next.js route co-location convention)**

Create `src/app/admin/lecturers/[id]/DeactivateButton.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { setProfileStatus } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

export function DeactivateButton({
  profileId,
  currentStatus,
  revalidateTo,
}: {
  profileId: string;
  currentStatus: string;
  revalidateTo: string;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = currentStatus === "active";

  return (
    <Button
      variant={isActive ? "danger" : "secondary"}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await setProfileStatus(profileId, isActive ? "inactive" : "active", revalidateTo);
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
```

- [ ] **Step 2: Implement the edit action**

Create `src/app/admin/lecturers/[id]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateLecturer(_prevState: { error: string | null }, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!id || !department || !designation) {
    return { error: "Department and designation are required." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecturers")
    .update({ department, designation })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Update denied or lecturer not found." };

  revalidatePath(`/admin/lecturers/${id}`);
  return { error: null };
}
```

- [ ] **Step 3: Implement the EditLecturerForm client component**

Create `src/app/admin/lecturers/[id]/EditLecturerForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { updateLecturer } from "./actions";
import { Button } from "@/components/ui/Button";

interface EditableLecturer {
  id: string;
  department: string;
  designation: string;
}

export function EditLecturerForm({ lecturer }: { lecturer: EditableLecturer }) {
  const [state, formAction, pending] = useActionState(updateLecturer, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={lecturer.id} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-700">
            Department
          </label>
          <input
            id="department" name="department" required defaultValue={lecturer.department}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="designation" className="mb-1 block text-sm font-medium text-ink-700">
            Designation
          </label>
          <input
            id="designation" name="designation" required defaultValue={lecturer.designation}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger-700">{state.error}</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Implement the detail page as an editable form**

Create `src/app/admin/lecturers/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeactivateButton } from "./DeactivateButton";
import { EditLecturerForm } from "./EditLecturerForm";

interface LecturerDetail {
  id: string;
  department: string;
  designation: string;
  profile_id: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function LecturerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("lecturers")
    .select("id, department, designation, profile_id, profiles(full_name, status)")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const lecturer = data as unknown as LecturerDetail;
  const profile = lecturer.profiles ?? { full_name: "Unknown", status: "unknown" };

  return (
    <Card className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{profile.full_name}</h1>
          <p className="text-sm text-ink-500">{lecturer.designation}</p>
        </div>
        <Badge tone={profile.status === "active" ? "success" : "neutral"}>{profile.status}</Badge>
      </div>
      <EditLecturerForm lecturer={lecturer} />
      <DeactivateButton
        profileId={lecturer.profile_id}
        currentStatus={profile.status}
        revalidateTo={`/admin/lecturers/${lecturer.id}`}
      />
    </Card>
  );
}
```

- [ ] **Step 5: Run the full automated suite**

Run: `npm test`
Expected: all passing (every test from Tasks 1–9 plus this task's unchanged suite).

- [ ] **Step 6: Run typecheck, lint, and build**

Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — clean.
Run: `npm run build` — succeeds.

- [ ] **Step 7: Manually verify the end-to-end invite flow**

Run: `npm run dev`, sign in as Admin (seeded in the Foundation phase).

1. Visit `/admin/students`, click "Add Student", fill the form with a real test email you can check (or use a local Mailpit-catchable address), submit.
2. Confirm redirect to `/admin/students` and the new row appears with status "active"... — actually, note: the invited user's `profiles.status` defaults to `'active'` immediately (per the `profiles` migration's default), even before they've set a password. This is expected: "active" means the account exists and isn't deactivated, not that they've completed onboarding.
3. Open Supabase's local Mailpit inbox at `http://127.0.0.1:54324` and find the invite email; open it and click the link.
4. Confirm it lands on `/accept-invite`, shows the "Set your password" form (not the error state).
5. Set a password, submit, confirm redirect to `/student` (the placeholder dashboard from the Foundation phase) — proving the new student's `profiles.role` really is `'student'` and the whole chain (invite → app_metadata → trigger → RLS → role-guard) works end to end.
6. Back in the Admin session (a different browser or after signing out/in), visit the new student's detail page, edit the Program/Batch fields, click "Save changes", confirm the new values persist after a page reload.
7. Click "Deactivate", confirm the badge flips to "inactive".
8. Sign out of the admin session, sign in as the deactivated student — confirm they're bounced to `/login` (the Foundation phase's status-enforcement fix working against real data).
9. Repeat steps 1–6 once for a Lecturer via `/admin/lecturers/new` to confirm the shared invite and edit paths both work for the second role.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add admin lecturer detail page with edit and deactivate/reactivate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

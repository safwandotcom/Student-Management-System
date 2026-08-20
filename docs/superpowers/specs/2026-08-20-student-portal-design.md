# Enrollment + Student Portal — Design Spec

Date: 2026-08-20
Repo: `safwandotcom/Student-Management-System`
Parent spec: [`docs/superpowers/specs/2026-08-19-student-management-system-design.md`](2026-08-19-student-management-system-design.md)

## Why this phase exists, and its actual boundary

The parent spec's build order lists "Student portal — dashboard, courses,
attendance, results, fees & payments, profile, raise tickets" as one phase.
Tracing dependencies shows that scope isn't deliverable as one coherent unit
today:

- **Enrollment** (student ↔ course offering) was originally scoped under
  Phase 2 ("Admin: People & Academics — ...courses; offerings;
  **enrollment**"), but the two Admin sub-phases actually built
  (`docs/superpowers/plans/2026-08-20-admin-people-management.md`,
  `docs/superpowers/plans/2026-08-20-admin-courses-offerings.md`) only
  delivered Courses & Offerings — enrollment itself was never built. Without
  it, a student has no course to view.
- **Attendance** and **Results/Grades** are *written* by Lecturers (parent
  spec's Phase 4, not built) — a Student portal section for either can only
  ever be an empty state until that phase exists.
- **Fees & Payments** are managed by Admin Finance (parent spec's Phase 5,
  not built) — same gap.
- **Support tickets** need a ticketing system shared by all three roles
  (raised by Student, answered by Lecturer/Admin) — none of that exists yet.

**This phase's actual scope:** build the missing Enrollment piece (admin
enrolls a student into a course offering), and build the Student portal
shell with real data for the two sections that have a real backend today
(Courses, Profile) plus a Dashboard summarizing them. Attendance,
Results, Fees & Payments, and Support Tickets appear in the sidebar as
"coming soon" placeholder pages — present in the nav from day one so later
phases replace a page rather than add a nav item, but backed by nothing.

Ruling basis: this mirrors how `src/app/admin/layout.tsx` already lists
`Fees & Payments`, `Notices`, and `Support Tickets` in its nav ahead of the
phases that will build them — the placeholder-nav pattern is already
established in this codebase, not new.

## Enrollment

**Who enrolls whom:** Admin-only, matching the existing admin-provisioned
pattern used for every other write in this system (accounts, courses,
offerings). Students do not self-register into offerings — consistent
with "Admin-provisioned only" in the parent spec's Accounts & Auth section.
No capacity limit: since enrollment is a manual admin action rather than
self-service, the admin's own judgment is the capacity control for v1. Can
be added later if it becomes a real need.

**Where in the UI:** nested under the course offering, on the existing
course detail page (`src/app/admin/courses/[id]/page.tsx`) — each offering
in the Offerings list gets an "Enroll Student" action that opens a
student picker. This mirrors the existing pattern where offerings
themselves are added nested under their course, and reuses the course
detail page the admin is already on rather than introducing a new route.

**No edit/delete in this phase.** Matches the existing pattern:
`course_offerings` themselves have no edit/delete in the parent plan either
(a deliberate scope decision made in
`docs/superpowers/plans/2026-08-20-admin-courses-offerings.md` and reaffirmed
by that phase's final review). A correction story for enrollments — like
the one already flagged as a future decision for offerings — can be
designed later if it's actually needed; adding a drop/unenroll action now
would be speculative.

### Data model

```sql
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, offering_id)
);
```

RLS, following the established recipe (`enable row level security` →
explicit per-command `create policy` → grants scoped to exactly the verbs
with policies, to `authenticated` and `service_role` only, never `anon`):

- `admin select all` / `admin insert` — same shape as `course_offerings`.
- `student select own` — `using (student_id in (select id from students
  where profile_id = auth.uid()))`, so a student can read their own
  enrollment rows (needed for the Courses page and Dashboard count).
- No update/delete policy or grant, matching the create-only decision above.

## Closing the RLS gap for the Student Courses page

`courses`, `course_offerings`, and `lecturers` currently only grant
`admin select all` (plus each person's own row on `lecturers`/`students`
directly). A student viewing their Courses page needs to see: the
*offering* they're enrolled in, the *course* it belongs to, and the
*lecturer's name* teaching it — none of which any existing policy allows a
student to read.

This phase adds three new scoped `select` policies, each shaped "visible if
referenced by one of my own enrollment rows" — the same EXISTS-subquery
style already used for admin-scoped policies elsewhere, no new pattern
invented:

- `course_offerings`: student can select an offering if an enrollment row
  exists linking their own `students.id` to that `offering_id`.
- `courses`: student can select a course if one of their enrolled offerings
  references it (`course_offerings.course_id`).
- `profiles`: student can select a lecturer's profile row (for
  `full_name`) if that lecturer teaches one of their enrolled offerings —
  chained through `lecturers.profile_id` → `course_offerings.lecturer_id` →
  `enrollments`. This is the only new policy needed on `profiles` itself;
  its existing `read own row` / `admin reads all` policies are untouched.

Each of these is additive (a new `create policy`, not a change to any
existing one) and scoped narrowly to the enrollment relationship — a
student still cannot read courses/offerings/profiles unrelated to their own
enrollments.

## Student portal shell

**Routing & guard:** `src/app/student/layout.tsx`, structurally identical
to `src/app/admin/layout.tsx` — same `resolveGuardRedirect(profile,
"student")` call, same sign-out-on-orphaned-session handling, same
`PortalShell` component. The redirect path (`/student`) and role type
already exist in `src/lib/auth/redirect.ts` from Foundation, unused until
now.

**Sidebar nav** (`src/app/student/layout.tsx`'s `NAV_ITEMS`):
Dashboard · Courses · Attendance · Results · Fees & Payments · Profile ·
Support Tickets — all seven from day one, per the placeholder-nav ruling
above.

**Pages with real data (this phase):**
- **Dashboard** (`/student`) — welcome card with the student's name, a
  count of enrolled courses this term, and quick-link cards to each other
  sidebar section (including the placeholders).
- **Courses** (`/student/courses`) — table of the student's enrollments:
  course code, title, credits, term, lecturer name. Read-only.
- **Profile** (`/student/profile`) — the student's own `profiles` +
  `students` row: full name, student ID, program, batch, guardian info.
  Email is not a column on `profiles` (it lives on `auth.users`) — read it
  from the same `supabase.auth.getUser()` call every layout already uses
  for the role guard, not from a table query. Read-only for this phase
  (view-only was chosen over editable to keep scope tight — can be
  revisited later).

**Placeholder pages (this phase):** `/student/attendance`,
`/student/results`, `/student/payments`, `/student/tickets` — each a
single empty-state card ("Attendance tracking is coming soon" etc.), no
queries, no new tables. Reuses whatever empty-state pattern already exists
in the codebase (check `src/components/ui/` before inventing a new one).

## Testing

Same conventions as the last two phases:
- An RLS test file (or an addition to one) per new/changed policy —
  `enrollments`, and the three new scoped-read policies on
  `course_offerings`/`courses`/`profiles`.
- A `requireAdmin()`-first authorization test for the new enroll action,
  proving a non-admin caller is rejected and no enrollment row is written
  — mirroring the pattern established in the Courses & Offerings phase's
  fix wave (`src/app/admin/courses/[id]/__tests__/actions.test.ts`).
- Controller live-verification in-browser: admin enrolls a student into an
  offering; sign in as that student; confirm the Dashboard count, Courses
  table, and Profile page show correct real data; confirm the four
  placeholder pages render without error.

## Out of scope for this phase

- Attendance, Results/Grades, Fees & Payments, Support Tickets — real
  functionality for all four is out of scope; they get placeholder pages
  only, per the parent spec's own Phase 4/5 ownership of that data.
- Self-service enrollment, enrollment capacity limits, and
  enrollment edit/delete — all explicitly deferred per the rulings above.
- Editable student profile — deferred; this phase is view-only.

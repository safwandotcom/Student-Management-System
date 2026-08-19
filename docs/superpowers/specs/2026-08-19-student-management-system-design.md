# Student Management System — Design Spec

Date: 2026-08-19
Repo: `safwandotcom/Student-Management-System` ("Dynamic Student Portal")

## Purpose

A real, role-based academic management system for an institution, with three
portals — **Student**, **Lecturer**, and **Admin** — sharing one database and
one identity system. Inspired by the UX patterns of the FBS DU EMBA Applicant
Portal (`https://fbs.du.ac.bd/emba-admission/applicant/dashboard`): sidebar
navigation, card-based dashboards, status badges, progress trackers, ledger
tables, and a support-ticket system — but with a fresh, original visual
identity rather than a copy of that branding.

## Architecture

- **One Next.js app** (App Router, TypeScript, Tailwind CSS) in this repo.
- **One Supabase project** for Postgres (data), Auth (identity), and Storage
  (profile photos, documents).
- **One login page.** After authentication, the user's `role` (read from the
  `profiles` table) determines redirect to `/student/*`, `/lecturer/*`, or
  `/admin/*`. Each route group has its own role-guard layout and sidebar nav,
  built on a shared design system (colors, typography, shell, cards, tables,
  badges) so all three portals read as one coherent product.
- **One Vercel deployment**, connected to this GitHub repo, deploying on push
  to `main`.

Rejected alternative: three separate apps in a Turborepo (one per role).
More isolation, but unnecessary overhead — a shared UI package, multiple
deploy targets, and cross-app auth — for a system where all three roles share
one database and one identity provider.

## Accounts & Auth

- **Admin-provisioned only.** No public self-registration for students or
  lecturers. An Admin creates an account (name, email, role); the system
  sends an invite; the new user sets their own password on first login.
- The very first Admin account is created via a seed script during Phase 0
  setup (not through the UI, since no Admin exists yet).
- **Row Level Security (RLS)** in Supabase enforces per-role visibility:
  - Students see only their own records (enrollments, attendance, grades,
    payments, tickets).
  - Lecturers see only the rosters/attendance/grades for course offerings
    assigned to them.
  - Admins see and manage everything.

## Data Model (core entities)

| Entity | Purpose |
|---|---|
| `profiles` | id (→ Supabase auth user), full_name, role, status, avatar_url, phone |
| `students` | profile_id, student_id/roll, program, batch/semester, guardian info |
| `lecturers` | profile_id, department, designation |
| `courses` | code, title, credits, semester, department |
| `course_offerings` | course_id, lecturer_id, term — a course taught by a lecturer in a given term |
| `enrollments` | student_id, offering_id — a student's registration into a course this term |
| `attendance_sessions` / `attendance_records` | per-class-session marks per student |
| `grades` | student_id, offering_id, marks/grade, finalized flag |
| `fee_structures` | program/semester, amount, due date |
| `payments` | student_id, amount, method, trx_id, status, paid_at |
| `notices` | author_id, audience (all/students/lecturers/course), title, body, published_at |
| `support_tickets` / `ticket_messages` | raised_by, subject, status, message thread |

## Feature Scope by Portal

### Student
Dashboard (notices, quick stats, upcoming classes/exams) · My Courses ·
Attendance (per-course %) · Results/Grades (per-semester, CGPA) · Fees &
Payments (dues, history) · Profile · Support Tickets (raise & track).

### Lecturer
My Courses & Roster · Attendance marking (per session) · Gradebook (enter/
finalize marks) · Course notices & teaching schedule · Support tickets
raised by their own students (respond/close).

### Admin
**People:** add/edit/deactivate students and lecturers, invite flow.
**Academics:** manage courses, course offerings, lecturer assignment,
student enrollment.
**Finance:** fee structures, all-student payments ledger, manual payment
entry.
**Notices & support:** institution-wide/audience-targeted notices composer;
support ticket inbox (all tickets, respond/close).

## Build Order

Admin-provisioned accounts mean nothing else is testable end-to-end until
Admin can create students/lecturers/courses — so Admin's people/academics
management comes right after foundation, ahead of Student and Lecturer.

1. **Foundation** — connect repo to GitHub; scaffold Next.js + Tailwind +
   Supabase; shared design system (colors, typography, shell, cards, tables,
   badges); auth + role-based routing; RLS policies; seed first Admin.
2. **Admin: People & Academics** — students/lecturers CRUD + invite; courses;
   offerings; enrollment.
3. **Student portal** — dashboard, courses, attendance, results, fees &
   payments, profile, raise tickets.
4. **Lecturer portal** — courses & roster, attendance marking, gradebook,
   notices, respond to tickets.
5. **Admin: Finance & comms** — fee structures, payments oversight, notices
   composer, tickets inbox.
6. **Polish & deploy** — empty/error states, responsive pass, Vercel deploy,
   README.

Each phase produces something demoable end-to-end.

## Out of Scope (v1)

- Public self-registration for students/lecturers.
- Exam/timetable scheduling as a distinct module (may fold into a future
  phase; attendance sessions cover per-class scheduling for now).
- Multi-institution/multi-tenant support — this system models a single
  institution.

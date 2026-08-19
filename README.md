# Student Management System

A role-based academic management system with three portals — **Student**,
**Lecturer**, and **Admin** — built on Next.js and Supabase.

See `docs/superpowers/specs/2026-08-19-student-management-system-design.md`
for the full design, and `docs/superpowers/plans/` for the phase-by-phase
implementation plans.

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)

## Setup

```bash
npm install
npx supabase start        # starts local Postgres/Auth; copy the printed
                           # keys into .env.local (see .env.local.example)
npx supabase migration up # applies the schema
npm run seed:admin -- you@example.com "YourPassword1!" "Your Name"
npm run dev
```

Visit http://localhost:3000 and sign in with the admin account you seeded.

## Testing

```bash
npm test
```

Requires `supabase start` to be running (some tests hit the local Postgres/Auth
stack directly).

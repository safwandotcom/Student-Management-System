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

Also set `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000` in `.env.local`. It must match
the host Supabase issues sessions for (`127.0.0.1`, not `localhost`), or invite/
accept-invite redirect links will break — see `next.config.ts` for why.

Visit http://127.0.0.1:3000 and sign in with the admin account you seeded.

Local invite and auth emails don't actually get sent — they land in Mailpit at
http://127.0.0.1:54324, viewable in the browser.

## Testing

```bash
npm test
```

Requires `supabase start` to be running (some tests hit the local Postgres/Auth
stack directly).

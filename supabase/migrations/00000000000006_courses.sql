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

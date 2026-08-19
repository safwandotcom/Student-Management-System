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

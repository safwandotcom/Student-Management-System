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

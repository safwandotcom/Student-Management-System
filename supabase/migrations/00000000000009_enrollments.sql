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

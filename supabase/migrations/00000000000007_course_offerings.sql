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

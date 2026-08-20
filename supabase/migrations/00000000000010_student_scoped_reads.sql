-- A student can see a course_offering if one of their own enrollment rows
-- references it.
create policy "course_offerings: student select enrolled"
  on public.course_offerings for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.offering_id = course_offerings.id
        and s.profile_id = auth.uid()
    )
  );

-- A student can see a course if one of their enrolled offerings references it.
create policy "courses: student select enrolled"
  on public.courses for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      join public.course_offerings co on co.id = e.offering_id
      where co.course_id = courses.id
        and s.profile_id = auth.uid()
    )
  );

-- A student can see a lecturer row if they are enrolled in one of that
-- lecturer's offerings. This policy must exist to allow the profiles policy
-- to read lecturer rows when checking which profiles to expose.
create policy "lecturers: student select enrolled"
  on public.lecturers for select
  using (
    exists (
      select 1 from public.course_offerings co
      join public.enrollments e on e.offering_id = co.id
      join public.students s on s.id = e.student_id
      where co.lecturer_id = lecturers.id
        and s.profile_id = auth.uid()
    )
  );

-- A student can see a lecturer's profile row (for full_name) if that
-- lecturer teaches one of their enrolled offerings. This is the only new
-- policy on profiles itself — its existing "read own row" and "admin reads
-- all" policies are untouched.
create policy "profiles: student select enrolled lecturer"
  on public.profiles for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      join public.course_offerings co on co.id = e.offering_id
      join public.lecturers l on l.id = co.lecturer_id
      where l.profile_id = profiles.id
        and s.profile_id = auth.uid()
    )
  );

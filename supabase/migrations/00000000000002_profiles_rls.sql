alter table public.profiles enable row level security;

create function public.current_user_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles: read own row"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.current_user_role() = 'admin');

-- Same underlying issue as Task 5's service_role grant: this local stack's
-- tables don't inherit default privileges for `authenticated` the way the
-- managed Supabase platform does. Postgres checks table-level GRANTs before
-- RLS policies are ever evaluated, so without this, every query from an
-- `authenticated` user fails with "permission denied for table profiles"
-- regardless of the policies above. Only select/update are granted because
-- only select/update policies exist for `authenticated` above; the signup
-- trigger inserts via its own `security definer` privileges, not this grant.
grant select, update on public.profiles to authenticated;

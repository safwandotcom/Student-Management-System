create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('student', 'lecturer', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- This local stack's default privileges (role `postgres`, which runs migrations)
-- do not grant table access to `service_role` automatically, unlike the managed
-- platform. Grant it explicitly so the service-role client (used by tests here,
-- and by the Task 9 admin seed script) can read/write profiles. RLS policies for
-- `anon`/`authenticated` access are intentionally deferred to Task 6.
grant select, insert, update, delete on public.profiles to service_role;

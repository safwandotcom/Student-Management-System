create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    -- raw_app_meta_data is writable only via the service-role admin API;
    -- raw_user_meta_data is client-writable via the public signup endpoint
    -- and must never be trusted for authorization-relevant fields like role.
    coalesce(new.raw_app_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

-- GoTrue's admin `createUser` (verified against local gotrue:v2.195.0) inserts
-- the auth.users row first and only merges caller-supplied `app_metadata`
-- (e.g. { role: "admin" }) via a follow-up UPDATE within the same request —
-- auth.users.updated_at ends up a few ms after created_at. The AFTER INSERT
-- trigger above therefore fires before that role value exists, and
-- scripts/seed-admin.ts (which sets role via app_metadata on createUser)
-- would otherwise always produce a 'student' profile. Sync the role again
-- whenever raw_app_meta_data changes, still sourced exclusively from
-- raw_app_meta_data (service-role-only) — never from raw_user_meta_data.
create or replace function public.handle_user_app_metadata_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.raw_app_meta_data->>'role' is not null
     and new.raw_app_meta_data->>'role' is distinct from old.raw_app_meta_data->>'role' then
    update public.profiles set role = new.raw_app_meta_data->>'role' where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row execute procedure public.handle_user_app_metadata_updated();

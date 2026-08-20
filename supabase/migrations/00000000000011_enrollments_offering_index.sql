-- The 4 RLS policies added in migration 00000000000010 all join on
-- enrollments.offering_id, but only enrollments_pkey and the
-- (student_id, offering_id) unique constraint exist as indexes — neither
-- indexes offering_id alone as a leading column, so those joins currently
-- sequential-scan enrollments.
create index enrollments_offering_id_idx on public.enrollments (offering_id);

-- courses.code: case-insensitive uniqueness. The existing plain `unique`
-- constraint from migration 6 remains (harmless, strictly redundant once
-- this index exists, but removing it isn't necessary and keeping it avoids
-- an unrelated migration touching the original table definition).
create unique index courses_code_lower_idx on public.courses (lower(code));

-- course_offerings: case-insensitive version of the same trio the plain
-- `unique (course_id, lecturer_id, term)` constraint from migration 7
-- already covers case-sensitively. course_id and lecturer_id are uuids
-- (no case-sensitivity concern), only term needs lower().
create unique index course_offerings_ci_idx
  on public.course_offerings (course_id, lecturer_id, lower(term));

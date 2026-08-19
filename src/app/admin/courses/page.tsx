import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface CourseRow {
  id: string;
  code: string;
  title: string;
  credits: number;
  semester: string;
  department: string;
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("courses")
    .select("id, code, title, credits, semester, department", { count: "exact" })
    .order("code", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("code", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as CourseRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Courses</h1>
          <p className="text-sm text-ink-500">Search by course code.</p>
        </div>
        <Link href="/admin/courses/new">
          <Button>Add Course</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/courses"
          searchValue={search}
          searchPlaceholder="Search by course code…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Code", cell: (row) => row.code },
            { header: "Title", cell: (row) => row.title },
            { header: "Credits", cell: (row) => String(row.credits) },
            { header: "Semester", cell: (row) => row.semester },
            { header: "Department", cell: (row) => row.department },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/courses/${row.id}`} className="text-brand-700 hover:underline">
                  View
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

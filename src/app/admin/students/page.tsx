import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseListParams, rangeForPage, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface StudentRow {
  id: string;
  student_id: string;
  program: string;
  batch: string;
  profiles: { full_name: string; status: string } | null;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = parseListParams(await searchParams);
  const [from, to] = rangeForPage(page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("students")
    .select("id, student_id, program, batch, profiles(full_name, status)", { count: "exact" })
    .order("student_id", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (search) {
    query = query.ilike("student_id", `%${search}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as StudentRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Students</h1>
          <p className="text-sm text-ink-500">Search by student ID.</p>
        </div>
        <Link href="/admin/students/new">
          <Button>Add Student</Button>
        </Link>
      </div>
      <Card>
        <DataTable
          basePath="/admin/students"
          searchValue={search}
          searchPlaceholder="Search by student ID…"
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          totalCount={count ?? 0}
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            { header: "Student ID", cell: (row) => row.student_id },
            { header: "Name", cell: (row) => row.profiles?.full_name ?? "—" },
            { header: "Program", cell: (row) => row.program },
            { header: "Batch", cell: (row) => row.batch },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.profiles?.status === "active" ? "success" : "neutral"}>
                  {row.profiles?.status ?? "unknown"}
                </Badge>
              ),
            },
            {
              header: "",
              cell: (row) => (
                <Link href={`/admin/students/${row.id}`} className="text-brand-700 hover:underline">
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
